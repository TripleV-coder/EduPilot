import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { assertModelAccess } from "@/lib/security/tenant";
import { canEditExam, examBareme } from "@/lib/exams/questions";

/**
 * DELETE /api/exams/[id]/questions/[questionId] — retire une question.
 * Mêmes règles que l'ajout ; un examen publié ne peut pas perdre sa dernière question.
 */
export const DELETE = createApiHandler(
    async (_request, context) => {
        const { id, questionId } = await context.params;
        const session = context.session;

        const guard = await assertModelAccess(session, "examTemplate", id, "Examen non trouvé");
        if (guard) return guard;

        const exam = await prisma.examTemplate.findUnique({
            where: { id },
            select: {
                isPublished: true,
                createdById: true,
                classSubject: { select: { teacher: { select: { userId: true } } } },
                questions: { select: { id: true, points: true } },
                _count: { select: { examSessions: { where: { submittedAt: { not: null } } } } },
            },
        });
        if (!exam) return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
        if (!exam.questions.some((q) => q.id === questionId)) {
            return NextResponse.json({ error: "Question introuvable" }, { status: 404 });
        }
        if (!canEditExam(session.user, exam)) {
            return NextResponse.json({ error: "Seuls l'auteur, l'enseignant de la matière et la direction modifient cet examen" }, { status: 403 });
        }
        if (exam._count.examSessions > 0) {
            return NextResponse.json({ error: "Des copies ont déjà été rendues : les questions ne peuvent plus changer" }, { status: 409 });
        }
        const remaining = exam.questions.filter((q) => q.id !== questionId);
        if (exam.isPublished && remaining.length === 0) {
            return NextResponse.json({ error: "Un examen publié doit garder au moins une question. Dépubliez-le d'abord." }, { status: 409 });
        }

        await prisma.$transaction([
            prisma.question.delete({ where: { id: questionId } }),
            prisma.examTemplate.update({ where: { id }, data: examBareme(remaining) }),
        ]);

        return NextResponse.json({ success: true });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
);
