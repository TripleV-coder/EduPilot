import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export const POST = createApiHandler(
  async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;

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
                examTemplateId_studentId_attempt: {
                    examTemplateId: id,
                    studentId: studentProfile.id,
                    attempt: 1,
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
  },
  { allowedRoles: ["STUDENT"] },
);
