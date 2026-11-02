import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { assertModelAccess } from "@/lib/security/tenant";
import { logger } from "@/lib/utils/logger";
import { EXAM_TIME_EXPIRED_ERROR, elapsedSeconds, isSubmissionTooLate } from "@/lib/exams/timing";

// questionId → réponse ; bornes contre les corps démesurés.
const submitSchema = z.object({
  answers: z
    .record(z.string().max(64), z.string().max(5_000))
    .refine((answers) => Object.keys(answers).length <= 500, { message: "Trop de réponses" }),
});

/**
 * POST /api/exams/[id]/submit — soumission depuis la page de passage.
 *
 * Mêmes garanties que /api/exams/sessions/[id]/submit : examen de l'école de
 * l'élève, publié, de sa classe, soumis UNE fois. Avant, tout élève pouvait
 * soumettre n'importe quel examen, de n'importe quelle école, autant de fois
 * qu'il voulait : le score renvoyé à chaque essai livrait les bonnes réponses.
 *
 * Durée (TD-023) : la session doit avoir été ouverte par /start, qui fixe
 * l'heure de départ ; un envoi après l'échéance + la marge est refusé.
 */
export const POST = createApiHandler(
  async (request, context) => {
    try {
      const { id } = await context.params;
      const session = context.session;

      const guard = await assertModelAccess(session, "examTemplate", id, "Examen non trouvé");
      if (guard) return guard;

      const { answers } = submitSchema.parse(await request.json());

      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!studentProfile) {
        return NextResponse.json({ error: "Profil élève non trouvé" }, { status: 404 });
      }

      const exam = await prisma.examTemplate.findUnique({
        where: { id },
        include: { questions: true, classSubject: { select: { classId: true } } },
      });
      if (!exam || !exam.isPublished) {
        return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: studentProfile.id, classId: exam.classSubject.classId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!enrollment) {
        return NextResponse.json({ error: "Vous devez être inscrit à cette classe" }, { status: 403 });
      }

      const existing = await prisma.examSession.findUnique({
        where: { examTemplateId_studentId_attempt: { examTemplateId: id, studentId: studentProfile.id, attempt: 1 } },
        select: { id: true, submittedAt: true, startedAt: true },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Examen non commencé : ouvrez-le avant de le soumettre.", code: "EXAM_NOT_STARTED" },
          { status: 409 },
        );
      }
      if (existing.submittedAt) {
        return NextResponse.json({ error: "Examen déjà soumis" }, { status: 409 });
      }
      if (isSubmissionTooLate(existing.startedAt, exam.duration)) {
        return NextResponse.json(EXAM_TIME_EXPIRED_ERROR, { status: 409 });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Clôture conditionnelle : deux envois simultanés ne notent qu'une fois.
        const claimed = await tx.examSession.updateMany({
          where: { id: existing.id, submittedAt: null },
          data: { submittedAt: new Date() },
        });
        if (claimed.count === 0) return null;
        const examSession = { id: existing.id };

        await tx.examAnswer.deleteMany({ where: { examSessionId: examSession.id } });

        let totalScore = 0;
        const answerData = exam.questions.map((question) => {
          const answer = answers[question.id] ?? "";
          const autoGraded = question.type === "MCQ" || question.type === "TRUE_FALSE";
          // Même règle que la route de session : casse et espaces ignorés.
          const isCorrect =
            autoGraded && answer.trim().toLowerCase() === (question.correctAnswer ?? "").trim().toLowerCase();
          const pointsEarned = isCorrect ? question.points : 0;
          totalScore += pointsEarned;
          return {
            examSessionId: examSession.id,
            questionId: question.id,
            answer,
            isCorrect: autoGraded ? isCorrect : null,
            pointsEarned,
          };
        });
        await tx.examAnswer.createMany({ data: answerData });

        const hasManualQuestions = exam.questions.some((q) => q.type === "SHORT_ANSWER" || q.type === "ESSAY");
        return tx.examSession.update({
          where: { id: examSession.id },
          data: {
            timeSpent: elapsedSeconds(existing.startedAt),
            score: totalScore,
            isPassed: hasManualQuestions ? null : totalScore >= exam.passingScore,
          },
        });
      });

      if (!result) {
        return NextResponse.json({ error: "Examen déjà soumis" }, { status: 409 });
      }
      return NextResponse.json(result);
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
      }
      logger.error("Error submitting exam:", error as Error);
      return NextResponse.json({ error: "Erreur lors de la soumission de l'examen" }, { status: 500 });
    }
  },
  { allowedRoles: ["STUDENT"] },
);
