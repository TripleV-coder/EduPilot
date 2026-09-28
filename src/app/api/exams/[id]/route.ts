import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { canEditExam } from "@/lib/exams/questions";
import { z } from "zod";

/**
 * GET /api/exams/[id]
 * Get exam details with questions
 */
export const GET = createApiHandler(async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;
    const guard = await assertModelAccess(session, "examTemplate", id, "Examen non trouvé");
    if (guard) return guard;

    const exam = await prisma.examTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true, examSessions: { where: { submittedAt: { not: null } } } } },
        classSubject: {
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            type: true,
            question: true,
            points: true,
            order: true,
            options: true,
            correctAnswer: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
    }

    // Élève et famille : les choix d'un QCM, jamais la bonne réponse.
    if (!roleSatisfies(session.user.role, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"])) {
      return NextResponse.json({
        ...exam,
        questions: exam.questions.map(({ correctAnswer: _hidden, ...question }) => question),
      });
    }

    return NextResponse.json(exam);
  } catch (error) {
    logger.error("Error fetching exam", error as Error, { module: "api/exams/[id]" });
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'examen" },
      { status: 500 }
    );
  }
});

const publishSchema = z.object({ isPublished: z.boolean() });

/**
 * PATCH /api/exams/[id] — publie ou dépublie l'examen.
 * Un examen sans question ne peut pas être publié (l'élève tombait sur un écran vide).
 */
export const PATCH = createApiHandler(
  async (request, context) => {
    const { id } = await context.params;
    const session = context.session;
    const guard = await assertModelAccess(session, "examTemplate", id, "Examen non trouvé");
    if (guard) return guard;

    const parsed = publishSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Indiquez isPublished (vrai ou faux)" }, { status: 400 });

    const exam = await prisma.examTemplate.findUnique({
      where: { id },
      select: {
        createdById: true,
        classSubject: { select: { teacher: { select: { userId: true } } } },
        _count: { select: { questions: true } },
      },
    });
    if (!exam) return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
    if (!canEditExam(session.user, exam)) {
      return NextResponse.json({ error: "Seuls l'auteur, l'enseignant de la matière et la direction modifient cet examen" }, { status: 403 });
    }
    if (parsed.data.isPublished && exam._count.questions === 0) {
      return NextResponse.json({ error: "Ajoutez au moins une question avant de publier l'examen" }, { status: 409 });
    }

    const updated = await prisma.examTemplate.update({
      where: { id },
      data: { isPublished: parsed.data.isPublished },
      select: { id: true, isPublished: true },
    });
    return NextResponse.json(updated);
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }
);

/**
 * DELETE /api/exams/[id]
 * Delete an exam template
 */
export const DELETE = createApiHandler(
  async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;
    const guard = await assertModelAccess(session, "examTemplate", id, "Examen non trouvé");
    if (guard) return guard;

    const exam = await prisma.examTemplate.findUnique({
      where: { id },
      include: {
        classSubject: {
          include: { class: { select: { schoolId: true } } },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
    }

    // Only creator or admin can delete
    const isAdmin = roleSatisfies(session.user.role, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]);
    if (exam.createdById !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres examens" },
        { status: 403 }
      );
    }

    await prisma.examTemplate.delete({ where: { id } });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_EXAM",
        entity: "ExamTemplate",
        entityId: id,
        oldValues: { title: exam.title },
      },
    });

    return NextResponse.json({ message: "Examen supprimé avec succès" });
  } catch (error) {
    logger.error("Error deleting exam", error as Error, { module: "api/exams/[id]" });
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'examen" },
      { status: 500 }
    );
  }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
);
