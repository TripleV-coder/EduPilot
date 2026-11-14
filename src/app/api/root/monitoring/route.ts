import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LOGIN_ACTIONS, loggedInSince } from "@/lib/audit/logins";
import { requireRoot } from "@/lib/security/require-root";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { hostStatus } from "@/lib/system/host-status";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  async (_request, context) => {
    const session = context.session;
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

      // Activité réelle (journal d'audit) : les sessions sont des JWT, la
      // table `sessions` n'est jamais alimentée (ce compteur valait toujours 0)
      const [connectedAccounts24h, recentLogins] = await Promise.all([
        prisma.user.count({ where: loggedInSince(last24h) }),
        prisma.auditLog.count({
          where: {
            action: { in: [...LOGIN_ACTIONS] },
            createdAt: { gte: last24h },
          },
        }),
      ]);

      // Requêtes de données en attente
      const pendingRequests = await prisma.dataAccessRequest.count({
        where: { status: "PENDING" },
      });

      // Cache mémoire (taux mesuré) et état partagé PostgreSQL (limites,
      // coupe-circuits) : « connecté » tant que son coupe-circuit est fermé.
      const { getCacheStats } = await import("@/lib/cache/service");
      const { storeCircuit } = await import("@/lib/shared-state/pg");
      const measuredCache = getCacheStats();
      const cacheStatus: { connected: boolean; hitRate: number; memory: string | null } = {
        connected: !storeCircuit.isOpen(),
        hitRate: measuredCache.hitRate,
        memory: `${measuredCache.entries} entrée(s) · ${(measuredCache.bytes / (1024 * 1024)).toFixed(1)} Mo`,
      };

      // État du système (maintenance mode)
      const maintenanceSetting = await prisma.systemSetting.findUnique({
        where: { key: "maintenance_mode" },
      });
      const maintenanceMode = maintenanceSetting?.value === "on";

      // Nombre RÉEL d'erreurs sur 24 h : `recentErrors` est plafonné à 50
      // par son `take`, il ne pouvait donc pas servir de compteur.
      const auditErrorCount = await prisma.auditLog.count({
        where: { action: { contains: "ERROR" }, createdAt: { gte: last24h } },
      });

      // Journal des erreurs serveur et navigateur (remplace Sentry)
      const [journalCount, journalRecent, journalTop] = await Promise.all([
        prisma.errorLog.count({ where: { createdAt: { gte: last24h } } }),
        prisma.errorLog.findMany({
          where: { createdAt: { gte: last24h } },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, source: true, message: true, path: true, createdAt: true },
        }),
        prisma.errorLog.groupBy({
          by: ["fingerprint"],
          where: { createdAt: { gte: last7d } },
          _count: { _all: true },
          _max: { createdAt: true },
          orderBy: { _count: { fingerprint: "desc" } },
          take: 5,
        }),
      ]);
      const topSamples = journalTop.length
        ? await prisma.errorLog.findMany({
            where: { fingerprint: { in: journalTop.map((t) => t.fingerprint) } },
            distinct: ["fingerprint"],
            orderBy: { createdAt: "desc" },
            select: { fingerprint: true, source: true, message: true, path: true },
          })
        : [];
      const errorCount = auditErrorCount + journalCount;

      // État de la machine (Lot 7) : mémoire, disque, dernière sauvegarde.
      const host = await hostStatus();

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
          connectedAccounts24h,
          recentLogins,
          pendingDataRequests: pendingRequests,
        },
        host,
        errors: {
          last24h: errorCount,
          recent: recentErrors.slice(0, 10),
          byType: errorStats.map((e) => ({
            type: e.action,
            count: e._count,
          })),
          journal: {
            last24h: journalCount,
            recent: journalRecent.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
            frequent: journalTop.map((t) => {
              const sample = topSamples.find((x) => x.fingerprint === t.fingerprint);
              return {
                fingerprint: t.fingerprint,
                count: t._count._all,
                lastSeen: t._max.createdAt?.toISOString() ?? null,
                source: sample?.source ?? "server",
                message: sample?.message ?? "",
                path: sample?.path ?? null,
              };
            }),
          },
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
          ...(errorCount > 20
            ? [
              {
                level: "warning",
                message: `${errorCount} erreurs dans les dernières 24h`,
                timestamp: now.toISOString(),
              },
            ]
            : []),
          // Sauvegarde : l'absence de preuve est le pire des cas. Une
          // installation locale n'a personne d'autre pour s'en apercevoir.
          ...(host.backup.status === "unavailable"
            ? [
              {
                level: "critical",
                message: "Aucune sauvegarde visible : vérifiez BACKUP_DIR et la tâche planifiée",
                timestamp: now.toISOString(),
              },
            ]
            : []),
          ...(host.backup.status === "none"
            ? [
              {
                level: "critical",
                message: "Aucune sauvegarde n'a encore été faite",
                timestamp: now.toISOString(),
              },
            ]
            : []),
          ...(host.backup.status === "stale"
            ? [
              {
                level: "critical",
                message: `Dernière sauvegarde il y a ${host.backup.ageHours} h`,
                timestamp: now.toISOString(),
              },
            ]
            : []),
          ...(host.disk && host.disk.usedPercent >= 90
            ? [
              {
                level: host.disk.usedPercent >= 95 ? "critical" : "warning",
                message: `Disque occupé à ${host.disk.usedPercent} % (${host.disk.freeGb} Go libres)`,
                timestamp: now.toISOString(),
              },
            ]
            : []),
          ...(host.memory.usedPercent >= 90
            ? [
              {
                level: "warning",
                message: `Mémoire occupée à ${host.memory.usedPercent} %`,
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
                message: "État partagé (PostgreSQL) injoignable : limites en mémoire locale",
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
  },
  { allowedRoles: ["SUPER_ADMIN"] },
);
