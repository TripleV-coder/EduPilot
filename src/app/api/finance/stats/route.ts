import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  CACHE_TTL_MEDIUM,
  generateCacheKey,
  withCache,
} from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { roundTo } from "@/lib/analytics/helpers";
import {
  buildPaymentDateWhere,
  getEffectivePaymentDate,
  resolveFinanceDateRange,
  resolvePreviousFinanceDateRange,
  summarizePaymentPlans,
} from "@/lib/finance/helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

function calculateGrowth(currentValue: number, previousValue: number): number {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cacheKey = generateCacheKey("/api/finance/stats", url.searchParams, session.user.id);

  const handler = async () => {
    const activeSchoolId = getActiveSchoolId(session);
    const requestedSchoolId = url.searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    let schoolId = requestedSchoolId;

    // If no schoolId provided in URL, fallback to user's schoolId
    if (!schoolId && activeSchoolId) {
      schoolId = activeSchoolId;
    }

    if (!schoolId) {
      return NextResponse.json({ error: "Établissement (schoolId) requis" }, { status: 400 });
    }

    const period = url.searchParams.get("period") || "academic";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const [currentRange, plans, classLevels] = await Promise.all([
      resolveFinanceDateRange(schoolId, period, startDate, endDate),
      prisma.paymentPlan.findMany({
        where: {
          fee: { schoolId },
          status: { not: "CANCELLED" as const },
        },
        include: {
          fee: {
            select: {
              classLevelCode: true,
              dueDate: true,
            },
          },
          installmentPayments: {
            select: {
              id: true,
              amount: true,
              dueDate: true,
              status: true,
            },
          },
        },
      }),
      prisma.classLevel.findMany({
        where: { schoolId },
        select: { code: true, name: true },
      }),
    ]);

    const previousRange = await resolvePreviousFinanceDateRange(
      schoolId,
      period,
      currentRange
    );

    const [currentPayments, previousPayments] = await Promise.all([
      prisma.payment.findMany({
        where: {
          fee: { schoolId },
          status: { in: ["VERIFIED", "RECONCILED"] },
          ...buildPaymentDateWhere(currentRange),
        },
        select: {
          amount: true,
          paidAt: true,
          createdAt: true,
          fee: {
            select: {
              classLevelCode: true,
            },
          },
        },
        orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
      }),
      prisma.payment.findMany({
        where: {
          fee: { schoolId },
          status: { in: ["VERIFIED", "RECONCILED"] },
          ...buildPaymentDateWhere(previousRange),
        },
        select: {
          amount: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

    const currentPlanSummary = summarizePaymentPlans(plans, currentRange);
    const previousPlanSummary = summarizePaymentPlans(plans, previousRange);

    const totalRevenue = currentPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );
    const previousRevenue = previousPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    const classLevelByCode = new Map(
      classLevels.map((classLevel) => [classLevel.code, classLevel.name])
    );

    const revenueByMonthMap = new Map<string, number>();
    for (const payment of currentPayments) {
      const monthKey = getEffectivePaymentDate(payment).toISOString().slice(0, 7);
      revenueByMonthMap.set(
        monthKey,
        (revenueByMonthMap.get(monthKey) ?? 0) + Number(payment.amount)
      );
    }

    const revenueByCycleMap = new Map<string, number>();
    for (const payment of currentPayments) {
      const cycleKey = payment.fee.classLevelCode || "ALL_LEVELS";
      const cycleLabel =
        cycleKey === "ALL_LEVELS"
          ? "Tous niveaux"
          : classLevelByCode.get(cycleKey) || cycleKey;

      revenueByCycleMap.set(
        cycleLabel,
        (revenueByCycleMap.get(cycleLabel) ?? 0) + Number(payment.amount)
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
      revenueByMonth: Array.from(revenueByMonthMap.entries())
        .map(([month, amount]) => ({
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
}
