import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import {
  CACHE_TTL_MEDIUM,
  generateCacheKey,
  withCache,
} from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { roundTo } from "@/lib/analytics/helpers";
import {
  buildPaymentDateWhere,
  resolveFinanceDateRange,
  resolvePreviousFinanceDateRange,
} from "@/lib/finance/helpers";
import { collectedByUtcMonth, summarizePaymentPlansInRange } from "@/lib/finance/stats-aggregates";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

function calculateGrowth(currentValue: number, previousValue: number): number {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

/**
 * GET /api/finance/stats — indicateurs financiers d'un établissement sur une
 * période, comparés à la période précédente. Tout est agrégé par PostgreSQL
 * (M5) : ni les plans de paiement (toutes années confondues) ni les
 * encaissements ne sont chargés ligne à ligne.
 */
export const GET = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const url = new URL(request.url);
    const cacheKey = generateCacheKey("/api/finance/stats", url.searchParams, session.user.id);

    const handler = async () => {
      const activeSchoolId = getActiveSchoolId(session);
      const requestedSchoolId = url.searchParams.get("schoolId");
      const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
      if (schoolAccess) return schoolAccess;
      let schoolId = requestedSchoolId;

      if (!schoolId && activeSchoolId) {
        schoolId = activeSchoolId;
      }

      if (!schoolId) {
        return NextResponse.json({ error: "Établissement (schoolId) requis" }, { status: 400 });
      }

      const period = url.searchParams.get("period") || "academic";
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");

      const currentRange = await resolveFinanceDateRange(schoolId, period, startDate, endDate);
      const previousRange = await resolvePreviousFinanceDateRange(schoolId, period, currentRange);
      const collectedWhere = (range: typeof currentRange) => ({
        fee: { schoolId },
        status: { in: ["VERIFIED" as const, "RECONCILED" as const] },
        ...buildPaymentDateWhere(range),
      });

      const [classLevels, fees, currentByFee, previousCollected, revenueByMonth, currentPlanSummary, previousPlanSummary] =
        await Promise.all([
          prisma.classLevel.findMany({
            where: { schoolId },
            select: { code: true, name: true },
          }),
          // Définitions de frais de l'établissement (par niveau et par nature) :
          // bornées par nature, pour rattacher chaque encaissement à son cycle.
          prisma.fee.findMany({
            where: { schoolId },
            select: { id: true, classLevelCode: true },
          }),
          prisma.payment.groupBy({
            by: ["feeId"],
            where: collectedWhere(currentRange),
            _sum: { amount: true },
          }),
          prisma.payment.aggregate({
            where: collectedWhere(previousRange),
            _sum: { amount: true },
          }),
          collectedByUtcMonth(schoolId, currentRange),
          summarizePaymentPlansInRange(schoolId, currentRange),
          summarizePaymentPlansInRange(schoolId, previousRange),
        ]);

      const totalRevenue = currentByFee.reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
      const previousRevenue = Number(previousCollected._sum.amount ?? 0);

      const classLevelByCode = new Map(
        classLevels.map((classLevel) => [classLevel.code, classLevel.name])
      );
      const classLevelCodeByFee = new Map(fees.map((fee) => [fee.id, fee.classLevelCode]));

      const revenueByCycleMap = new Map<string, number>();
      for (const row of currentByFee) {
        const cycleKey = classLevelCodeByFee.get(row.feeId) || "ALL_LEVELS";
        const cycleLabel =
          cycleKey === "ALL_LEVELS"
            ? "Tous niveaux"
            : classLevelByCode.get(cycleKey) || cycleKey;

        revenueByCycleMap.set(
          cycleLabel,
          (revenueByCycleMap.get(cycleLabel) ?? 0) + Number(row._sum.amount ?? 0)
        );
      }

      const collectionRate =
        currentPlanSummary.totalExpected > 0
          ? (totalRevenue / currentPlanSummary.totalExpected) * 100
          : 0;

      return NextResponse.json({
        totalRevenue: roundTo(totalRevenue),
        totalPending: roundTo(currentPlanSummary.totalPending),
        collectionRate: roundTo(collectionRate),
        revenueByMonth: revenueByMonth
          .map(({ month, amount }) => ({
            month,
            amount: roundTo(amount),
          }))
          .sort((left, right) => left.month.localeCompare(right.month)),
        revenueByCycle: Array.from(revenueByCycleMap.entries())
          .map(([name, value]) => ({
            name,
            value: roundTo(value),
          }))
          .sort((left, right) => right.value - left.value),
        revenueGrowth: roundTo(calculateGrowth(totalRevenue, previousRevenue)),
        pendingGrowth: roundTo(
          calculateGrowth(
            currentPlanSummary.totalPending,
            previousPlanSummary.totalPending
          )
        ),
      });
    };

    try {
      const response = await withCache(
        handler as () => Promise<NextResponse<Record<string, unknown>>>,
        {
          ttl: CACHE_TTL_MEDIUM,
          key: cacheKey,
        }
      );

      return withHttpCache(response, request, {
        private: true,
        maxAge: CACHE_TTL_MEDIUM,
        staleWhileRevalidate: 30,
      });
    } catch (error) {
      logger.error(
        "Error fetching finance stats",
        error instanceof Error ? error : new Error(String(error)),
        {
          module: "api/finance/stats",
          userId: session.user.id,
        }
      );
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"] }
);
