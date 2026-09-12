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

type OverallRow = {
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

type BucketRow = { name: string; average: number; count: number };

function buckets(rows: BucketRow[]): Record<string, GradeBucket> {
    return Object.fromEntries(rows.map((row) => [row.name, { average: row.average, count: row.count }]));
}

export async function aggregateGradeStatistics(scope: GradeStatsScope): Promise<GradeAggregate> {
    const where = whereClause(scope);

    const [overallRows, subjectRows, typeRows] = await Promise.all([
        prisma.$queryRaw<OverallRow[]>`
            SELECT
                COUNT(*)::int AS "total",
                AVG(${NORMALIZED})::float8 AS "average",
                MAX(${NORMALIZED})::float8 AS "highest",
                MIN(${NORMALIZED})::float8 AS "lowest",
                COUNT(*) FILTER (WHERE ${NORMALIZED} >= 10)::int AS "passed",
                COUNT(*) FILTER (WHERE ${NORMALIZED} >= 16)::int AS "excellent",
                COUNT(*) FILTER (WHERE ${NORMALIZED} >= 14 AND ${NORMALIZED} < 16)::int AS "good",
                COUNT(*) FILTER (WHERE ${NORMALIZED} >= 10 AND ${NORMALIZED} < 14)::int AS "fair",
                COUNT(*) FILTER (WHERE ${NORMALIZED} < 10)::int AS "poor"
            ${FROM} ${where}`,
        prisma.$queryRaw<BucketRow[]>`
            SELECT s."name" AS "name", AVG(${NORMALIZED})::float8 AS "average", COUNT(*)::int AS "count"
            ${FROM} JOIN "subjects" s ON s."id" = cs."subjectId"
            ${where}
            GROUP BY s."name"`,
        prisma.$queryRaw<BucketRow[]>`
            SELECT t."name" AS "name", AVG(${NORMALIZED})::float8 AS "average", COUNT(*)::int AS "count"
            ${FROM} JOIN "evaluation_types" t ON t."id" = e."typeId"
            ${where}
            GROUP BY t."name"`,
    ]);

    const overall = overallRows[0];
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
        bySubject: buckets(subjectRows),
        byType: buckets(typeRows),
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
