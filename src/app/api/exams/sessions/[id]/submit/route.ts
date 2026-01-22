import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const submitExamSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().cuid(),
    answer: z.string(),
  })),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = submitExamSchema.parse(body);

    const examSession = await prisma.examSession.findUnique({
      where: { id: params.id },
      include: {
        examTemplate: {
          include: {
            questions: true,
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
        examSessionId: params.id,
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
    const updatedSession = await prisma.examSession.update({
      where: { id: params.id },
      data: {
        submittedAt: new Date(),
        timeSpent,
        score: totalScore,
        isPassed: totalScore >= examSession.examTemplate.passingScore,
      },
      include: {
        answers: true,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: examSession.student.user.id,
        type: updatedSession.isPassed ? "SUCCESS" : "INFO",
        title: "Examen soumis",
        message: `Votre examen "${examSession.examTemplate.title}" a été soumis. Score: ${totalScore}/${examSession.totalPoints}`,
        link: `/exams/sessions/${params.id}`,
      },
    });

    return NextResponse.json(updatedSession);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" submitting exam:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
