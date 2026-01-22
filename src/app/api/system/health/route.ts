import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/health
 * Get system health metrics (Super Admin only)
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only SUPER_ADMIN can access system health
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Calculate system health metrics
    const startTime = Date.now();

    // Database health check
    const dbHealthStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbResponseTime = Date.now() - dbHealthStart;

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

    // Calculate uptime (mock for now - in production would use process.uptime() or external monitoring)
    const uptimePercent = 99.8; // Mock value

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
      uptime: `${uptimePercent}%`,
      uptimePercent,
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
      },
    });
  } catch (error: any) {
    console.error("Error fetching system health:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération de l'état du système",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
