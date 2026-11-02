import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { EXAM_TIME_EXPIRED_ERROR, examDeadline, isSubmissionTooLate } from "@/lib/exams/timing";

/** Questions renvoyées au candidat : jamais la bonne réponse. */
const candidateInclude = {
  examTemplate: {
    include: {
      questions: {
        select: {
          id: true,
          type: true,
          question: true,
          points: true,
          order: true,
          options: true,
        },
      },
    },
  },
} satisfies Prisma.ExamSessionInclude;

/**
 * POST /api/exams/[id]/start — ouvre (ou reprend) la session de l'élève.
 *
 * L'heure de départ est fixée ici, côté serveur : la page en déduit le temps
 * restant et les routes de soumission refusent un envoi hors délai (TD-023).
 * Recharger la page reprend la même session, sans remettre le minuteur à zéro.
 */
export const POST = createApiHandler(
  async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;
    const guard = await assertModelAccess(session, "examTemplate", id, "Examen non disponible");
    if (guard) return guard;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const exam = await prisma.examTemplate.findUnique({
      where: { id: id },
      include: {
        questions: true,
        classSubject: { include: { class: { select: { id: true, schoolId: true } } } },
      },
    });

    if (!exam || !exam.isPublished) {
      return NextResponse.json({ error: "Examen non disponible" }, { status: 404 });
    }

    const classEnrollment = await prisma.enrollment.findFirst({
      where: { studentId: studentProfile.id, classId: exam.classSubject.class.id, status: "ACTIVE" },
    });
    if (!classEnrollment) {
      return NextResponse.json({ error: "Vous devez être inscrit à cette classe" }, { status: 403 });
    }

    const respond = (
      examSession: { startedAt: Date } & Record<string, unknown>,
      status: number,
    ) =>
      NextResponse.json(
        {
          ...examSession,
          deadline: examDeadline(examSession.startedAt, exam.duration).toISOString(),
          serverNow: new Date().toISOString(),
        },
        { status },
      );

    // Session existante : reprise, sauf si elle est close.
    const existing = await prisma.examSession.findFirst({
      where: { examTemplateId: id, studentId: studentProfile.id },
      include: candidateInclude,
    });
    if (existing) {
      if (existing.submittedAt) {
        return NextResponse.json({ error: "Examen déjà soumis", code: "EXAM_ALREADY_SUBMITTED" }, { status: 409 });
      }
      if (isSubmissionTooLate(existing.startedAt, exam.duration)) {
        return NextResponse.json(EXAM_TIME_EXPIRED_ERROR, { status: 409 });
      }
      return respond(existing, 200);
    }

    try {
      const created = await prisma.examSession.create({
        data: {
          examTemplateId: id,
          studentId: studentProfile.id,
          totalPoints: exam.totalPoints,
        },
        include: candidateInclude,
      });

      return respond(created, 201);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Double clic : l'autre requête vient de créer la session, on la reprend.
        const concurrent = await prisma.examSession.findFirst({
          where: { examTemplateId: id, studentId: studentProfile.id },
          include: candidateInclude,
        });
        if (concurrent && !concurrent.submittedAt) return respond(concurrent, 200);
        return NextResponse.json({ error: "Examen déjà commencé" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    logger.error(" starting exam:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
  },
  { allowedRoles: ["STUDENT"] },
);
