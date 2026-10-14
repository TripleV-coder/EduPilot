/**
 * Statistiques de notes agrégées EN BASE (audit C3).
 *
 * Avant : toutes les notes du périmètre étaient chargées avec leurs relations
 * (131 000 sur la base de l'audit) puis agrégées en JavaScript — dépassement
 * de délai à 20 s. Ici, PostgreSQL renvoie directement les agrégats.
 *
 * Même règle que `normalizeGradeTo20` : valeur ramenée sur 20
 * (value / maxGrade × 20) ; sont exclues les notes supprimées, vides,
 * d'absents ou de dispensés, et les évaluations à barème nul.
 * Toutes les valeurs passent par Prisma.sql (requêtes paramétrées).
 */
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPassingGrade } from "@/lib/academic/grading-settings";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import { competitionRank } from "@/lib/academic/average-engine";
import { computeClassAnnual, computeClassPeriod } from "@/lib/academic/class-averages";

export interface GradeStatsScope {
    schoolId?: string | null;
    classId?: string | null;
    subjectId?: string | null;
    periodId?: string | null;
    /** Restreint aux notes de ces élèves ; tableau vide = aucune note. */
    studentIds?: string[] | null;
}

export interface GradeBucket {
    average: number;
    count: number;
}

export interface GradeAggregate {
    totalGrades: number;
    average: number;
    highest: number;
    lowest: number;
    passRate: number;
    gradeDistribution: { excellent: number; good: number; average: number; poor: number };
    bySubject: Record<string, GradeBucket>;
    byType: Record<string, GradeBucket>;
}

export interface RankedStudent {
    studentId: string;
    studentName: string;
    average: number;
    gradeCount: number;
    /** Rang olympique (ex aequo = même rang). */
    rank?: number;
    /** false : moyenne provisoire (année en cours, période manquante ou note à justifier). */
    complete?: boolean;
}

const FROM = Prisma.sql`
    FROM "grades" g
    JOIN "evaluations" e ON e."id" = g."evaluationId"
    JOIN "class_subjects" cs ON cs."id" = e."classSubjectId"
    JOIN "classes" c ON c."id" = cs."classId"`;

const NORMALIZED = Prisma.sql`(g."value" * 20.0 / e."maxGrade")`;

function whereClause(scope: GradeStatsScope): Prisma.Sql {
    const conditions: Prisma.Sql[] = [
        Prisma.sql`g."deletedAt" IS NULL`,
        Prisma.sql`g."value" IS NOT NULL`,
        Prisma.sql`g."isAbsent" = false`,
        Prisma.sql`g."isExcused" = false`,
        Prisma.sql`e."maxGrade" > 0`,
        // Les évaluations de compétence ne sont pas des notes de moyenne
        Prisma.sql`NOT EXISTS (SELECT 1 FROM "evaluation_types" et WHERE et."id" = e."typeId" AND (et."category" = 'COMPETENCE' OR lower(et."code") = 'competence'))`,
    ];
    if (scope.schoolId) conditions.push(Prisma.sql`c."schoolId" = ${scope.schoolId}`);
    if (scope.classId) conditions.push(Prisma.sql`cs."classId" = ${scope.classId}`);
    if (scope.subjectId) conditions.push(Prisma.sql`cs."subjectId" = ${scope.subjectId}`);
    if (scope.periodId) conditions.push(Prisma.sql`e."periodId" = ${scope.periodId}`);
    if (scope.studentIds) {
        conditions.push(
            scope.studentIds.length > 0
                ? Prisma.sql`g."studentId" IN (${Prisma.join(scope.studentIds)})`
                : Prisma.sql`false`,
        );
    }
    return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

/**
 * Une ligne par ensemble de regroupement : `gSubject`/`gType` valent 1 quand la
 * colonne n'est PAS regroupée (GROUPING) — (1, 1) global, (0, 1) par matière,
 * (1, 0) par type d'évaluation.
 */
type AggregateRow = {
    gSubject: number;
    gType: number;
    subject: string | null;
    type: string | null;
    total: number;
    average: number | null;
    highest: number | null;
    lowest: number | null;
    passed: number;
    excellent: number;
    good: number;
    fair: number;
    poor: number;
};

function buckets(rows: AggregateRow[], key: "subject" | "type"): Record<string, GradeBucket> {
    return Object.fromEntries(
        rows.map((row) => [row[key] ?? "", { average: row.average ?? 0, count: row.total }]),
    );
}

/**
 * Agrégats globaux, par matière et par type en UN seul parcours des notes
 * (GROUPING SETS) : les trois requêtes parallèles d'origine parcouraient
 * chacune toutes les notes du périmètre (578 → 271 ms sur la base de l'audit,
 * 129 575 notes ; EXPLAIN : parcours déjà indexés, coût = l'agrégation).
 */
export interface GradeBands {
    /** Seuil de passage de l'école (10 par défaut). */
    passingGrade: number;
    /** « Excellent » à partir de (16 par défaut). */
    excellentFrom: number;
    /** « Très bien » à partir de (14 par défaut). */
    veryGoodFrom: number;
}
export const DEFAULT_GRADE_BANDS: GradeBands = { passingGrade: 10, excellentFrom: 16, veryGoodFrom: 14 };

/** Bandes de l'école : seuil de passage (règles) + niveaux (paramètres « Niveaux de performance »). */
export async function gradeBandsForSchool(schoolId: string): Promise<GradeBands> {
    const [passingGrade, params] = await Promise.all([getPassingGrade(schoolId), getSchoolParameters(schoolId)]);
    return { passingGrade, excellentFrom: params.performance.excellentFrom, veryGoodFrom: params.performance.veryGoodFrom };
}

export async function aggregateGradeStatistics(scope: GradeStatsScope, bands: GradeBands = DEFAULT_GRADE_BANDS): Promise<GradeAggregate> {
    const { passingGrade, excellentFrom, veryGoodFrom } = bands;
    const rows = await prisma.$queryRaw<AggregateRow[]>`
        WITH n AS (
            SELECT ${NORMALIZED} AS "v", s."name" AS "subject", t."name" AS "type"
            ${FROM}
            JOIN "subjects" s ON s."id" = cs."subjectId"
            JOIN "evaluation_types" t ON t."id" = e."typeId"
            ${whereClause(scope)}
        )
        SELECT
            GROUPING("subject")::int AS "gSubject",
            GROUPING("type")::int AS "gType",
            "subject", "type",
            COUNT(*)::int AS "total",
            AVG("v")::float8 AS "average",
            MAX("v")::float8 AS "highest",
            MIN("v")::float8 AS "lowest",
            COUNT(*) FILTER (WHERE "v" >= ${passingGrade})::int AS "passed",
            COUNT(*) FILTER (WHERE "v" >= ${excellentFrom})::int AS "excellent",
            COUNT(*) FILTER (WHERE "v" >= ${veryGoodFrom} AND "v" < ${excellentFrom})::int AS "good",
            COUNT(*) FILTER (WHERE "v" >= ${passingGrade} AND "v" < ${veryGoodFrom})::int AS "fair",
            COUNT(*) FILTER (WHERE "v" < ${passingGrade})::int AS "poor"
        FROM n
        GROUP BY GROUPING SETS ((), ("subject"), ("type"))`;

    const overall = rows.find((row) => row.gSubject === 1 && row.gType === 1);
    const total = overall?.total ?? 0;
    return {
        totalGrades: total,
        average: overall?.average ?? 0,
        highest: overall?.highest ?? 0,
        lowest: overall?.lowest ?? 0,
        passRate: total > 0 ? ((overall?.passed ?? 0) / total) * 100 : 0,
        gradeDistribution: {
            excellent: overall?.excellent ?? 0,
            good: overall?.good ?? 0,
            average: overall?.fair ?? 0,
            poor: overall?.poor ?? 0,
        },
        bySubject: buckets(rows.filter((row) => row.gSubject === 0), "subject"),
        byType: buckets(rows.filter((row) => row.gType === 0), "type"),
    };
}

/** Moyenne normalisée du périmètre, ou `null` sans aucune note. */
export async function averageGrade(scope: GradeStatsScope): Promise<number | null> {
    const rows = await prisma.$queryRaw<Array<{ average: number | null }>>`
        SELECT AVG(${NORMALIZED})::float8 AS "average" ${FROM} ${whereClause(scope)}`;
    return rows[0]?.average ?? null;
}

/**
 * Classement d'une classe : même calcul que le bulletin (règles de l'école,
 * coefficients et règles gelés par le conseil, notes manquantes, élèves
 * inscrits actifs). Sur une période : moyenne de la période ; sans période :
 * moyenne annuelle de l'année en cours (provisoire tant qu'une période manque).
 */
export async function rankStudents(scope: GradeStatsScope): Promise<RankedStudent[]> {
    if (!scope.classId) return [];
    const klass = await prisma.class.findFirst({
        where: { id: scope.classId, ...(scope.schoolId ? { schoolId: scope.schoolId } : {}) },
        select: {
            schoolId: true,
            classSubjects: {
                where: scope.subjectId ? { subjectId: scope.subjectId } : {},
                select: { id: true, subjectId: true, coefficient: true },
            },
        },
    });
    if (!klass || klass.classSubjects.length === 0) return [];

    const period = scope.periodId
        ? await prisma.period.findUnique({ where: { id: scope.periodId }, select: { id: true, academicYearId: true } })
        : null;
    if (scope.periodId && !period) return [];
    const academicYearId =
        period?.academicYearId ??
        (await prisma.academicYear.findFirst({ where: { schoolId: klass.schoolId, isCurrent: true }, select: { id: true } }))?.id;
    if (!academicYearId) return [];

    let rows: Array<{ studentId: string; average: number | null; complete: boolean }>;
    if (period) {
        const result = await computeClassPeriod({
            classId: scope.classId,
            periodId: period.id,
            academicYearId,
            classSubjects: klass.classSubjects,
        });
        rows = Array.from(result.students.values()).map((st) => ({
            studentId: st.studentId,
            average: st.general,
            complete: st.averages.complete,
        }));
    } else {
        const result = await computeClassAnnual({ classId: scope.classId, academicYearId, classSubjects: klass.classSubjects });
        rows = Array.from(result.students.values()).map((st) => ({
            studentId: st.studentId,
            average: st.general ?? st.provisional,
            complete: st.annual.complete,
        }));
    }
    const ranked = rows.filter(
        (r): r is { studentId: string; average: number; complete: boolean } =>
            r.average !== null && (!scope.studentIds || scope.studentIds.includes(r.studentId)),
    );
    if (ranked.length === 0) return [];

    const ids = ranked.map((r) => r.studentId);
    const [profiles, counts] = await Promise.all([
        prisma.studentProfile.findMany({
            where: { id: { in: ids } },
            select: { id: true, user: { select: { firstName: true, lastName: true } } },
        }),
        prisma.grade.groupBy({
            by: ["studentId"],
            where: {
                studentId: { in: ids },
                deletedAt: null,
                evaluation: {
                    classSubjectId: { in: klass.classSubjects.map((cs) => cs.id) },
                    ...(period ? { periodId: period.id } : { period: { academicYearId } }),
                },
            },
            _count: { _all: true },
        }),
    ]);
    const names = new Map(profiles.map((p) => [p.id, `${p.user.firstName} ${p.user.lastName}`]));
    const countById = new Map(counts.map((c) => [c.studentId, c._count._all]));
    const all = ranked.map((r) => r.average);
    return ranked
        .map((r) => ({
            studentId: r.studentId,
            studentName: names.get(r.studentId) ?? r.studentId,
            average: r.average,
            gradeCount: countById.get(r.studentId) ?? 0,
            rank: competitionRank(r.average, all) ?? undefined,
            complete: r.complete,
        }))
        .sort((a, b) => b.average - a.average || a.studentId.localeCompare(b.studentId));
}
