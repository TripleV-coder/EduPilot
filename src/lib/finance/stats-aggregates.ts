import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { hasDateRange, type FinanceDateRange } from "@/lib/finance/helpers";

/**
 * Agrégats SQL des statistiques financières (`/api/finance/stats`) — M5.
 * Mêmes règles que `summarizePaymentPlans` et `buildPaymentDateWhere`, calculées
 * par PostgreSQL : la route ne charge plus les plans de paiement (toutes années
 * confondues) ni les encaissements ligne à ligne.
 *
 * Les colonnes DateTime sont des `timestamp` sans fuseau contenant l'heure UTC :
 * les bornes sont passées en ISO UTC et converties en `::timestamp`.
 */

const ts = (date: Date) => Prisma.sql`${date.toISOString()}::timestamp`;

/** Condition « date dans la période » (bornes incluses, chacune facultative). */
function withinRange(column: Prisma.Sql, range: FinanceDateRange): Prisma.Sql {
  const bounds: Prisma.Sql[] = [];
  if (range.startDate) bounds.push(Prisma.sql`${column} >= ${ts(range.startDate)}`);
  if (range.endDate) bounds.push(Prisma.sql`${column} <= ${ts(range.endDate)}`);
  return bounds.length ? Prisma.join(bounds, " AND ") : Prisma.sql`TRUE`;
}

/**
 * Encaissements (VERIFIED, RECONCILED) par mois UTC (`YYYY-MM`) de la date
 * d'encaissement, ou de création à défaut ; période appliquée comme
 * `buildPaymentDateWhere` (date d'encaissement, ou création si non encaissé).
 */
export async function collectedByUtcMonth(
  schoolId: string,
  range: FinanceDateRange,
): Promise<Array<{ month: string; amount: number }>> {
  const period = hasDateRange(range)
    ? Prisma.sql`AND ((${withinRange(Prisma.raw(`p."paidAt"`), range)}) OR (p."paidAt" IS NULL AND ${withinRange(Prisma.raw(`p."createdAt"`), range)}))`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<Array<{ month: string; amount: Prisma.Decimal | null }>>(Prisma.sql`
    SELECT to_char(COALESCE(p."paidAt", p."createdAt"), 'YYYY-MM') AS month, SUM(p.amount) AS amount
    FROM payments p
    JOIN fees f ON f.id = p."feeId"
    WHERE f."schoolId" = ${schoolId}
      AND p.status IN ('VERIFIED', 'RECONCILED')
      ${period}
    GROUP BY 1
    ORDER BY 1`);

  return rows.map((row) => ({ month: row.month, amount: Number(row.amount ?? 0) }));
}

/**
 * Montants attendus et restant dus des plans de paiement non annulés.
 * - sans période : total de chaque plan, reste = max(0, total − payé) ;
 * - avec période : plan à échéances → échéances dues dans la période (reste :
 *   celles ni payées ni annulées) ; plan sans échéance → pris en entier si la
 *   date d'échéance de son frais tombe dans la période.
 */
export async function summarizePaymentPlansInRange(
  schoolId: string,
  range: FinanceDateRange,
): Promise<{ totalExpected: number; totalPending: number }> {
  let rows: Array<{ expected: Prisma.Decimal | null; pending: Prisma.Decimal | null }>;

  if (!hasDateRange(range)) {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT SUM(pp."totalAmount") AS expected,
             SUM(GREATEST(0, pp."totalAmount" - pp."paidAmount")) AS pending
      FROM payment_plans pp
      JOIN fees f ON f.id = pp."feeId"
      WHERE f."schoolId" = ${schoolId} AND pp.status <> 'CANCELLED'`);
  } else {
    rows = await prisma.$queryRaw(Prisma.sql`
      SELECT SUM(x.expected) AS expected, SUM(x.pending) AS pending
      FROM (
        SELECT ip.amount AS expected,
               CASE WHEN ip.status IN ('PAID', 'CANCELLED') THEN 0 ELSE ip.amount END AS pending
        FROM installment_payments ip
        JOIN payment_plans pp ON pp.id = ip."paymentPlanId"
        JOIN fees f ON f.id = pp."feeId"
        WHERE f."schoolId" = ${schoolId} AND pp.status <> 'CANCELLED'
          AND ${withinRange(Prisma.raw(`ip."dueDate"`), range)}
        UNION ALL
        SELECT pp."totalAmount", GREATEST(0, pp."totalAmount" - pp."paidAmount")
        FROM payment_plans pp
        JOIN fees f ON f.id = pp."feeId"
        WHERE f."schoolId" = ${schoolId} AND pp.status <> 'CANCELLED'
          AND NOT EXISTS (SELECT 1 FROM installment_payments i WHERE i."paymentPlanId" = pp.id)
          AND f."dueDate" IS NOT NULL
          AND ${withinRange(Prisma.raw(`f."dueDate"`), range)}
      ) x`);
  }

  return {
    totalExpected: Number(rows[0]?.expected ?? 0),
    totalPending: Number(rows[0]?.pending ?? 0),
  };
}
