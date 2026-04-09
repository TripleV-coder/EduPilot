import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  buildPaymentDateWhere,
  getEffectivePaymentDate,
  resolveFinanceDateRange,
  type FinanceDateRange,
} from "@/lib/finance/helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for generating financial reports
 */

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const activeSchoolId = getActiveSchoolId(session);
    const schoolId = requestedSchoolId || activeSchoolId;
    const academicYearId = searchParams.get("academicYearId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const period = searchParams.get("period");
    const reportType = searchParams.get("reportType") || "summary";

    if (!schoolId) {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    // Get school info
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, address: true, phone: true, email: true },
    });

    if (!school) {
      return NextResponse.json({ error: "Établissement non trouvé" }, { status: 404 });
    }

    const resolvedRange = await resolveFinanceDateRange(
      schoolId,
      period,
      startDate,
      endDate
    );

    // Fetch data based on report type
    let reportData: Record<string, unknown>;

    switch (reportType) {
      case "summary":
        reportData = await generateSummaryReport(schoolId, academicYearId, resolvedRange);
        break;
      case "payments":
        reportData = await generatePaymentsReport(schoolId, academicYearId, resolvedRange);
        break;
      case "fees":
        reportData = await generateFeesReport(schoolId, academicYearId);
        break;
      case "outstanding":
        reportData = await generateOutstandingReport(schoolId, academicYearId);
        break;
      case "reconciliation":
        reportData = await generateReconciliationReport(schoolId);
        break;
      case "collection":
        reportData = await generateCollectionReport(schoolId, academicYearId, resolvedRange);
        break;
      default:
        reportData = await generateSummaryReport(schoolId, academicYearId, resolvedRange);
    }

    return NextResponse.json({
      success: true,
      reportType,
      school: {
        name: school.name,
        address: school.address,
        phone: school.phone,
        email: school.email,
      },
      period: {
        start: resolvedRange.startDate?.toISOString() || null,
        end: resolvedRange.endDate?.toISOString() || null,
      },
      generatedAt: new Date().toISOString(),
      data: reportData,
      pdfUrl: null,
    });
  } catch (error) {
    logger.error("Report generation error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du rapport" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const activeSchoolId = getActiveSchoolId(session);
    const schoolId = requestedSchoolId || activeSchoolId;
    const academicYearId = searchParams.get("academicYearId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const period = searchParams.get("period");
    const reportType = searchParams.get("reportType") || "summary";

    if (!schoolId) {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, address: true, phone: true, email: true },
    });

    if (!school) {
      return NextResponse.json({ error: "Établissement non trouvé" }, { status: 404 });
    }

    const resolvedRange = await resolveFinanceDateRange(
      schoolId,
      period,
      startDate,
      endDate
    );

    let reportData: Record<string, unknown>;

    switch (reportType) {
      case "payments":
        reportData = await generatePaymentsReport(schoolId, academicYearId, resolvedRange);
        break;
      case "fees":
        reportData = await generateFeesReport(schoolId, academicYearId);
        break;
      case "outstanding":
        reportData = await generateOutstandingReport(schoolId, academicYearId);
        break;
      case "reconciliation":
        reportData = await generateReconciliationReport(schoolId);
        break;
      case "collection":
        reportData = await generateCollectionReport(schoolId, academicYearId, resolvedRange);
        break;
      default:
        reportData = await generateSummaryReport(schoolId, academicYearId, resolvedRange);
        break;
    }

    const reportContent = generatePDFContent(school, reportType, reportData, {
      startDate: resolvedRange.startDate,
      endDate: resolvedRange.endDate,
    });

    return new Response(reportContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="rapport-financier-${reportType}.txt"`,
      },
    });
  } catch (error) {
    logger.error("Report export error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'export du rapport" },
      { status: 500 }
    );
  }
}

// Report generation helper functions
async function generateSummaryReport(
  schoolId: string,
  academicYearId?: string | null,
  dateRange: FinanceDateRange = {}
) {
  const planWhere = {
    fee: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
    status: { not: "CANCELLED" as const },
  };

  const [plans, payments] = await Promise.all([
    prisma.paymentPlan.findMany({
      where: {
        ...planWhere,
      },
      select: {
        id: true,
        totalAmount: true,
        paidAmount: true,
        studentId: true,
        fee: {
          select: {
            dueDate: true,
          }
        },
        installmentPayments: {
          select: {
            amount: true,
            dueDate: true,
            status: true,
          },
        },
      },
      take: 2000, // Safety limit to prevent memory DoS
    }),
    prisma.payment.findMany({
      where: {
        fee: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
        status: { in: ["VERIFIED", "RECONCILED"] },
        ...buildPaymentDateWhere(dateRange),
      },
      select: { amount: true, paidAt: true, createdAt: true },
    }),
  ]);

  let totalExpected = 0;
  let totalPending = 0;
  let pendingCount = 0;
  const hasRange = Boolean(dateRange.startDate || dateRange.endDate);

  for (const plan of plans) {
    const relevantInstallments = hasRange
      ? plan.installmentPayments.filter((installment) => {
        if (dateRange.startDate && installment.dueDate < dateRange.startDate) return false;
        if (dateRange.endDate && installment.dueDate > dateRange.endDate) return false;
        return true;
      })
      : plan.installmentPayments;

    const expectedAmount =
      relevantInstallments.length > 0
        ? relevantInstallments.reduce(
          (sum, installment) => sum + Number(installment.amount),
          0
        )
        : !hasRange
          ? Number(plan.totalAmount)
          : plan.fee.dueDate &&
            (!dateRange.startDate || plan.fee.dueDate >= dateRange.startDate) &&
            (!dateRange.endDate || plan.fee.dueDate <= dateRange.endDate)
            ? Number(plan.totalAmount)
            : 0;

    const pendingAmount =
      relevantInstallments.length > 0
        ? relevantInstallments
          .filter((installment) => installment.status !== "PAID" && installment.status !== "CANCELLED")
          .reduce((sum, installment) => sum + Number(installment.amount), 0)
        : !hasRange
          ? Math.max(0, Number(plan.totalAmount) - Number(plan.paidAmount))
          : plan.fee.dueDate &&
            (!dateRange.startDate || plan.fee.dueDate >= dateRange.startDate) &&
            (!dateRange.endDate || plan.fee.dueDate <= dateRange.endDate)
            ? Math.max(0, Number(plan.totalAmount) - Number(plan.paidAmount))
            : 0;

    totalExpected += expectedAmount;
    totalPending += pendingAmount;

    if (pendingAmount > 0) {
      pendingCount += 1;
    }
  }

  const totalCollected = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  return {
    totalFees: totalExpected,
    feesCount: plans.length,
    totalCollected,
    paymentsCount: payments.length,
    totalPending,
    pendingCount,
    totalPaidOnPlans: totalExpected - totalPending,
  };
}

async function generatePaymentsReport(
  schoolId: string,
  academicYearId?: string | null,
  dateRange: FinanceDateRange = {}
) {
  const where: Record<string, unknown> = {
    fee: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
    ...buildPaymentDateWhere(dateRange),
  };

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      fee: { select: { name: true } },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 500, // Limit for performance
  });

  return {
    payments: payments.map((p) => ({
      id: p.id,
      date: getEffectivePaymentDate(p).toISOString(),
      student: `${p.student?.user.firstName} ${p.student?.user.lastName}`,
      fee: p.fee?.name,
      amount: p.amount,
      method: p.method,
      status: p.status,
    })),
    totalCount: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
  };
}

async function generateFeesReport(
  schoolId: string,
  academicYearId?: string | null
) {
  const where: Record<string, unknown> = { schoolId, isActive: true };
  if (academicYearId) where.academicYearId = academicYearId;

  const fees = await prisma.fee.findMany({
    where,
    include: {
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    fees: fees.map((f) => ({
      id: f.id,
      name: f.name,
      amount: f.amount,
      dueDate: f.dueDate,
      paymentsCount: f._count.payments,
      isRequired: f.isRequired,
    })),
    totalFees: fees.reduce((sum, f) => sum + Number(f.amount), 0),
  };
}

async function generateOutstandingReport(
  schoolId: string,
  academicYearId?: string | null
) {
  const plans = await prisma.paymentPlan.findMany({
    where: {
      fee: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
      status: { not: "CANCELLED" as const },
    },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const outstandingByStudent = new Map<
    string,
    { studentId: string; name: string; totalOutstanding: number; paymentCount: number }
  >();

  for (const plan of plans) {
    const balance = Math.max(0, Number(plan.totalAmount) - Number(plan.paidAmount));
    if (balance <= 0) continue;

    const current = outstandingByStudent.get(plan.studentId) ?? {
      studentId: plan.studentId,
      name: `${plan.student.user.firstName} ${plan.student.user.lastName}`,
      totalOutstanding: 0,
      paymentCount: 0,
    };

    current.totalOutstanding += balance;
    current.paymentCount += 1;
    outstandingByStudent.set(plan.studentId, current);
  }

  const outstanding = Array.from(outstandingByStudent.values())
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  return {
    outstandingStudents: outstanding,
    totalOutstanding: outstanding.reduce((sum, s) => sum + s.totalOutstanding, 0),
    studentCount: outstanding.length,
  };
}

async function generateReconciliationReport(schoolId: string) {
  const unreconciled = await prisma.payment.findMany({
    where: {
      fee: { schoolId },
      status: "VERIFIED",
      reconciledAt: null,
    },
    include: {
      student: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      fee: { select: { name: true } },
    },
    orderBy: { paidAt: "desc" },
  });

  return {
    unreconciledPayments: unreconciled.map((p) => ({
      id: p.id,
      date: p.paidAt,
      student: `${p.student?.user.firstName} ${p.student?.user.lastName}`,
      fee: p.fee?.name,
      amount: p.amount,
      method: p.method,
    })),
    totalUnreconciled: unreconciled.reduce((sum, p) => sum + Number(p.amount), 0),
    count: unreconciled.length,
  };
}

async function generateCollectionReport(
  schoolId: string,
  academicYearId?: string | null,
  dateRange: FinanceDateRange = {}
) {
  const where: Record<string, unknown> = {
    fee: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
    ...buildPaymentDateWhere(dateRange),
  };

  // Get payments grouped by month
  const payments = await prisma.payment.findMany({
    where: {
      ...where,
      status: { in: ["VERIFIED", "RECONCILED"] },
    },
    select: { amount: true, paidAt: true, createdAt: true },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
  });

  const monthlyData = payments.reduce((acc, payment) => {
    const monthKey = getEffectivePaymentDate(payment).toISOString().slice(0, 7);
    if (!acc[monthKey]) {
      acc[monthKey] = { month: monthKey, total: 0, count: 0 };
    }
    acc[monthKey].total += Number(payment.amount);
    acc[monthKey].count += 1;
    return acc;
  }, {} as Record<string, { month: string; total: number; count: number }>);

  return {
    monthlyCollection: Object.values(monthlyData),
    totalCollected: payments.reduce((sum, p) => sum + Number(p.amount), 0),
    totalPayments: payments.length,
  };
}

function generatePDFContent(
  school: { name: string; address?: string | null; phone?: string | null; email?: string | null },
  reportType: string,
  data: Record<string, unknown>,
  period: { startDate?: Date; endDate?: Date }
): string {
  // This would be replaced with actual PDF generation in production
  // For now, return a simple text representation
  return `
RAPPORT FINANCIER
==================
Établissement: ${school.name}
Adresse: ${school.address || "N/A"}
Téléphone: ${school.phone || "N/A"}
Email: ${school.email || "N/A"}

Type de rapport: ${reportType}
Période: ${period.startDate?.toLocaleDateString("fr-FR") || "N/A"} - ${period.endDate?.toLocaleDateString("fr-FR") || "N/A"}
Date de génération: ${new Date().toLocaleString("fr-FR")}

---
Données du rapport:
${JSON.stringify(data, null, 2)}
  `.trim();
}
