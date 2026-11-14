import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { guardPeriodWritable } from "@/lib/academic/year-lock";
import { assertNotCouncilLocked } from "@/lib/academic/grade-write-guard";
import { invalidateClassAverages } from "@/lib/academic/class-averages";
import { persistStudentAnalyticsSnapshot, syncFutureAnalyticsForStudents } from "@/lib/services/analytics-sync";
import { createAuditLog } from "@/lib/security/audit-log";

const DIRECTION = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

const putSchema = z.object({
    periodId: z.string().cuid(),
    /** null : effacer la moyenne d'origine de cette période. */
    average: z.number().min(0).max(20).multipleOf(0.01).nullable(),
    originSchool: z.string().trim().min(2, "Indiquez l'établissement d'origine.").max(160).optional(),
});

/** Élève de l'école et son inscription active (classe et année). */
async function loadStudent(id: string) {
    return prisma.studentProfile.findUnique({
        where: { id },
        select: {
            id: true,
            schoolId: true,
            enrollments: {
                where: { status: "ACTIVE", deletedAt: null },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { classId: true, academicYearId: true },
            },
        },
    });
}

/**
 * Moyennes obtenues dans l'établissement d'origine (élève transféré), lues sur
 * son bulletin de transfert. Le calcul des moyennes les utilisait déjà pour une
 * période sans note dans l'école, mais rien ne permettait de les saisir.
 */
export const GET = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const student = await loadStudent(id);
        if (!student || !canAccessSchool(session, student.schoolId)) {
            return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        }
        const enrollment = student.enrollments[0];
        if (!enrollment) return NextResponse.json({ periods: [] });
        const periods = await prisma.period.findMany({
            where: { academicYearId: enrollment.academicYearId },
            orderBy: { sequence: "asc" },
            select: { id: true, name: true, sequence: true, externalAverages: { where: { studentId: id }, select: { average: true, originSchool: true } } },
        });
        return NextResponse.json({
            periods: periods.map((p) => ({
                periodId: p.id,
                name: p.name,
                sequence: p.sequence,
                average: p.externalAverages[0] ? Number(p.externalAverages[0].average) : null,
                originSchool: p.externalAverages[0]?.originSchool ?? null,
            })),
        });
    },
    { requireAuth: true, allowedRoles: DIRECTION },
);

export const PUT = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = putSchema.parse(await request.json());
        const student = await loadStudent(id);
        if (!student || !canAccessSchool(session, student.schoolId)) {
            return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        }
        const enrollment = student.enrollments[0];
        if (!enrollment) {
            return NextResponse.json({ error: "L'élève n'a pas d'inscription active cette année." }, { status: 409 });
        }
        const period = await prisma.period.findFirst({
            where: { id: data.periodId, academicYearId: enrollment.academicYearId },
            select: { id: true, sequence: true },
        });
        if (!period) return NextResponse.json({ error: "Cette période n'est pas celle de l'année de l'élève." }, { status: 400 });

        // Mêmes verrous que les notes : année clôturée, conseil de classe validé
        const blocked = (await guardPeriodWritable(period.id)) ?? (await assertNotCouncilLocked(enrollment.classId, period.id));
        if (blocked) return blocked;

        const before = await prisma.externalPeriodAverage.findUnique({
            where: { studentId_periodId: { studentId: id, periodId: period.id } },
            select: { average: true, originSchool: true },
        });
        if (data.average === null) {
            await prisma.externalPeriodAverage.deleteMany({ where: { studentId: id, periodId: period.id } });
        } else {
            if (!data.originSchool) {
                return NextResponse.json({ error: "Indiquez l'établissement d'origine." }, { status: 400 });
            }
            await prisma.externalPeriodAverage.upsert({
                where: { studentId_periodId: { studentId: id, periodId: period.id } },
                create: { studentId: id, periodId: period.id, average: data.average, originSchool: data.originSchool, enteredById: session.user.id },
                update: { average: data.average, originSchool: data.originSchool, enteredById: session.user.id },
            });
        }
        await createAuditLog({
            userId: session.user.id,
            action: "EXTERNAL_AVERAGE_SET",
            entity: "ExternalPeriodAverage",
            entityId: `${id}:${period.id}`,
            schoolId: student.schoolId,
            oldValues: before ? { average: String(before.average), originSchool: before.originSchool } : undefined,
            newValues: { average: data.average, originSchool: data.originSchool ?? null },
        });

        // Moyennes annuelles, rangs et périodes suivantes de l'élève recalculés
        invalidateClassAverages();
        await persistStudentAnalyticsSnapshot(id, period.id, enrollment.academicYearId);
        await syncFutureAnalyticsForStudents([id], enrollment.academicYearId, period.sequence);
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: DIRECTION },
);
