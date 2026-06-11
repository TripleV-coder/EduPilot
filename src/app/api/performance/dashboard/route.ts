import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { checkPerformanceThresholds, sendPerformanceAlerts, type PerformanceMetrics } from "@/lib/performance/alerts";

/**
 * GET /api/performance/dashboard
 * Performance metrics dashboard
 * @swagger
 * /api/performance/dashboard:
 *   get:
 *     summary: Dashboard de performance
 *     description: Récupère les métriques de performance de l'application
 *     tags: [Performance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métriques de performance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webVitals:
 *                   type: object
 *                 apiPerformance:
 *                   type: object
 *                 cacheStats:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const GET = createApiHandler(
  async (request, { session }) => {
    // Only SUPER_ADMIN and SCHOOL_ADMIN can access performance dashboard
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    try {
      // Web Vitals réels : p75 des mesures des dernières 24 h ingérées par
      // POST /api/analytics/web-vitals (modèle PerformanceMetric — P2.4)
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const samples = await prisma.performanceMetric.findMany({
        where: { createdAt: { gte: since } },
        select: { metric: true, value: true },
      });

      const p75 = (metric: string): number | null => {
        const values = samples
          .filter((sample) => sample.metric === metric)
          .map((sample) => sample.value)
          .sort((a, b) => a - b);
        if (values.length === 0) return null;
        // Percentile nearest-rank : index = ⌈n × 0.75⌉ - 1
        return values[Math.max(0, Math.ceil(values.length * 0.75) - 1)];
      };

      // Seuils officiels web.dev (good / needs-improvement / poor)
      const rate = (value: number | null, good: number, poor: number): string => {
        if (value === null) return "good";
        if (value <= good) return "good";
        if (value <= poor) return "needs-improvement";
        return "poor";
      };

      const vital = (metric: string, good: number, poor: number) => {
        const value = p75(metric);
        return { value: value ?? 0, rating: rate(value, good, poor) };
      };

      const webVitals = {
        lcp: vital("LCP", 2500, 4000),
        fid: vital("FID", 100, 300),
        cls: vital("CLS", 0.1, 0.25),
        fcp: vital("FCP", 1800, 3000),
        ttfb: vital("TTFB", 800, 1800),
        inp: vital("INP", 200, 500),
      };

      // Get API performance metrics
      const apiPerformance = {
        averageResponseTime: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        cacheHitRate: 0,
      };

      // Get cache statistics
      const cacheStats = {
        redis: {
          connected: false,
          hitRate: 0,
          missRate: 0,
        },
        http: {
          etagHits: 0,
          cacheControlHits: 0,
        },
      };

      // Try to get Redis cache stats if available
      try {
        const { getRedisClient } = await import("@/lib/cache/redis");
        const client = getRedisClient();
        if (client) {
          try {
            const pong = await client.ping();
            cacheStats.redis.connected = Boolean(pong);
          } catch {
            // Ping failed
          }
        }
      } catch {
        // Redis not available
      }

      const metrics: PerformanceMetrics = {
        webVitals,
        apiPerformance,
      };

      // Check thresholds and generate alerts
      const alerts = checkPerformanceThresholds(metrics);

      // Send alerts asynchronously (don't block response)
      sendPerformanceAlerts(alerts).catch((error) => {
        logger.error("Error sending performance alerts", error as Error);
      });

      return NextResponse.json({
        webVitals,
        apiPerformance,
        cacheStats,
        alerts: alerts.length > 0 ? alerts : undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error fetching performance metrics", error as Error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des métriques" },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  }
);
