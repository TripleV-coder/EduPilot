import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for exporting financial data
 * Supports CSV and Excel formats
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
    const format = searchParams.get("format") || "csv";

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

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Build where clause
    const where: Record<string, unknown> = {
      fee: { schoolId },
    };
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }
    if (academicYearId) {
      where.fee = { ...where.fee as object, academicYearId };
    }

    // Fetch payments data
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

    // Transform data for CSV/Excel
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

    // Generate CSV
    if (format === "csv") {
      const headers = Object.keys(exportData[0] || {}).join(",");
      const rows = exportData.map((row) =>
        Object.values(row)
          .map((value) => {
            const stringValue = String(value ?? "");
            // Escape quotes and wrap in quotes if contains comma or quote
            if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",")
      );
      const csv = [headers, ...rows].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="export-financier-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // For Excel format, return CSV with .xlsx content type
    // In production, you'd use a library like xlsx to generate proper .xlsx files
    const headers = Object.keys(exportData[0] || {}).join(",");
    const rows = exportData.map((row) =>
      Object.values(row)
        .map((value) => {
          const stringValue = String(value ?? "");
          if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export-financier-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (error) {
    logger.error("Finance export error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'export des données financières" },
      { status: 500 }
    );
  }
}
