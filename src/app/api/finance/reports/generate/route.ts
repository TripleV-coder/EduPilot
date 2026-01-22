import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for generating financial reports (PDF)
 */

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const academicYearId = searchParams.get("academicYearId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const reportType = searchParams.get("reportType") || "summary";

    if (!schoolId) {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    // Security check
    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId !== schoolId) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
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

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Fetch data based on report type
    let reportData: Record<string, unknown>;

    switch (reportType) {
      case "summary":
        reportData = await generateSummaryReport(schoolId, academicYearId, dateFilter);
        break;
      case "payments":
        reportData = await generatePaymentsReport(schoolId, academicYearId, dateFilter);
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
        reportData = await generateCollectionReport(schoolId, academicYearId, dateFilter);
        break;
      default:
        reportData = await generateSummaryReport(schoolId, academicYearId, dateFilter);
    }

    // Generate PDF (simplified - in production use a PDF library)
    // For now, return the data structure
    const _pdfContent = generatePDFContent(school, reportType, reportData, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // Return as JSON for frontend to render or download
    // In production, you'd generate an actual PDF here
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
        start: startDate,
        end: endDate,
      },
      generatedAt: new Date().toISOString(),
      data: reportData,
      // In production, this would be the actual PDF URL
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

// Report generation helper functions
async function generateSummaryReport(
  schoolId: string,
  academicYearId?: string | null,
  dateFilter: Record<string, unknown> = {}
) {
  const where: Record<string, unknown> = { fee: { schoolId } };
  if (academicYearId) where.fee = { ...where.fee as object, academicYearId };
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

  const [fees, payments, pendingPayments] = await Promise.all([
    prisma.fee.aggregate({
      where: { schoolId, isActive: true },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { ...where, status: { in: ["VERIFIED", "RECONCILED"] } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { ...where, status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    totalFees: fees._sum.amount || 0,
    feesCount: fees._count,
    totalCollected: payments._sum.amount || 0,
    paymentsCount: payments._count,
    totalPending: pendingPayments._sum.amount || 0,
    pendingCount: pendingPayments._count,
  };
}

async function generatePaymentsReport(
  schoolId: string,
  academicYearId?: string | null,
  dateFilter: Record<string, unknown> = {}
) {
  const where: Record<string, unknown> = { fee: { schoolId } };
  if (academicYearId) where.fee = { ...where.fee as object, academicYearId };
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      fee: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500, // Limit for performance
  });

  return {
    payments: payments.map((p) => ({
      id: p.id,
      date: p.createdAt.toISOString(),
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
  _academicYearId?: string | null
) {
  const students = await prisma.studentProfile.findMany({
    where: { schoolId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      payments: {
        where: { status: { in: ["PENDING"] } },
        select: { amount: true },
      },
    },
  });

  const outstanding = students
    .filter((s) => s.payments.length > 0)
    .map((s) => ({
      studentId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      totalOutstanding: s.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      paymentCount: s.payments.length,
    }))
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
  _dateFilter: Record<string, unknown> = {}
) {
  const where: Record<string, unknown> = { fee: { schoolId } };
  if (academicYearId) where.fee = { ...where.fee as object, academicYearId };

  // Get payments grouped by month
  const payments = await prisma.payment.findMany({
    where: {
      ...where,
      status: { in: ["VERIFIED", "RECONCILED"] },
    },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const monthlyData = payments.reduce((acc, payment) => {
    const monthKey = payment.createdAt.toISOString().slice(0, 7); // YYYY-MM
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
