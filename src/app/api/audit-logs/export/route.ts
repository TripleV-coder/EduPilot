import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { translateEntity } from "@/lib/utils/entity-translator";

/**
 * GET /api/audit-logs/export
 * Export audit logs as CSV (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Only SUPER_ADMIN and SCHOOL_ADMIN can export audit logs
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const entity = searchParams.get("entity");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (entity) where.entity = entity;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // For SCHOOL_ADMIN, only show logs for their school
    if (session.user.role === "SCHOOL_ADMIN" && session.user.schoolId) {
      const schoolUserIds = await prisma.user.findMany({
        where: { schoolId: session.user.schoolId },
        select: { id: true },
      });
      where.userId = { in: schoolUserIds.map((u) => u.id) };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000, // Limit export to 10k records
    });

    // Generate CSV
    const csvHeaders = [
      "Date",
      "Utilisateur",
      "Email",
      "Role",
      "Action",
      "Entité",
      "ID Entité",
      "Adresse IP",
      "User Agent",
    ];

    const csvRows = logs.map((log) => [
      new Date(log.createdAt).toLocaleString("fr-FR"),
      `${log.user.firstName} ${log.user.lastName}`,
      log.user.email,
      log.user.role,
      log.action,
      translateEntity(log.entity),
      log.entityId || "",
      log.ipAddress || "",
      log.userAgent || "",
    ]);

    // Escape CSV values
    const escapeCsvValue = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit_logs_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    logger.error(" exporting audit logs:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'export des logs d'audit" },
      { status: 500 }
    );
  }
}
