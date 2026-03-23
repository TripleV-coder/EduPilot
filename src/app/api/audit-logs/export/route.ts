import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

    const where: Prisma.AuditLogWhereInput = {};

    // For SCHOOL_ADMIN, only show logs for their school (Inviolable isolation)
    if (session.user.role === "SCHOOL_ADMIN") {
      if (!session.user.schoolId) {
        return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
      }

      const schoolUserIds = await prisma.user.findMany({
        where: { schoolId: session.user.schoolId },
        select: { id: true },
      });

      const allowedIds = schoolUserIds.map((u) => u.id);

      // If a specific userId was requested, ensure it belongs to the school
      if (userId) {
        if (!allowedIds.includes(userId)) {
          return NextResponse.json({ error: "Accès refusé à cet utilisateur" }, { status: 403 });
        }
        where.userId = userId;
      } else {
        where.userId = { in: allowedIds };
      }
    } else if (userId) {
      where.userId = userId;
    }

    if (action) where.action = { contains: action, mode: "insensitive" };
    if (entity) where.entity = entity;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
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

    // Escape CSV values and protect against CSV Injection (Formula Injection)
    const escapeCsvValue = (value: string) => {
      let val = value || "";
      // CSV Injection Protection: Prefix values starting with =, +, -, @ with an apostrophe
      if (val.startsWith("=") || val.startsWith("+") || val.startsWith("-") || val.startsWith("@")) {
        val = `'${val}`;
      }

      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
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
