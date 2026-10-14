/**
 * Formule de la moyenne d'une matière, choisie par SON enseignant.
 *
 * GET : formule en vigueur pour la matière (celle de l'enseignant, sinon celle
 *       de l'école) — lisible par l'équipe pédagogique de l'établissement.
 * PUT : { formula: "…" } pour écrire sa formule, { formula: null } pour revenir
 *       à celle de l'école. Réservé à l'enseignant de la matière, et seulement si
 *       l'école laisse ce choix aux enseignants. La formule est vérifiée (même
 *       contrôle que pour l'école), le changement est tracé, et les moyennes de
 *       la période en cours sont recalculées. Les périodes au conseil validé
 *       gardent la formule gelée à ce moment-là.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { assertSubjectTeacher } from "@/lib/academic/grade-write-guard";
import { getGradingSettings } from "@/lib/academic/grading-settings";
import { validateFormula } from "@/lib/academic/formula";
import { syncAnalyticsForClassPeriod } from "@/lib/services/analytics-sync";
import { logger } from "@/lib/utils/logger";

const READ_ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

const bodySchema = z.object({ formula: z.string().max(300).nullable() });

async function loadSubject(id: string) {
    return prisma.classSubject.findUnique({
        where: { id },
        select: {
            id: true,
            classId: true,
            averageFormula: true,
            subject: { select: { name: true } },
            class: { select: { schoolId: true, name: true } },
            teacher: { select: { userId: true } },
        },
    });
}

export const GET = createApiHandler(
    async (_request, { session, params }) => {
        const { id } = await params;
        const cs = await loadSubject(id);
        if (!cs) return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
        if (!canAccessSchool(session, cs.class.schoolId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

        const settings = await getGradingSettings(cs.class.schoolId);
        const own = settings.teacherFormulas && cs.averageFormula?.trim() ? cs.averageFormula : null;
        return NextResponse.json({
            subject: cs.subject.name,
            className: cs.class.name,
            schoolFormula: settings.calculation.subjectFormula,
            subjectFormula: own,
            effectiveFormula: own ?? settings.calculation.subjectFormula,
            teacherFormulasAllowed: settings.teacherFormulas,
            canEdit:
                settings.teacherFormulas && session.user.role === "TEACHER" && cs.teacher?.userId === session.user.id,
        });
    },
    { allowedRoles: READ_ROLES },
);

export const PUT = createApiHandler(
    async (request, { session, params }) => {
        const { id } = await params;
        const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: "Formule invalide" }, { status: 400 });

        const cs = await loadSubject(id);
        if (!cs) return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
        if (!canAccessSchool(session, cs.class.schoolId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

        // L'enseignant est maître de sa matière : lui seul choisit sa formule
        const notTeacher = assertSubjectTeacher(session, cs);
        if (notTeacher) return notTeacher;

        const settings = await getGradingSettings(cs.class.schoolId);
        if (!settings.teacherFormulas) {
            return NextResponse.json(
                {
                    error: "L'établissement applique la même formule à toutes les matières : la direction a désactivé le choix par l'enseignant.",
                    code: "TEACHER_FORMULAS_DISABLED",
                },
                { status: 403 },
            );
        }

        let next: string | null = null;
        const raw = parsed.data.formula?.trim() ?? "";
        if (raw) {
            const check = validateFormula(raw, "SUBJECT");
            if (!check.ok) return NextResponse.json({ error: check.error, code: "FORMULA_INVALID" }, { status: 400 });
            // Formule identique à celle de l'école : on garde « formule de l'école »
            next = check.text === settings.calculation.subjectFormula ? null : check.text;
        }

        if ((cs.averageFormula ?? null) !== next) {
            await prisma.$transaction([
                prisma.classSubject.update({ where: { id }, data: { averageFormula: next } }),
                prisma.auditLog.create({
                    data: {
                        userId: session.user.id,
                        schoolId: cs.class.schoolId,
                        action: "SUBJECT_FORMULA_CHANGED",
                        entity: "ClassSubject",
                        entityId: id,
                        oldValues: { formula: cs.averageFormula ?? null, subject: cs.subject.name, class: cs.class.name },
                        newValues: { formula: next, subject: cs.subject.name, class: cs.class.name },
                    },
                }),
            ]);

            // Moyennes enregistrées (tableaux de bord, espace parents) de la période en cours
            const now = new Date();
            const period = await prisma.period.findFirst({
                where: {
                    academicYear: { schoolId: cs.class.schoolId, isCurrent: true },
                    startDate: { lte: now },
                    endDate: { gte: now },
                },
                select: { id: true, academicYearId: true },
            });
            if (period) {
                void syncAnalyticsForClassPeriod(cs.classId, period.id, period.academicYearId).catch((error: unknown) =>
                    logger.error("Recalcul après changement de formule", error as Error, { classSubjectId: id }),
                );
            }
        }

        return NextResponse.json({
            subjectFormula: next,
            effectiveFormula: next ?? settings.calculation.subjectFormula,
        });
    },
    { allowedRoles: ["TEACHER"] },
);
