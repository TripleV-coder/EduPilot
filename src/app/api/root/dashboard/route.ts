import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import { logger } from "@/lib/utils/logger";

function requireRoot(session: Session | null, userEmail?: string | null, userId?: string | null) {
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isRootUserEmail(userEmail) || !hasValidRootSession(session)) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Métriques globales
    const [
      totalSchools,
      activeSchools,
      totalUsers,
      activeUsers,
      totalStudents,
      totalTeachers,
      totalClasses,
      _totalPayments,
      totalRevenue,
      recentAuditLogs,
      pendingDataRequests,
      systemHealth,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { isActive: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.studentProfile.count(),
      prisma.teacherProfile.count({ where: { deletedAt: null } }),
      prisma.class.count(),
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
      }),
      prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
      prisma.dataAccessRequest.count({ where: { status: "PENDING" } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT 1 as count`.then(() => ({ status: "healthy" })).catch(() => ({ status: "error" })),
    ]);

    // Évolution des utilisateurs (7 derniers jours) - grouper manuellement
    const recentUsers = await prisma.user.findMany({
      where: {
        createdAt: { gte: last7d },
      },
      select: { createdAt: true },
    });

    const userGrowthMap = new Map<string, number>();
    recentUsers.forEach((u) => {
      const day = u.createdAt.toISOString().split("T")[0];
      userGrowthMap.set(day, (userGrowthMap.get(day) || 0) + 1);
    });

    const userGrowth = Array.from(userGrowthMap.entries()).map(([date, count]) => ({
      createdAt: new Date(date),
      _count: count,
    }));

    // Répartition par rôle
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: true,
    });

    // Répartition des écoles par type
    const schoolsByType = await prisma.school.groupBy({
      by: ["type"],
      _count: true,
    });

    // Répartition des écoles par niveau
    const schoolsByLevel = await prisma.school.groupBy({
      by: ["level"],
      _count: true,
    });

    // Activité récente (24h)
    const recentActivity = await prisma.auditLog.findMany({
      where: { createdAt: { gte: last24h } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Top écoles par nombre d'utilisateurs
    const topSchools = await prisma.school.findMany({
      take: 10,
      orderBy: {
        users: {
          _count: "desc",
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            classes: true,
          },
        },
      },
    });

    // Statistiques financières (30 derniers jours)
    const financialStats = await prisma.payment.aggregate({
      where: {
        paidAt: { gte: last30d },
      },
      _sum: { amount: true },
      _count: true,
      _avg: { amount: true },
    });

    // Métriques de performance (si Redis disponible)
    let cacheStats = null;
    try {
      const { getRedisClient } = await import("@/lib/cache/redis");
      const client = getRedisClient();
      if (client) {
        try {
          const pong = await client.ping();
          cacheStats = {
            connected: Boolean(pong),
            hitRate: 0,
            totalRequests: 0,
          };
        } catch {
          cacheStats = { connected: false };
        }
      }
    } catch {
      cacheStats = { connected: false };
    }

    return NextResponse.json({
      overview: {
        schools: {
          total: totalSchools,
          active: activeSchools,
          inactive: totalSchools - activeSchools,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
        },
        students: totalStudents,
        teachers: totalTeachers,
        classes: totalClasses,
        revenue: {
          total: Number(totalRevenue._sum?.amount ?? 0),
          last30Days: Number(financialStats._sum?.amount ?? 0),
          averagePayment: Number(financialStats._avg?.amount ?? 0),
          paymentCount: financialStats._count ?? 0,
        },
      },
      activity: {
        last24h: {
          auditLogs: recentAuditLogs,
          pendingRequests: pendingDataRequests,
        },
        recent: recentActivity,
      },
      analytics: {
        userGrowth: userGrowth.map((g) => ({
          date: g.createdAt.toISOString(),
          count: g._count,
        })),
        usersByRole: usersByRole.map((r) => ({
          role: r.role,
          count: r._count,
        })),
        schoolsByType: schoolsByType.map((s) => ({
          type: s.type,
          count: s._count,
        })),
        schoolsByLevel: schoolsByLevel.map((s) => ({
          level: s.level,
          count: s._count,
        })),
      },
      topSchools: topSchools.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        city: s.city,
        isActive: s.isActive,
        users: s._count.users,
        classes: s._count.classes,
      })),
      system: {
        health: systemHealth,
        cache: cacheStats,
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error("Error fetching root dashboard", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du dashboard root" },
      { status: 500 }
    );
  }
}
