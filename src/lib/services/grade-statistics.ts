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
export async function aggregateGradeStatistics(scope: GradeStatsScope): Promise<GradeAggregate> {
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
            COUNT(*) FILTER (WHERE "v" >= 10)::int AS "passed",
            COUNT(*) FILTER (WHERE "v" >= 16)::int AS "excellent",
            COUNT(*) FILTER (WHERE "v" >= 14 AND "v" < 16)::int AS "good",
            COUNT(*) FILTER (WHERE "v" >= 10 AND "v" < 14)::int AS "fair",
            COUNT(*) FILTER (WHERE "v" < 10)::int AS "poor"
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

/** Classement des élèves du périmètre, meilleure moyenne d'abord. */
export async function rankStudents(scope: GradeStatsScope): Promise<RankedStudent[]> {
    const rows = await prisma.$queryRaw<
        Array<{ studentId: string; firstName: string; lastName: string; average: number; gradeCount: number }>
    >`
        SELECT g."studentId" AS "studentId", u."firstName" AS "firstName", u."lastName" AS "lastName",
               AVG(${NORMALIZED})::float8 AS "average", COUNT(*)::int AS "gradeCount"
        ${FROM}
        JOIN "student_profiles" sp ON sp."id" = g."studentId"
        JOIN "users" u ON u."id" = sp."userId"
        ${whereClause(scope)}
        GROUP BY g."studentId", u."firstName", u."lastName"
        ORDER BY "average" DESC, g."studentId"`;
    return rows.map((row) => ({
        studentId: row.studentId,
        studentName: `${row.firstName} ${row.lastName}`,
        average: row.average,
        gradeCount: row.gradeCount,
    }));
}
