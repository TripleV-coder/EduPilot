/**
 * Requêtes allégées des tableaux de bord (audit C3).
 *
 * Avant : chaque tableau de bord chargeait toutes les analyses de l'année
 * AVEC l'élève, ses inscriptions et toutes ses performances par matière
 * (~30 000 lignes sur la base de l'audit ; 1,8 à 2 s par appel), pour n'en
 * tirer que des moyennes, des répartitions, un résumé par matière et cinq
 * élèves à risque. Ici :
 *   - les analyses sont lues avec les seuls champs utiles aux indicateurs ;
 *   - le résumé par matière est calculé par PostgreSQL (groupBy) ;
 *   - les noms et classes ne sont chargés que pour les élèves affichés.
 * Les résultats sont identiques (voir tests/integration-db/analytics-dashboard.test.ts).
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { roundTo } from "@/lib/analytics/helpers";

export const DASHBOARD_ANALYTICS_SELECT = {
    id: true,
    studentId: true,
    periodId: true,
    generalAverage: true,
    performanceLevel: true,
    riskLevel: true,
    analyzedAt: true,
    createdAt: true,
    period: { select: { id: true, name: true, sequence: true } },
} satisfies Prisma.StudentAnalyticsSelect;

export type DashboardAnalytics = Prisma.StudentAnalyticsGetPayload<{ select: typeof DASHBOARD_ANALYTICS_SELECT }>;

/**
 * Moyenne des performances non nulles par matière pour ces analyses,
 * décroissante — même résultat que `buildSubjectSummary`.
 */
export async function summarizeSubjects(analyticsIds: string[], filterSubjectId?: string) {
    if (analyticsIds.length === 0) return [];

    const rows = await prisma.subjectPerformance.groupBy({
        by: ["subjectId"],
        where: {
            analyticsId: { in: analyticsIds },
            average: { not: null },
            ...(filterSubjectId ? { subjectId: filterSubjectId } : {}),
        },
        _avg: { average: true },
    });
    if (rows.length === 0) return [];

    const subjects = await prisma.subject.findMany({
        where: { id: { in: rows.map((row) => row.subjectId) } },
        select: { id: true, name: true },
    });
    const names = new Map(subjects.map((subject) => [subject.id, subject.name]));

    return rows
        .map((row) => ({ name: names.get(row.subjectId) ?? "", average: roundTo(Number(row._avg.average ?? 0)) }))
        .sort((left, right) => right.average - left.average);
}

/**
 * Cinq élèves HIGH/CRITICAL de plus faible moyenne, avec nom et classe active
 * de l'année — même résultat que `buildAtRiskStudents`, sans charger tous les élèves.
 */
export async function loadAtRiskStudents(
    analytics: Array<Pick<DashboardAnalytics, "studentId" | "generalAverage" | "riskLevel">>,
    yearId: string,
) {
    const selected = analytics
        .filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL")
        .sort((left, right) => Number(left.generalAverage || 0) - Number(right.generalAverage || 0))
        .slice(0, 5);
    if (selected.length === 0) return [];

    const students = await prisma.studentProfile.findMany({
        where: { id: { in: selected.map((item) => item.studentId) } },
        select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
                where: { academicYearId: yearId, status: "ACTIVE" },
                select: { class: { select: { name: true } } },
            },
        },
    });
    const byId = new Map(students.map((student) => [student.id, student]));

    return selected.map((item) => {
        const student = byId.get(item.studentId);
        return {
            id: item.studentId,
            name: student ? `${student.user.firstName} ${student.user.lastName}` : "Indisponible",
            className: student?.enrollments[0]?.class?.name || "Indisponible",
            average: Number(item.generalAverage),
            riskLevel: (item.riskLevel || "").toLowerCase(),
        };
    });
}
