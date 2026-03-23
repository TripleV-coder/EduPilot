import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pending-actions
 * Get counts of pending administrative actions (Super Admin only)
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only SUPER_ADMIN can access pending actions
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Count schools awaiting approval
    const pendingSchools = await prisma.school.count({
      where: {
        OR: [
          { isActive: false }, // Inactive schools may need approval
          // Add custom approval status field if exists
        ],
      },
    });

    // Count users awaiting verification
    const pendingUsers = await prisma.user.count({
      where: {
        OR: [
          { isActive: false },
          // Could add email verification status
        ],
      },
    });

    // Count data requests (RGPD compliance)
    let pendingDataRequests = 0;
    try {
      pendingDataRequests = await prisma.dataAccessRequest.count({
        where: {
          status: "PENDING",
        },
      });
    } catch {
      pendingDataRequests = 0;
    }

    // Count incidents requiring attention
    let pendingIncidents = 0;
    try {
      // Check if incident model exists
      if ('incident' in prisma) {
        pendingIncidents = await (prisma as any).incident.count({
          where: {
            status: {
              in: ["REPORTED", "INVESTIGATING"],
            },
          },
        });
      }
    } catch (_error) {
      // Model doesn't exist, use 0
      pendingIncidents = 0;
    }

    // Count payment verifications needed
    const pendingPayments = await prisma.payment.count({
      where: {
        status: "PENDING",
      },
    });

    // Count compliance reports to review (data access requests in PENDING or IN_PROGRESS)
    let pendingComplianceReports = 0;
    try {
      pendingComplianceReports = await prisma.dataAccessRequest.count({
        where: {
          status: "IN_PROGRESS",
        },
      });
    } catch {
      pendingComplianceReports = 0;
    }

    // Build actions array
    const actions = [
      {
        id: "schools",
        type: "School Approvals",
        description: "Écoles en attente d'approbation",
        count: pendingSchools,
        priority: "high" as const,
        url: "/admin/schools?status=pending",
        icon: "building",
      },
      {
        id: "users",
        type: "User Verifications",
        description: "Utilisateurs en attente de vérification",
        count: pendingUsers,
        priority: "medium" as const,
        url: "/admin/users?status=pending",
        icon: "user-check",
      },
      {
        id: "data-requests",
        type: "Data Requests",
        description: "Demandes RGPD à traiter",
        count: pendingDataRequests,
        priority: "high" as const,
        url: "/admin/compliance/data-requests",
        icon: "file-text",
      },
      {
        id: "incidents",
        type: "Incidents",
        description: "Incidents à résoudre",
        count: pendingIncidents,
        priority: "high" as const,
        url: "/admin/incidents?status=pending",
        icon: "alert-circle",
      },
      {
        id: "payments",
        type: "Payment Verifications",
        description: "Paiements à vérifier",
        count: pendingPayments,
        priority: "medium" as const,
        url: "/admin/payments?status=pending",
        icon: "credit-card",
      },
      {
        id: "compliance",
        type: "Compliance Reports",
        description: "Rapports de conformité à examiner",
        count: pendingComplianceReports,
        priority: "low" as const,
        url: "/admin/compliance/reports",
        icon: "shield",
      },
    ];

    // Filter out actions with zero count
    const activeActions = actions.filter((action) => action.count > 0);

    // Calculate totals
    const totalPending = actions.reduce((sum, action) => sum + action.count, 0);
    const highPriority = actions
      .filter((a) => a.priority === "high")
      .reduce((sum, a) => sum + a.count, 0);

    return NextResponse.json({
      actions: activeActions,
      allActions: actions, // Include all even with zero count for dashboard
      summary: {
        total: totalPending,
        highPriority,
        mediumPriority: actions
          .filter((a) => a.priority === "medium")
          .reduce((sum, a) => sum + a.count, 0),
        lowPriority: actions
          .filter((a) => a.priority === "low")
          .reduce((sum, a) => sum + a.count, 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error("Error fetching pending actions", error instanceof Error ? error : new Error(String(error)), { module: "api/admin/pending-actions" });
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des actions en attente",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
