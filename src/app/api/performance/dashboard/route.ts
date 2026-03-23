import { NextResponse } from "next/server";
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
      // Get Web Vitals metrics (would be stored in database or analytics service)
      const webVitals = {
        lcp: { value: 0, rating: "good" },
        fid: { value: 0, rating: "good" },
        cls: { value: 0, rating: "good" },
        fcp: { value: 0, rating: "good" },
        ttfb: { value: 0, rating: "good" },
        inp: { value: 0, rating: "good" },
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
