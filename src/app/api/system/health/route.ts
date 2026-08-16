import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getRedisClient } from "@/lib/cache/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/health
 * Get system health metrics (Super Admin only)
 */
export const GET = createApiHandler(async (_request, context) => {
    try {
        const session = context.session;


    // Calculate system health metrics
    const startTime = Date.now();

    // Database health check
    const dbHealthStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbHealthStart;

    const redis = getRedisClient();
    let cacheStatus: "healthy" | "warning" | "disabled" = "disabled";
    if (redis) {
      try {
        await redis.ping();
        cacheStatus = "healthy";
      } catch {
        cacheStatus = "warning";
      }
    }

    // Count active users (all active users since lastLoginAt field doesn't exist in schema)
    const activeUsers = await prisma.user.count({
      where: {
        isActive: true,
      },
    });

    // Total users
    const totalUsers = await prisma.user.count({
      where: { isActive: true },
    });

    // Total schools
    const totalSchools = await prisma.school.count({
      where: { isActive: true },
    });

    // Runtime uptime in seconds (process-based, non-simulated)
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeHuman = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;

    // System status determination
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (dbResponseTime > 500) {
      status = "warning";
    }
    if (dbResponseTime > 1000) {
      status = "critical";
    }

    const totalResponseTime = Date.now() - startTime;

    return NextResponse.json({
      status,
      uptime: uptimeHuman,
      uptimeSeconds,
      responseTime: `${totalResponseTime}ms`,
      responseTimeMs: totalResponseTime,
      dbResponseTime: `${dbResponseTime}ms`,
      dbResponseTimeMs: dbResponseTime,
      activeUsers,
      totalUsers,
      totalSchools,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbResponseTime < 500 ? "healthy" : dbResponseTime < 1000 ? "warning" : "critical",
        api: totalResponseTime < 200 ? "healthy" : totalResponseTime < 500 ? "warning" : "critical",
        cache: cacheStatus,
      },
    });
  
    } catch (error: unknown) {
    logger.error("Error fetching system health", error instanceof Error ? error : new Error(String(error)), { module: "api/system/health" });
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération de l'état du système",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }

}, { allowedRoles: ["SUPER_ADMIN"] });
