import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { CONSENT_TERMS, LEGAL_TERMS_VERSION } from "@/lib/security/consent";

/**
 * GET /api/compliance/dashboard
 * Get compliance dashboard with GDPR/RGPD metrics (Admin only)
 */
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    // SUPER_ADMIN can see all data (no schoolId filter)
    const schoolId = session.user.role === "SUPER_ADMIN" ? null : getActiveSchoolId(session);

    // Audit logs carry a relation to their author; scope them to the admin's
    // school so a SCHOOL_ADMIN never sees cross-tenant activity counts.
    const auditSchoolFilter = schoolId ? { user: { schoolId } } : {};

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
          ...auditSchoolFilter,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Pending data access requests (scoped to the admin's school, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] })
      prisma.dataAccessRequest.count({
        where: {
          status: "PENDING",
          ...(schoolId ? { user: { schoolId } } : {}),
        },
      }),

      // Data consents summary (scoped to the admin's school)
      prisma.dataConsent.groupBy({
        by: ["consentType", "isGranted"],
        _count: true,
        ...(schoolId ? { where: { user: { schoolId } } } : {}),
      }),

      // Retention policies
      prisma.dataRetentionPolicy.count({
        where: schoolId ? { schoolId } : {},
      }),

      // Deleted accounts (last 30 days)
      prisma.auditLog.count({
        where: {
          ...auditSchoolFilter,
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
          ...auditSchoolFilter,
          action: "LOGIN",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get recent data access requests (scoped to the admin's school)
    const recentDataRequests = await prisma.dataAccessRequest.findMany({
      where: schoolId ? { user: { schoolId } } : {},
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
        ...auditSchoolFilter,
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
      (acc: Record<string, { granted: number; denied: number }>, item) => {
        const key = item.isGranted ? "granted" : "denied";
        acc[item.consentType] = acc[item.consentType] || { granted: 0, denied: 0 };
        acc[item.consentType][key] = item._count;
        return acc;
      },
      {}
    );

    // N59 (Lot 6) : indicateurs lus par la page Conformité, qui ne les recevait pas
    // et affichait ses valeurs de repli (85 % de conformité, 100 % de consentements).
    const requestScope = schoolId ? { user: { schoolId } } : {};
    const policyScope = schoolId ? { schoolId } : {};
    const [completedDataRequests, totalDataRequests, activePolicies, acceptedTerms] = await Promise.all([
      prisma.dataAccessRequest.count({ where: { ...requestScope, status: "COMPLETED" } }),
      prisma.dataAccessRequest.count({ where: requestScope }),
      prisma.dataRetentionPolicy.count({ where: { ...policyScope, isActive: true } }),
      // Lot 6 : comptes ayant accepté la version courante des conditions.
      prisma.dataConsent.count({
        where: {
          consentType: CONSENT_TERMS,
          isGranted: true,
          version: LEGAL_TERMS_VERSION,
          ...(schoolId ? { user: { schoolId } } : {}),
        },
      }),
    ]);
    const inactivePolicies = Math.max(0, retentionPolicies - activePolicies);

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
      overallScore: Math.max(0, complianceScore),
      // Part des comptes ayant accepté la version courante des conditions
      // (Lot 6). `null` seulement s'il n'y a aucun compte : jamais un chiffre inventé.
      consentRate: totalUsers > 0 ? Math.round((acceptedTerms / totalUsers) * 100) : null,
      pendingPolicies: inactivePolicies,
      dataRequestsSummary: { pending: pendingDataRequests, completed: completedDataRequests, total: totalDataRequests },
      retentionStatus: { active: activePolicies, inactive: inactivePolicies },
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
        ...(inactivePolicies > 0
          ? [
            {
              level: "info",
              message: `${inactivePolicies} règle(s) de conservation à activer`,
              action: "Revoir les durées de conservation",
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

// N60 (Lot 6) : réservé à l'administration, comme la page ; auparavant tout compte
// connecté lisait les compteurs et les demandes RGPD récentes (noms et emails).
}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] });
