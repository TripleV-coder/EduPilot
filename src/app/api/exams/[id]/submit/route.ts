import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (session.user.role !== "STUDENT") {
        return NextResponse.json({ error: "Seuls les élèves peuvent passer des examens" }, { status: 403 });
    }

    const body = await request.json();
    const { answers } = body; // Map of questionId -> answer string

    const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id }
    });

    if (!studentProfile) {
        return NextResponse.json({ error: "Profil élève non trouvé" }, { status: 404 });
    }

    const exam = await prisma.examTemplate.findUnique({
        where: { id },
        include: { questions: true }
    });

    if (!exam) {
        return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
    }

    // Start session and save answers in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create or update session
        const examSession = await tx.examSession.upsert({
            where: {
                examTemplateId_studentId: {
                    examTemplateId: id,
                    studentId: studentProfile.id
                }
            },
            create: {
                examTemplateId: id,
                studentId: studentProfile.id,
                totalPoints: exam.totalPoints,
                submittedAt: new Date()
            },
            update: {
                submittedAt: new Date()
            }
        });

        // Delete old answers if any
        await tx.examAnswer.deleteMany({
            where: { examSessionId: examSession.id }
        });

        // Calculate score and save answers
        let totalScore = 0;
        const answerData = [];

        for (const question of exam.questions) {
            const studentAnswer = answers[question.id];
            const isCorrect = studentAnswer === question.correctAnswer;
            const pointsEarned = isCorrect ? question.points : 0;
            
            if (isCorrect) totalScore += pointsEarned;

            answerData.push({
                examSessionId: examSession.id,
                questionId: question.id,
                answer: studentAnswer,
                isCorrect,
                pointsEarned
            });
        }

        await tx.examAnswer.createMany({ data: answerData });

        // Update session with final score
        return await tx.examSession.update({
            where: { id: examSession.id },
            data: {
                score: totalScore,
                isPassed: totalScore >= (exam.totalPoints / 2)
            }
        });
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error submitting exam:", error as Error);
    return NextResponse.json({ error: "Erreur lors de la soumission de l'examen" }, { status: 500 });
  }
}
