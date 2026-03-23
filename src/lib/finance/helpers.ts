import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type FinanceDateRange = {
  startDate?: Date;
  endDate?: Date;
};

type InstallmentLike = {
  id: string;
  amount: number | string | { toString(): string };
  dueDate: Date;
  paidAt?: Date | null;
  status: string;
};

type PaymentPlanLike = {
  totalAmount: number | string | { toString(): string };
  paidAmount: number | string | { toString(): string };
  fee: {
    dueDate: Date | null;
    classLevelCode?: string | null;
  };
  installmentPayments: InstallmentLike[];
};

type PaymentRecordLike = {
  amount: number | string | { toString(): string };
  paidAt: Date | null;
  createdAt: Date;
};

type PaymentPlanClient = Pick<Prisma.TransactionClient, "paymentPlan" | "payment" | "installmentPayment">;

function hasDateRange(range?: FinanceDateRange | null): boolean {
  return Boolean(range?.startDate || range?.endDate);
}

export function isWithinDateRange(date: Date, range?: FinanceDateRange | null): boolean {
  if (!range) return true;
  if (range.startDate && date < range.startDate) return false;
  if (range.endDate && date > range.endDate) return false;
  return true;
}

export function getEffectivePaymentDate(payment: PaymentRecordLike): Date {
  return payment.paidAt ?? payment.createdAt;
}

export function buildPaymentDateWhere(
  range?: FinanceDateRange | null
): Prisma.PaymentWhereInput {
  if (!hasDateRange(range)) {
    return {};
  }

  const paidAtFilter: Prisma.DateTimeNullableFilter = {};
  const createdAtFilter: Prisma.DateTimeFilter = {};

  if (range?.startDate) {
    paidAtFilter.gte = range.startDate;
    createdAtFilter.gte = range.startDate;
  }

  if (range?.endDate) {
    paidAtFilter.lte = range.endDate;
    createdAtFilter.lte = range.endDate;
  }

  return {
    OR: [
      { paidAt: paidAtFilter },
      {
        paidAt: null,
        createdAt: createdAtFilter,
      },
    ],
  };
}

export function isUnpaidInstallment(status: string): boolean {
  return status !== "PAID" && status !== "CANCELLED";
}

export function summarizePaymentPlans(
  plans: PaymentPlanLike[],
  range?: FinanceDateRange | null
): { totalExpected: number; totalPending: number } {
  let totalExpected = 0;
  let totalPending = 0;

  for (const plan of plans) {
    const totalAmount = Number(plan.totalAmount);
    const paidAmount = Number(plan.paidAmount);

    if (!hasDateRange(range)) {
      totalExpected += totalAmount;
      totalPending += Math.max(0, totalAmount - paidAmount);
      continue;
    }

    const relevantInstallments = plan.installmentPayments.filter((installment) =>
      isWithinDateRange(installment.dueDate, range)
    );

    if (relevantInstallments.length > 0) {
      totalExpected += relevantInstallments.reduce(
        (sum, installment) => sum + Number(installment.amount),
        0
      );
      totalPending += relevantInstallments
        .filter((installment) => isUnpaidInstallment(installment.status))
        .reduce((sum, installment) => sum + Number(installment.amount), 0);
      continue;
    }

    if (plan.fee.dueDate && isWithinDateRange(plan.fee.dueDate, range)) {
      totalExpected += totalAmount;
      totalPending += Math.max(0, totalAmount - paidAmount);
    }
  }

  return { totalExpected, totalPending };
}

export async function resolveFinanceDateRange(
  schoolId: string,
  period?: string | null,
  startDate?: string | null,
  endDate?: string | null
): Promise<FinanceDateRange> {
  if (startDate || endDate) {
    return {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };
  }

  const now = new Date();

  if (period === "month") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  if (period === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      startDate: new Date(now.getFullYear(), quarterStartMonth, 1),
      endDate: new Date(now.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999),
    };
  }

  if (period === "year") {
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  if (period === "academic") {
    const academicYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { startDate: true, endDate: true },
    });

    return {
      startDate: academicYear?.startDate,
      endDate: academicYear?.endDate,
    };
  }

  return {};
}

export async function resolvePreviousFinanceDateRange(
  schoolId: string,
  period: string | null | undefined,
  currentRange: FinanceDateRange
): Promise<FinanceDateRange> {
  if (!currentRange.startDate || !currentRange.endDate) {
    return {};
  }

  if (period === "month") {
    const previousEnd = new Date(currentRange.startDate.getTime() - 1);
    return {
      startDate: new Date(previousEnd.getFullYear(), previousEnd.getMonth(), 1),
      endDate: new Date(
        previousEnd.getFullYear(),
        previousEnd.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      ),
    };
  }

  if (period === "quarter") {
    const previousEnd = new Date(currentRange.startDate.getTime() - 1);
    const previousQuarterStartMonth = Math.floor(previousEnd.getMonth() / 3) * 3;
    return {
      startDate: new Date(previousEnd.getFullYear(), previousQuarterStartMonth, 1),
      endDate: new Date(
        previousEnd.getFullYear(),
        previousQuarterStartMonth + 3,
        0,
        23,
        59,
        59,
        999
      ),
    };
  }

  if (period === "year") {
    const previousYear = currentRange.startDate.getFullYear() - 1;
    return {
      startDate: new Date(previousYear, 0, 1),
      endDate: new Date(previousYear, 11, 31, 23, 59, 59, 999),
    };
  }

  if (period === "academic") {
    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: {
        schoolId,
        startDate: { lte: currentRange.startDate },
        endDate: { gte: currentRange.endDate },
      },
      select: { startDate: true },
    });

    if (!currentAcademicYear) {
      return {};
    }

    const previousAcademicYear = await prisma.academicYear.findFirst({
      where: {
        schoolId,
        endDate: { lt: currentAcademicYear.startDate },
      },
      orderBy: { endDate: "desc" },
      select: { startDate: true, endDate: true },
    });

    return {
      startDate: previousAcademicYear?.startDate,
      endDate: previousAcademicYear?.endDate,
    };
  }

  const duration = currentRange.endDate.getTime() - currentRange.startDate.getTime();
  const previousEnd = new Date(currentRange.startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return {
    startDate: previousStart,
    endDate: previousEnd,
  };
}

export async function syncPaymentPlanLedger(
  db: PaymentPlanClient,
  studentId: string,
  feeId: string
) {
  const paymentPlan = await db.paymentPlan.findFirst({
    where: {
      studentId,
      feeId,
      status: { not: "CANCELLED" },
    },
    include: {
      fee: {
        select: {
          dueDate: true,
        },
      },
      installmentPayments: {
        orderBy: { dueDate: "asc" },
      },
    },
  });

  if (!paymentPlan) {
    return null;
  }

  const payments = await db.payment.findMany({
    where: {
      studentId,
      feeId,
      status: { in: ["VERIFIED", "RECONCILED"] },
    },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: {
      amount: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const paymentQueue = payments.map((payment) => ({
    remaining: Number(payment.amount),
    paidAt: getEffectivePaymentDate(payment),
  }));

  const tolerance = 0.0001;
  let paymentIndex = 0;
  const now = new Date();

  for (const installment of paymentPlan.installmentPayments) {
    if (installment.status === "CANCELLED") {
      continue;
    }

    let remainingToCover = Number(installment.amount);
    let completedAt: Date | null = null;

    while (remainingToCover > tolerance && paymentIndex < paymentQueue.length) {
      const currentPayment = paymentQueue[paymentIndex];

      if (currentPayment.remaining <= tolerance) {
        paymentIndex += 1;
        continue;
      }

      const appliedAmount = Math.min(currentPayment.remaining, remainingToCover);
      currentPayment.remaining -= appliedAmount;
      remainingToCover -= appliedAmount;
      completedAt = currentPayment.paidAt;

      if (currentPayment.remaining <= tolerance) {
        paymentIndex += 1;
      }
    }

    const isPaid = remainingToCover <= tolerance;
    const nextStatus = isPaid
      ? "PAID"
      : installment.dueDate < now
        ? "OVERDUE"
        : "PENDING";

    await db.installmentPayment.update({
      where: { id: installment.id },
      data: {
        status: nextStatus,
        paidAt: isPaid ? completedAt : null,
      },
    });
  }

  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const refreshedInstallments = await db.installmentPayment.findMany({
    where: { paymentPlanId: paymentPlan.id },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      amount: true,
      dueDate: true,
      paidAt: true,
      status: true,
    },
  });

  const activeInstallments = refreshedInstallments.filter(
    (installment) => installment.status !== "CANCELLED"
  );
  const allInstallmentsPaid =
    activeInstallments.length > 0 &&
    activeInstallments.every((installment) => installment.status === "PAID");
  const hasOverdueInstallment = activeInstallments.some(
    (installment) => installment.status === "OVERDUE"
  );

  const feeIsOverdue =
    paymentPlan.fee.dueDate !== null &&
    paymentPlan.fee.dueDate < now &&
    totalPaid + tolerance < Number(paymentPlan.totalAmount);

  const nextPlanStatus =
    allInstallmentsPaid || totalPaid + tolerance >= Number(paymentPlan.totalAmount)
      ? "COMPLETED"
      : hasOverdueInstallment || feeIsOverdue
        ? "OVERDUE"
        : "ACTIVE";

  return db.paymentPlan.update({
    where: { id: paymentPlan.id },
    data: {
      paidAmount: totalPaid,
      status: nextPlanStatus,
    },
    include: {
      fee: true,
      installmentPayments: {
        orderBy: { dueDate: "asc" },
      },
    },
  });
}
