/**
 * Requêtes allégées des tableaux de bord analytiques (audit C3).
 *
 * Avant : chaque tableau de bord chargeait toutes les analyses de l'année
 * AVEC l'élève, ses inscriptions et toutes ses performances par matière
 * (~30 000 lignes sur la base de l'audit ; 1,7 à 2 s par appel), pour n'en
 * tirer que des moyennes, des répartitions, un résumé par matière et quelques
 * élèves nommés. Ici :
 *   - les analyses sont lues avec les seuls champs utiles aux indicateurs ;
 *   - les résumés par matière sont calculés par PostgreSQL (groupBy) ;
 *   - les noms et classes ne sont chargés que pour les élèves affichés.
 * Réponses identiques : tests/integration-db/analytics-dashboard.test.ts et
 * analytics-school-overview.test.ts (caractérisation).
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

export type StudentIdentity = {
    user: { firstName: string; lastName: string };
    /** Classe de l'inscription active de l'année, null sans inscription. */
    className: string | null;
};

/** Nom et classe active de l'année pour ces seuls élèves. */
export async function loadStudentIdentities(studentIds: string[], yearId: string): Promise<Map<string, StudentIdentity>> {
    const ids = [...new Set(studentIds)];
    if (ids.length === 0) return new Map();

    const students = await prisma.studentProfile.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
                where: { academicYearId: yearId, status: "ACTIVE" },
                select: { class: { select: { name: true } } },
            },
        },
    });

    return new Map(
        students.map((student) => [student.id, { user: student.user, className: student.enrollments[0]?.class?.name ?? null }]),
    );
}

async function subjectNames(subjectIds: string[]) {
    const subjects = await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true },
    });
    return new Map(subjects.map((subject) => [subject.id, subject.name]));
}

/** Tri décroissant par moyenne, puis par nom pour un ordre stable. */
function byAverageThenName(left: { name: string; average: number }, right: { name: string; average: number }) {
    return right.average - left.average || left.name.localeCompare(right.name, "fr");
}

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

    const names = await subjectNames(rows.map((row) => row.subjectId));
    return rows
        .map((row) => ({ name: names.get(row.subjectId) ?? "", average: roundTo(Number(row._avg.average ?? 0)) }))
        .sort(byAverageThenName);
}

/**
 * Résumé par matière avec taux de réussite (moyenne ≥ 10) et effectif noté,
 * pour la vue d'ensemble de l'établissement.
 */
export async function summarizeSubjectsWithPassRate(analyticsIds: string[]) {
    if (analyticsIds.length === 0) return [];

    const [rows, passes] = await Promise.all([
        prisma.subjectPerformance.groupBy({
            by: ["subjectId"],
            where: { analyticsId: { in: analyticsIds }, average: { not: null } },
            _avg: { average: true },
            _count: { _all: true },
        }),
        prisma.subjectPerformance.groupBy({
            by: ["subjectId"],
            where: { analyticsId: { in: analyticsIds }, average: { gte: 10 } },
            _count: { _all: true },
        }),
    ]);
    if (rows.length === 0) return [];

    const names = await subjectNames(rows.map((row) => row.subjectId));
    const passCounts = new Map(passes.map((row) => [row.subjectId, row._count._all]));

    return rows
        .map((row) => {
            const name = names.get(row.subjectId) ?? "";
            const count = row._count._all;
            const average = roundTo(Number(row._avg.average ?? 0));
            return {
                subjectId: row.subjectId,
                subject: name,
                name, // compatibility
                grade: average,
                average, // compatibility
                passRate: count > 0 ? roundTo(((passCounts.get(row.subjectId) ?? 0) / count) * 100) : 0,
                studentsCount: count,
            };
        })
        .sort(byAverageThenName);
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

    const identities = await loadStudentIdentities(selected.map((item) => item.studentId), yearId);

    return selected.map((item) => {
        const identity = identities.get(item.studentId);
        return {
            id: item.studentId,
            name: identity ? `${identity.user.firstName} ${identity.user.lastName}` : "Indisponible",
            className: identity?.className || "Indisponible",
            average: Number(item.generalAverage),
            riskLevel: (item.riskLevel || "").toLowerCase(),
        };
    });
}
