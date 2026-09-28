import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { assertModelAccess } from "@/lib/security/tenant";
import { canEditExam, examBareme, parseQuestionInput } from "@/lib/exams/questions";

/**
 * POST /api/exams/[id]/questions — ajoute une question à un examen en ligne.
 *
 * Réservé à l'auteur, à l'enseignant de la matière et à la direction. Refusé
 * dès qu'une copie a été rendue (le barème des copies corrigées changerait).
 * Le barème de l'examen suit ses questions (voir examBareme).
 */
export const POST = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const session = context.session;

        const guard = await assertModelAccess(session, "examTemplate", id, "Examen non trouvé");
        if (guard) return guard;

        const exam = await prisma.examTemplate.findUnique({
            where: { id },
            select: {
                createdById: true,
                classSubject: { select: { teacher: { select: { userId: true } } } },
                questions: { select: { points: true, order: true } },
                _count: { select: { examSessions: { where: { submittedAt: { not: null } } } } },
            },
        });
        if (!exam) return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });

        if (!canEditExam(session.user, exam)) {
            return NextResponse.json({ error: "Seuls l'auteur, l'enseignant de la matière et la direction modifient cet examen" }, { status: 403 });
        }
        if (exam._count.examSessions > 0) {
            return NextResponse.json({ error: "Des copies ont déjà été rendues : les questions ne peuvent plus changer" }, { status: 409 });
        }

        const parsed = parseQuestionInput(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });

        const nextOrder = exam.questions.reduce((max, q) => Math.max(max, q.order), 0) + 1;
        const question = await prisma.$transaction(async (tx) => {
            const created = await tx.question.create({
                data: { ...parsed.data, examTemplateId: id, order: nextOrder },
                select: { id: true, type: true, question: true, points: true, order: true, options: true, correctAnswer: true },
            });
            await tx.examTemplate.update({
                where: { id },
                data: examBareme([...exam.questions, { points: parsed.data.points }]),
            });
            return created;
        });

        return NextResponse.json(question, { status: 201 });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
);
