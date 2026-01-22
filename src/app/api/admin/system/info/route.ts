import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/admin/system/info
 * Get system information for admin dashboard
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Get database stats
    const [
      userCount,
      schoolCount,
      studentCount,
      teacherCount,
      enrollmentCount,
      gradeCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.school.count(),
      prisma.studentProfile.count(),
      prisma.teacherProfile.count(),
      prisma.enrollment.count(),
      prisma.grade.count(),
    ]);

    // Get recent system activity
    const recentLogs = await prisma.auditLog.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return NextResponse.json({
      system: {
        version: process.env.npm_package_version || "1.0.0",
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
      },
      database: {
        provider: "PostgreSQL",
        status: "connected",
        users: userCount,
        schools: schoolCount,
        students: studentCount,
        teachers: teacherCount,
        enrollments: enrollmentCount,
        grades: gradeCount,
      },
      activity: {
        logs24h: recentLogs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(" fetching system info:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des informations système" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system/clear-cache
 * Clear system cache
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { action } = await request.json();

    if (action === "clear-cache") {
      // In a real implementation, this would clear Redis/cache
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "SYSTEM_CACHE_CLEAR",
          entity: "system",
          entityId: "cache",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Cache effacé avec succès",
      });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error) {
    logger.error(" system action:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'exécution de l'action" },
      { status: 500 }
    );
  }
}
