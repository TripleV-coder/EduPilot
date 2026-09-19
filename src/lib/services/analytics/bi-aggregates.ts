import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Agrégats SQL du tableau de bord BI (`/api/analytics/bi`) — M5.
 * Rien n'est chargé ligne à ligne : PostgreSQL somme et moyenne, la route ne
 * reçoit que quelques lignes par établissement.
 */

/** Fuseau du serveur : les mois sont découpés en heure locale, comme les libellés de la série. */
const SERVER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export type BiScope = { schoolId: string; academicYearId?: string | null };

/**
 * Encaissements (VERIFIED, RECONCILED) par mois local (`YYYY-MM`), date
 * d'encaissement ou, à défaut, de création. Borne basse avec 2 jours de marge :
 * le filtre exact (mois de la fenêtre) est appliqué par l'appelant.
 */
export async function collectedByLocalMonth(
  scope: BiScope,
  since: Date,
): Promise<Array<{ month: string; amount: number }>> {
  const yearFilter = scope.academicYearId ? Prisma.sql`AND f."academicYearId" = ${scope.academicYearId}` : Prisma.empty;
  const lowerBound = new Date(since.getTime() - 2 * 86_400_000).toISOString();

  const rows = await prisma.$queryRaw<Array<{ month: string; amount: Prisma.Decimal | null }>>(Prisma.sql`
    SELECT to_char((COALESCE(p."paidAt", p."createdAt") AT TIME ZONE 'UTC') AT TIME ZONE ${SERVER_TIME_ZONE}, 'YYYY-MM') AS month,
           SUM(p.amount) AS amount
    FROM payments p
    JOIN fees f ON f.id = p."feeId"
    WHERE f."schoolId" = ${scope.schoolId} ${yearFilter}
      AND p.status IN ('VERIFIED', 'RECONCILED')
      AND COALESCE(p."paidAt", p."createdAt") >= ${lowerBound}::timestamp
    GROUP BY 1`);

  return rows.map((row) => ({ month: row.month, amount: Number(row.amount ?? 0) }));
}

/**
 * Dernier instantané d'analyse de CHAQUE élève de l'établissement (le plus
 * récent par `createdAt`) : nombre d'élèves, élèves à 10/20 ou plus (moyenne
 * absente comptée 0), moyenne par matière (moyenne absente comptée 0).
 */
export async function latestSnapshotStats(scope: BiScope): Promise<{
  total: number;
  passing: number;
  subjects: Array<{ subject: string; average: number }>;
}> {
  const yearFilter = scope.academicYearId ? Prisma.sql`AND sa."academicYearId" = ${scope.academicYearId}` : Prisma.empty;
  const latest = Prisma.sql`
    SELECT DISTINCT ON (sa."studentId") sa.id, sa."generalAverage"
    FROM student_analytics sa
    JOIN student_profiles sp ON sp.id = sa."studentId"
    JOIN users u ON u.id = sp."userId"
    WHERE u."schoolId" = ${scope.schoolId} ${yearFilter}
    ORDER BY sa."studentId", sa."createdAt" DESC, sa.id DESC`;

  const [counts, subjects] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number; passing: number }>>(Prisma.sql`
      WITH latest AS (${latest})
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE COALESCE(latest."generalAverage", 0) >= 10)::int AS passing
      FROM latest`),
    prisma.$queryRaw<Array<{ subject: string; average: Prisma.Decimal | null }>>(Prisma.sql`
      WITH latest AS (${latest})
      SELECT s.name AS subject, AVG(COALESCE(p.average, 0)) AS average
      FROM latest
      JOIN subject_performances p ON p."analyticsId" = latest.id
      JOIN subjects s ON s.id = p."subjectId"
      GROUP BY s.name`),
  ]);

  return {
    total: counts[0]?.total ?? 0,
    passing: counts[0]?.passing ?? 0,
    subjects: subjects.map((row) => ({ subject: row.subject, average: Number(row.average ?? 0) })),
  };
}
