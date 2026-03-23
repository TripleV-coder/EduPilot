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

    // Health check de la base de données
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbStart;

    // Erreurs récentes (audit logs avec action ERROR)
    const recentErrors = await prisma.auditLog.findMany({
      where: {
        action: { contains: "ERROR" },
        createdAt: { gte: last24h },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        oldValues: true,
        newValues: true,
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

    // Statistiques d'erreurs
    const errorStats = await prisma.auditLog.groupBy({
      by: ["action"],
      where: {
        action: { contains: "ERROR" },
        createdAt: { gte: last7d },
      },
      _count: true,
    });

    // Sessions actives
    const activeSessions = await prisma.session.count({
      where: {
        expires: { gte: now },
      },
    });

    // Utilisateurs connectés récemment (24h)
    const recentLogins = await prisma.auditLog.count({
      where: {
        action: "LOGIN",
        createdAt: { gte: last24h },
      },
    });

    // Requêtes de données en attente
    const pendingRequests = await prisma.dataAccessRequest.count({
      where: { status: "PENDING" },
    });

    // État du cache Redis
    let cacheStatus: { connected: boolean; hitRate: number; memory: string | null } = { connected: false, hitRate: 0, memory: null };
    try {
      const { getRedisClient } = await import("@/lib/cache/redis");
      const client = getRedisClient();
      if (client) {
        try {
          const pong = await client.ping();
          cacheStatus = {
            connected: Boolean(pong),
            hitRate: 0,
            memory: null,
          };
        } catch {
          cacheStatus.connected = false;
        }
      }
    } catch {
      // Redis non disponible
    }

    // État du système (maintenance mode)
    const maintenanceSetting = await prisma.systemSetting.findUnique({
      where: { key: "maintenance_mode" },
    });
    const maintenanceMode = maintenanceSetting?.value === "on";

    // Performance de la base de données
    const dbHealth = {
      responseTime: dbResponseTime,
      status: dbResponseTime < 100 ? "excellent" : dbResponseTime < 500 ? "good" : dbResponseTime < 1000 ? "warning" : "critical",
    };

    return NextResponse.json({
      timestamp: now.toISOString(),
      database: {
        health: dbHealth,
        connectionPool: {
          // Prisma gère le pool automatiquement, on peut juste vérifier la connexion
          status: "active",
        },
      },
      cache: cacheStatus,
      system: {
        maintenanceMode,
        activeSessions,
        recentLogins,
        pendingDataRequests: pendingRequests,
      },
      errors: {
        last24h: recentErrors.length,
        recent: recentErrors.slice(0, 10),
        byType: errorStats.map((e) => ({
          type: e.action,
          count: e._count,
        })),
      },
      alerts: [
        ...(dbHealth.status === "critical"
          ? [
            {
              level: "critical",
              message: `Temps de réponse DB élevé: ${dbResponseTime}ms`,
              timestamp: now.toISOString(),
            },
          ]
          : []),
        ...(recentErrors.length > 20
          ? [
            {
              level: "warning",
              message: `${recentErrors.length} erreurs dans les dernières 24h`,
              timestamp: now.toISOString(),
            },
          ]
          : []),
        ...(pendingRequests > 0
          ? [
            {
              level: "info",
              message: `${pendingRequests} requête(s) de données en attente`,
              timestamp: now.toISOString(),
            },
          ]
          : []),
        ...(!cacheStatus.connected
          ? [
            {
              level: "warning",
              message: "Cache Redis non connecté",
              timestamp: now.toISOString(),
            },
          ]
          : []),
      ],
    });
  } catch (error) {
    logger.error("Error fetching root monitoring", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du monitoring" },
      { status: 500 }
    );
  }
}
