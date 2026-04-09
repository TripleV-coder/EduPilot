import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { roundTo } from "@/lib/analytics/helpers";
import {
  buildPaymentDateWhere,
  getEffectivePaymentDate,
  isUnpaidInstallment,
  type FinanceDateRange,
} from "@/lib/finance/helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for Finance Dashboard data
 */

function isWithinRange(date: Date, range?: FinanceDateRange | null): boolean {
  if (!range) return true;
  if (range.startDate && date < range.startDate) return false;
  if (range.endDate && date > range.endDate) return false;
  return true;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const querySchoolId = searchParams.get("schoolId");
    const academicYearId = searchParams.get("academicYearId");
    const periodId = searchParams.get("periodId");
    const schoolAccess = ensureRequestedSchoolAccess(session, querySchoolId);
    if (schoolAccess) return schoolAccess;
    const activeSchoolId = getActiveSchoolId(session);

    const schoolId = querySchoolId || activeSchoolId;

    if (!schoolId) {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    const feeScope = {
      schoolId,
      ...(academicYearId ? { academicYearId } : {}),
    };

    let periodRange: FinanceDateRange | null = null;
    if (periodId) {
      const period = await prisma.period.findUnique({ where: { id: periodId } });
      if (period) {
        periodRange = {
          startDate: period.startDate,
          endDate: period.endDate,
        };
      }
    }

    // Build base where clause
    const paymentWhere: Record<string, unknown> = {
      fee: feeScope,
    };
    Object.assign(paymentWhere, buildPaymentDateWhere(periodRange));

    // Get current date for trend calculations
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const trendRange = periodRange ?? {
      startDate: thirtyDaysAgo,
      endDate: now,
    };

    // Fetch summary data
    const [
      totalCollected,
      recentPayments,
      paymentPlans,
      paymentsTrend,
    ] = await Promise.all([
      // Total collected payments
      prisma.payment.aggregate({
        where: {
          ...paymentWhere,
          status: { in: ["VERIFIED", "RECONCILED"] },
        },
        _sum: { amount: true },
      }),

      // Recent payments
      prisma.payment.findMany({
        where: paymentWhere,
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          fee: { select: { name: true } },
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: 10,
      }),

      prisma.paymentPlan.findMany({
        where: {
          fee: feeScope,
          status: { not: "CANCELLED" },
        },
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          fee: { select: { name: true, dueDate: true } },
          installmentPayments: {
            select: { amount: true, dueDate: true, status: true },
          },
        },
      }),

      // Payments trend for the last 30 days
      prisma.payment.findMany({
        where: {
          fee: feeScope,
          status: { in: ["VERIFIED", "RECONCILED"] },
          ...buildPaymentDateWhere(trendRange),
        },
        select: { amount: true, paidAt: true, createdAt: true },
        orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    let totalFeesAmount = 0;
    let totalPendingAmount = 0;
    const overdueBalances = new Map<
      string,
      { studentId: string; studentName: string; balance: number }
    >();

    for (const plan of paymentPlans) {
      const studentName = `${plan.student.user.firstName} ${plan.student.user.lastName}`;
      const totalAmount = Number(plan.totalAmount);
      const paidAmount = Number(plan.paidAmount);
      const balance = Math.max(0, totalAmount - paidAmount);

      if (periodRange) {
        const relevantInstallments = plan.installmentPayments.filter((installment) =>
          isWithinRange(installment.dueDate, periodRange)
        );
        const hasInstallmentsInRange = relevantInstallments.length > 0;
        const feeDueInRange =
          plan.fee.dueDate !== null && isWithinRange(plan.fee.dueDate, periodRange);
        const expectedAmount = hasInstallmentsInRange
          ? relevantInstallments.reduce(
              (sum, installment) => sum + Number(installment.amount),
              0
            )
          : feeDueInRange
            ? totalAmount
            : 0;
        const pendingAmount = hasInstallmentsInRange
          ? relevantInstallments
              .filter((installment) => isUnpaidInstallment(installment.status))
              .reduce((sum, installment) => sum + Number(installment.amount), 0)
          : feeDueInRange
            ? balance
            : 0;

        totalFeesAmount += expectedAmount;
        totalPendingAmount += pendingAmount;

        const overdueAmount = hasInstallmentsInRange
          ? relevantInstallments
              .filter(
                (installment) =>
                  isUnpaidInstallment(installment.status) && installment.dueDate <= now
              )
              .reduce((sum, installment) => sum + Number(installment.amount), 0)
          : feeDueInRange && plan.fee.dueDate !== null && plan.fee.dueDate <= now
            ? balance
            : 0;

        if (overdueAmount > 0) {
          const current = overdueBalances.get(plan.studentId) ?? {
            studentId: plan.studentId,
            studentName,
            balance: 0,
          };
          current.balance += overdueAmount;
          overdueBalances.set(plan.studentId, current);
        }

        continue;
      }

      totalFeesAmount += totalAmount;
      totalPendingAmount += balance;

      const hasOverdueInstallment = plan.installmentPayments.some(
        (installment) =>
          isUnpaidInstallment(installment.status) && installment.dueDate <= now
      );
      const isFeeOverdue =
        plan.fee.dueDate !== null && plan.fee.dueDate <= now && balance > 0;

      if (balance > 0 && (hasOverdueInstallment || isFeeOverdue || plan.status === "OVERDUE")) {
        overdueBalances.set(plan.studentId, {
          studentId: plan.studentId,
          studentName,
          balance,
        });
      }
    }

    const overdueStudentsWithBalance = Array.from(overdueBalances.values())
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    const totalCollectedAmount = Number(totalCollected._sum.amount) || 0;
    const collectionRate = totalFeesAmount > 0
      ? (totalCollectedAmount / totalFeesAmount) * 100
      : 0;

    // Calculate payments trend by day
    const paymentsByDay = paymentsTrend.reduce((acc, payment) => {
      const dateKey = getEffectivePaymentDate(payment).toISOString().split("T")[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, amount: 0, count: 0 };
      }
      acc[dateKey].amount += Number(payment.amount);
      acc[dateKey].count += 1;
      return acc;
    }, {} as Record<string, { date: string; amount: number; count: number }>);

    const paymentsTrendArray = Object.values(paymentsByDay).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      summary: {
        totalFees: roundTo(totalFeesAmount),
        totalCollected: totalCollectedAmount,
        totalPending: roundTo(totalPendingAmount),
        collectionRate: roundTo(collectionRate),
      },
      recentPayments,
      overdueStudents: overdueStudentsWithBalance,
      paymentsTrend: paymentsTrendArray,
    });
  } catch (error) {
    logger.error("Finance dashboard error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du dashboard financier" },
      { status: 500 }
    );
  }
}
