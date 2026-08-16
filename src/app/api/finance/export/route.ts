import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { parseDateRangeParams } from "@/lib/validations/date-range";
import { escapeCsvCell } from "@/lib/utils/export";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for exporting financial data
 * Supports CSV and Excel formats
 */

export const GET = createApiHandler(async (request, context) => {
  try {
    const session = context.session;
    const { searchParams } = new URL(request.url);
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const activeSchoolId = getActiveSchoolId(session);
    const schoolId = session.user.role === "SUPER_ADMIN"
      ? requestedSchoolId
      : requestedSchoolId || activeSchoolId;
    const academicYearId = searchParams.get("academicYearId");
    const dateRange = parseDateRangeParams(searchParams);
    if (!dateRange.success) return dateRange.response;
    const { startDate, endDate } = dateRange;
    const format = searchParams.get("format") || "csv";

    if (!schoolId) {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    const where: Record<string, unknown> = {
      fee: { schoolId },
    };
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }
    if (academicYearId) {
      where.fee = { ...where.fee as object, academicYearId };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        fee: { select: { name: true, amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const exportData = payments.map((payment) => ({
      ID: payment.id,
      Date: payment.createdAt.toISOString().split("T")[0],
      "Date paiement": payment.paidAt ? payment.paidAt.toISOString().split("T")[0] : "",
      Élève: `${payment.student.user.firstName} ${payment.student.user.lastName}`,
      Matricule: payment.student.matricule || "",
      Email: payment.student.user.email || "",
      "Type frais": payment.fee.name || "",
      "Montant frais": Number(payment.fee.amount) || 0,
      "Montant payé": Number(payment.amount),
      Méthode: payment.method,
      Référence: payment.reference || "",
      Statut: payment.status,
      "Reçu par ID": payment.receivedBy || "",
      Notes: payment.notes || "",
    }));

    if (format !== "csv" && format !== "excel") {
      return NextResponse.json(
        { error: "Format d'export non supporté. Utilisez csv ou excel-compatible." },
        { status: 400 }
      );
    }

    const headers = Object.keys(exportData[0] || {})
      .map((cell) => escapeCsvCell(cell))
      .join(",");
    const rows = exportData.map((row) =>
      Object.values(row)
        .map((value) => escapeCsvCell(String(value ?? "")))
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-financier-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    logger.error("Finance export error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'export des données financières" },
      { status: 500 }
    );
  }
});
