import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/compliance/dashboard
 * Get compliance dashboard with GDPR/RGPD metrics (Admin only)
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // SUPER_ADMIN can see all data (no schoolId filter)
    const schoolId = session.user.role === "SUPER_ADMIN" ? null : session.user.schoolId;

    // Get counts for various compliance metrics
    const [
      totalUsers,
      activeUsers,
      recentAuditLogs,
      pendingDataRequests,
      dataConsents,
      retentionPolicies,
      deletedAccounts,
      recentLogins,
    ] = await Promise.all([
      // Total users in school
      prisma.user.count({
        where: schoolId ? { schoolId } : {},
      }),

      // Active users (logged in last 30 days)
      prisma.user.count({
        where: {
          ...(schoolId ? { schoolId } : {}),
          sessions: {
            some: {
              expires: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      }),

      // Recent audit logs (last 7 days)
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Pending data access requests
      prisma.dataAccessRequest.count({
        where: {
          status: "PENDING",
        },
      }),

      // Data consents summary
      prisma.dataConsent.groupBy({
        by: ["consentType", "isGranted"],
        _count: true,
      }),

      // Retention policies
      prisma.dataRetentionPolicy.count({
        where: schoolId ? { schoolId } : {},
      }),

      // Deleted accounts (last 30 days)
      prisma.auditLog.count({
        where: {
          action: {
            contains: "DELETE",
          },
          entity: "User",
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Recent logins (last 24h)
      prisma.auditLog.count({
        where: {
          action: "LOGIN",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get recent data access requests
    const recentDataRequests = await prisma.dataAccessRequest.findMany({
      take: 10,
      orderBy: { requestedAt: "desc" },
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
    });

    // Get audit log breakdown by action
    const auditLogsByAction = await prisma.auditLog.groupBy({
      by: ["action"],
      _count: true,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        _count: {
          action: "desc",
        },
      },
      take: 10,
    });

    // Get consent statistics
    const consentStats = dataConsents.reduce(
      (acc: any, item) => {
        const key = item.isGranted ? "granted" : "denied";
        acc[item.consentType] = acc[item.consentType] || { granted: 0, denied: 0 };
        acc[item.consentType][key] = item._count;
        return acc;
      },
      {}
    );

    // Calculate compliance score (0-100)
    let complianceScore = 100;

    // Deduct points for issues
    if (pendingDataRequests > 0) complianceScore -= Math.min(20, pendingDataRequests * 5);
    if (retentionPolicies === 0) complianceScore -= 15;
    if (recentAuditLogs === 0) complianceScore -= 10;

    // Get users without recent activity (potential inactive accounts)
    const inactiveUsers = await prisma.user.count({
      where: {
        ...(schoolId ? { schoolId } : {}),
        isActive: true,
        sessions: {
          none: {
            expires: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });

    return NextResponse.json({
      summary: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        complianceScore: Math.max(0, complianceScore),
        lastAuditDate: new Date(),
      },
      dataRequests: {
        pending: pendingDataRequests,
        recent: recentDataRequests,
      },
      auditLogs: {
        last7Days: recentAuditLogs,
        recentLogins,
        byAction: auditLogsByAction,
      },
      consents: {
        statistics: consentStats,
        totalTypes: Object.keys(consentStats).length,
      },
      dataManagement: {
        retentionPolicies,
        deletedAccountsLast30Days: deletedAccounts,
      },
      alerts: [
        ...(pendingDataRequests > 0
          ? [
            {
              level: "warning",
              message: `${pendingDataRequests} demande(s) d'accès aux données en attente`,
              action: "Traiter les demandes",
            },
          ]
          : []),
        ...(retentionPolicies === 0
          ? [
            {
              level: "error",
              message: "Aucune politique de rétention définie",
              action: "Configurer les politiques",
            },
          ]
          : []),
        ...(inactiveUsers > 10
          ? [
            {
              level: "info",
              message: `${inactiveUsers} comptes inactifs depuis 90+ jours`,
              action: "Réviser les comptes inactifs",
            },
          ]
          : []),
      ],
    });
  } catch (error) {
    logger.error(" fetching compliance dashboard:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du dashboard de conformité" },
      { status: 500 }
    );
  }
}
