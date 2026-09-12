import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

type Bucket = { sum: number; count: number; name: string };

function addTo<K>(map: Map<K, Bucket>, key: K, name: string, sum: number, count: number) {
    const bucket = map.get(key) ?? { sum: 0, count: 0, name };
    bucket.sum += sum;
    bucket.count += count;
    map.set(key, bucket);
}

function averages(map: Map<unknown, Bucket>) {
    return Array.from(map.values())
        .map((b) => ({ name: b.name, average: b.count > 0 ? Number((b.sum / b.count).toFixed(2)) : 0 }))
        .sort((a, b) => b.average - a.average);
}

/**
 * GET /api/performances — moyennes (valeurs brutes des notes) par niveau,
 * classe et matière pour une période.
 *
 * C3 : l'ancienne version chargeait toutes les classes avec toutes leurs
 * matières, évaluations et notes de la période pour sommer en JS. Ici, les
 * sommes et effectifs sont calculés par PostgreSQL (groupBy par évaluation) ;
 * seules les évaluations de la période (sans notes) sont lues. Les notes
 * supprimées (deletedAt) ne sont plus comptées.
 */
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const url = new URL(request.url);
        const periodId = url.searchParams.get("periodId");
        const academicYearId = url.searchParams.get("academicYearId");

        const schoolId =
            session.user.role !== "SUPER_ADMIN" ? getActiveSchoolId(session) ?? undefined : undefined;
        const schoolConstraint = schoolId ? { schoolId } : {};

        // Find the academic year
        const activeYear = await prisma.academicYear.findFirst({
            where: {
                ...schoolConstraint,
                ...(academicYearId ? { id: academicYearId } : { isCurrent: true })
            }
        });

        if (!activeYear) {
            return NextResponse.json({ error: "Aucune année académique active trouvée." }, { status: 404 });
        }

        // Fetch periods for the active year
        const periods = await prisma.period.findMany({
            where: { academicYearId: activeYear.id },
            orderBy: { startDate: 'asc' }
        });

        const activePeriodId = periodId || (periods.find(p => p.startDate <= new Date() && p.endDate >= new Date())?.id || periods[0]?.id);

        if (!activePeriodId) {
            return NextResponse.json({ error: "Aucune période trouvée." }, { status: 404 });
        }

        const evaluations = await prisma.evaluation.findMany({
            where: {
                periodId: activePeriodId,
                ...(schoolId ? { classSubject: { class: { schoolId } } } : {}),
            },
            select: {
                id: true,
                classSubject: {
                    select: {
                        subjectId: true,
                        subject: { select: { name: true } },
                        class: { select: { id: true, name: true, classLevelId: true, classLevel: { select: { name: true } } } },
                    },
                },
            },
        });

        const sums = evaluations.length > 0
            ? await prisma.grade.groupBy({
                by: ["evaluationId"],
                where: {
                    evaluationId: { in: evaluations.map((e) => e.id) },
                    isAbsent: false,
                    value: { not: null },
                    deletedAt: null,
                },
                _sum: { value: true },
                _count: { value: true },
            })
            : [];
        const byEvaluation = new Map(
            sums.map((row) => [row.evaluationId, { sum: Number(row._sum.value ?? 0), count: row._count.value }])
        );

        let totalGradesSum = 0;
        let totalGradesCount = 0;
        const levelAverages = new Map<string, Bucket>();
        const classAverages = new Map<string, Bucket>();
        const subjectAverages = new Map<string, Bucket>();

        for (const evaluation of evaluations) {
            const totals = byEvaluation.get(evaluation.id);
            if (!totals || totals.count === 0) continue;
            const { class: cls, subject, subjectId } = evaluation.classSubject;

            totalGradesSum += totals.sum;
            totalGradesCount += totals.count;
            addTo(levelAverages, cls.classLevelId, cls.classLevel.name, totals.sum, totals.count);
            addTo(classAverages, cls.id, `${cls.classLevel.name} ${cls.name}`, totals.sum, totals.count);
            addTo(subjectAverages, subjectId, subject.name, totals.sum, totals.count);
        }

        const overallAverage = totalGradesCount > 0 ? totalGradesSum / totalGradesCount : 0;

        return NextResponse.json({
            academicYear: activeYear.name,
            periods: periods.map(p => ({ id: p.id, name: p.name })),
            activePeriodId,
            overallAverage: Number(overallAverage.toFixed(2)),
            totalEvaluations: totalGradesCount,
            performanceByLevel: averages(levelAverages),
            performanceByClass: averages(classAverages).slice(0, 10), // Top 10 classes
            performanceBySubject: averages(subjectAverages).slice(0, 10), // Top 10 subjects
        });

    } catch (error) {
        logger.error(" fetching performance stats:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] });
