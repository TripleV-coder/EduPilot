import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const submitExamSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().cuid(),
    answer: z.string(),
  })).refine(
    (items) => new Set(items.map((i) => i.questionId)).size === items.length,
    { message: "Les questions dupliquées ne sont pas autorisées" }
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = submitExamSchema.parse(body);

    const examSession = await prisma.examSession.findUnique({
      where: { id: id },
      include: {
        examTemplate: {
          include: {
            questions: true,
            classSubject: { include: { class: { select: { schoolId: true } } } },
          },
        },
        student: {
          include: {
            user: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!examSession) {
      return NextResponse.json({ error: "Session non trouvée" }, { status: 404 });
    }

    if (examSession.student.user.id !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (examSession.examTemplate.classSubject.class.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (examSession.submittedAt) {
      return NextResponse.json({ error: "Examen déjà soumis" }, { status: 400 });
    }

    // Auto-grade MCQ and TRUE_FALSE
    let totalScore = 0;
    const answerRecords = validatedData.answers.map(ans => {
      const question = examSession.examTemplate.questions.find(q => q.id === ans.questionId);
      if (!question) return null;

      let isCorrect = false;
      let pointsEarned = 0;

      if (question.type === "MCQ" || question.type === "TRUE_FALSE") {
        isCorrect = ans.answer.trim().toLowerCase() === question.correctAnswer?.trim().toLowerCase();
        pointsEarned = isCorrect ? question.points : 0;
        totalScore += pointsEarned;
      }

      return {
        examSessionId: id,
        questionId: ans.questionId,
        answer: ans.answer,
        isCorrect: (question.type === "MCQ" || question.type === "TRUE_FALSE") ? isCorrect : null,
        pointsEarned,
      };
    }).filter(Boolean);

    // Create answers
    await prisma.examAnswer.createMany({
      data: answerRecords as any,
    });

    // Update session
    const timeSpent = Math.floor((new Date().getTime() - examSession.startedAt.getTime()) / 1000);

    // Check if the exam has manual questions
    const hasManualQuestions = examSession.examTemplate.questions.some(
      q => q.type === "SHORT_ANSWER" || q.type === "ESSAY"
    );

    const updatedSession = await prisma.examSession.update({
      where: { id: id },
      data: {
        submittedAt: new Date(),
        timeSpent,
        score: totalScore,
        isPassed: hasManualQuestions ? null : (totalScore >= examSession.examTemplate.passingScore),
      },
      include: {
        answers: true,
      },
    });

    // Notify student
    const notificationMessage = hasManualQuestions
      ? `Votre examen "${examSession.examTemplate.title}" a été soumis et est en attente de correction.`
      : `Votre examen "${examSession.examTemplate.title}" a été soumis. Score: ${totalScore}/${examSession.examTemplate.totalPoints}`;

    await prisma.notification.create({
      data: {
        userId: examSession.student.user.id,
        type: hasManualQuestions ? "INFO" : (updatedSession.isPassed ? "SUCCESS" : "INFO"),
        title: "Examen soumis",
        message: notificationMessage,
        link: `/exams/sessions/${id}`,
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" submitting exam:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
