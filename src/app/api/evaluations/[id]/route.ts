import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { guardPeriodWritable } from "@/lib/academic/year-lock";
import { assertNotCouncilLocked, assertSubjectTeacher } from "@/lib/academic/grade-write-guard";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { createAuditLog } from "@/lib/security/audit-log";
import { syncAnalyticsForClassPeriod, syncFutureAnalyticsForStudents } from "@/lib/services/analytics-sync";

/** Champs corrigeables : la matière, la période et le type restent ceux de la création. */
const evaluationUpdateSchema = z
    .object({
        title: z.string().trim().max(200).nullable().optional(),
        date: z.coerce.date().optional(),
        maxGrade: z.coerce.number().min(1).max(100).optional(),
        coefficient: z.coerce.number().min(0.1).max(10).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

type LoadedEvaluation = NonNullable<Awaited<ReturnType<typeof loadEvaluation>>>;

function loadEvaluation(id: string) {
    return prisma.evaluation.findUnique({
        where: { id },
        include: {
            classSubject: { select: { classId: true, class: { select: { schoolId: true } }, teacher: { select: { userId: true } } } },
            period: { select: { id: true, academicYearId: true, sequence: true } },
        },
    });
}

/**
 * Accès à une évaluation pour l'écrire : même règle que la création (seul
 * l'enseignant de la matière, année ouverte, conseil de classe non validé).
 */
type WriterSession = Parameters<typeof canAccessSchool>[0] & Parameters<typeof assertSubjectTeacher>[0];

async function guardWritable(evaluation: LoadedEvaluation | null, session: WriterSession) {
    if (!evaluation || !canAccessSchool(session, evaluation.classSubject.class.schoolId)) {
        return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });
    }
    return (
        (await guardPeriodWritable(evaluation.periodId)) ??
        assertSubjectTeacher(session, evaluation.classSubject) ??
        (await assertNotCouncilLocked(evaluation.classSubject.classId, evaluation.periodId))
    );
}

/** Moyennes et rangs de la classe recalculés pour la période et les suivantes. */
async function resyncClassAverages(evaluation: LoadedEvaluation) {
    const { classId } = evaluation.classSubject;
    const { academicYearId, sequence } = evaluation.period;
    await syncAnalyticsForClassPeriod(classId, evaluation.periodId, academicYearId);
    const enrollments = await prisma.enrollment.findMany({
        where: { classId, academicYearId, status: "ACTIVE" },
        select: { studentId: true },
    });
    await syncFutureAnalyticsForStudents(enrollments.map((e) => e.studentId), academicYearId, sequence);
    await Promise.all([
        invalidateByPath(CACHE_PATHS.grades),
        invalidateByPath("/api/evaluations"),
        invalidateByPath("/api/analytics"),
        invalidateByPath("/api/grades/statistics"),
        invalidateByPath("/api/grades/report-cards"),
    ]);
}

/**
 * PATCH /api/evaluations/[id] — corriger le titre, la date, le barème ou le
 * coefficient d'une évaluation. Aucune route ne le permettait : une erreur de
 * barème ou de coefficient restait définitive.
 */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = evaluationUpdateSchema.parse(await request.json());
        const evaluation = await loadEvaluation(id);
        const blocked = await guardWritable(evaluation, session);
        if (blocked || !evaluation) return blocked ?? NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });

        // Un barème abaissé ne peut pas passer sous une note déjà saisie
        if (data.maxGrade !== undefined && data.maxGrade < Number(evaluation.maxGrade)) {
            const highest = await prisma.grade.aggregate({
                where: { evaluationId: id, deletedAt: null, value: { not: null } },
                _max: { value: true },
            });
            const top = highest._max.value === null ? null : Number(highest._max.value);
            if (top !== null && top > data.maxGrade) {
                return NextResponse.json(
                    { error: `Barème impossible : une note de ${top} est déjà saisie (au-delà de ${data.maxGrade}). Corrigez d'abord cette note.` },
                    { status: 409 },
                );
            }
        }

        const updated = await prisma.evaluation.update({
            where: { id },
            data: {
                ...(data.title !== undefined ? { title: data.title || null } : {}),
                ...(data.date ? { date: data.date } : {}),
                ...(data.maxGrade !== undefined ? { maxGrade: data.maxGrade } : {}),
                ...(data.coefficient !== undefined ? { coefficient: data.coefficient } : {}),
            },
            include: { type: true, period: true },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "EVALUATION_UPDATED",
            entity: "Evaluation",
            entityId: id,
            schoolId: evaluation.classSubject.class.schoolId,
            oldValues: { title: evaluation.title, date: evaluation.date, maxGrade: String(evaluation.maxGrade), coefficient: String(evaluation.coefficient) },
            newValues: { title: updated.title, date: updated.date, maxGrade: String(updated.maxGrade), coefficient: String(updated.coefficient) },
        });

        // Barème et coefficient changent les moyennes : recalcul de la classe
        const averagesChanged =
            (data.maxGrade !== undefined && data.maxGrade !== Number(evaluation.maxGrade)) ||
            (data.coefficient !== undefined && data.coefficient !== Number(evaluation.coefficient));
        if (averagesChanged) await resyncClassAverages(evaluation);
        else await invalidateByPath("/api/evaluations");

        return NextResponse.json(updated);
    },
    { requireAuth: true, allowedRoles: ["TEACHER"] },
);

/**
 * DELETE /api/evaluations/[id] — décision du 2026-11-05 : une évaluation reste
 * supprimable avec ses notes tant que la période n'est pas figée (année ouverte,
 * conseil non validé), sur confirmation explicite (`?confirm=true`) et avec une
 * trace d'audit. Sans confirmation, 409 indique le nombre de notes concernées.
 */
export const DELETE = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const evaluation = await loadEvaluation(id);
        const blocked = await guardWritable(evaluation, session);
        if (blocked || !evaluation) return blocked ?? NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });

        const gradeCount = await prisma.grade.count({ where: { evaluationId: id, deletedAt: null } });
        const confirmed = new URL(request.url).searchParams.get("confirm") === "true";
        if (gradeCount > 0 && !confirmed) {
            return NextResponse.json(
                {
                    error: `Cette évaluation porte ${gradeCount} note${gradeCount > 1 ? "s" : ""} : confirmez pour les supprimer avec elle. Les moyennes seront recalculées.`,
                    code: "EVALUATION_HAS_GRADES",
                    gradeCount,
                },
                { status: 409 },
            );
        }

        await prisma.evaluation.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id,
            action: "EVALUATION_DELETED",
            entity: "Evaluation",
            entityId: id,
            schoolId: evaluation.classSubject.class.schoolId,
            oldValues: {
                title: evaluation.title,
                date: evaluation.date,
                maxGrade: String(evaluation.maxGrade),
                coefficient: String(evaluation.coefficient),
                classSubjectId: evaluation.classSubjectId,
                periodId: evaluation.periodId,
                gradeCount,
            },
            severity: gradeCount > 0 ? "WARNING" : "INFO",
        });
        if (gradeCount > 0) await resyncClassAverages(evaluation);
        else await invalidateByPath("/api/evaluations");

        return NextResponse.json({ success: true, deletedGrades: gradeCount });
    },
    { requireAuth: true, allowedRoles: ["TEACHER"] },
);
