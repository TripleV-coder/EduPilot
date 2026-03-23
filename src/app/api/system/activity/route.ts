import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { translateEntity, startsWithVowel } from "@/lib/utils/entity-translator";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/activity
 * Get recent system activity logs (Super Admin only)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only SUPER_ADMIN can access system activity
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // Fetch recent audit logs
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Transform to activity format
    const activities = auditLogs.map((log) => {
      const userName = log.user
        ? `${log.user.firstName} ${log.user.lastName}`
        : "Système";
      const schoolName = log.school?.name || "Global";

      let action = log.action;
      let icon = "activity";

      // Determine action description and icon
      const translatedEntity = translateEntity(log.entity);

      switch (log.action) {
        case "CREATE":
          action = startsWithVowel(translatedEntity)
            ? `Création d'${translatedEntity}`
            : `Création de ${translatedEntity}`;
          icon = "plus-circle";
          break;
        case "UPDATE":
          action = startsWithVowel(translatedEntity)
            ? `Modification d'${translatedEntity}`
            : `Modification de ${translatedEntity}`;
          icon = "edit";
          break;
        case "DELETE":
          action = startsWithVowel(translatedEntity)
            ? `Suppression d'${translatedEntity}`
            : `Suppression de ${translatedEntity}`;
          icon = "trash";
          break;
        case "LOGIN":
        case "LOGIN_SUCCESS":
          action = "Connexion réussie";
          icon = "log-in";
          break;
        case "LOGIN_FAILED":
          action = "Tentative de connexion échouée";
          icon = "alert-circle";
          break;
        case "LOGIN_FAILED_LOCKED":
          action = "Tentative de connexion sur compte verrouillé";
          icon = "lock";
          break;
        case "LOGOUT":
          action = "Déconnexion";
          icon = "log-out";
          break;
        case "EXPORT":
          action = `Export de ${translatedEntity}`;
          icon = "download";
          break;
        default:
          action = `${log.action} - ${translatedEntity}`;
      }

      // Calculate time ago
      const timeAgo = getTimeAgo(new Date(log.createdAt));

      return {
        id: log.id,
        action,
        description: action, // Use action as description
        user: userName,
        userId: log.userId,
        school: schoolName,
        schoolId: log.schoolId, // Uses real AuditLog school relation
        timestamp: log.createdAt,
        timeAgo,
        icon,
        severity: getSeverity(log.action),
      };
    });

    // Count recent activities by type
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = {
      total: activities.length,
      last24Hours: await prisma.auditLog.count({
        where: {
          createdAt: { gte: last24Hours },
        },
      }),
      byAction: await prisma.auditLog.groupBy({
        by: ["action"],
        where: {
          createdAt: { gte: last24Hours },
        },
        _count: true,
      }),
    };

    return NextResponse.json({
      activities,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error("Error fetching system activity", error instanceof Error ? error : new Error(String(error)), { module: "api/system/activity" });
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération de l'activité système",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Calculate time ago
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return "Il y a quelques secondes";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Il y a ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Il y a ${hours} heure${hours > 1 ? "s" : ""}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
  }

  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Helper: Get severity level
 */
function getSeverity(action: string): "low" | "medium" | "high" {
  const highSeverity = ["DELETE", "LOGOUT", "LOGIN_FAILED_LOCKED"];
  const mediumSeverity = ["CREATE", "UPDATE", "EXPORT", "LOGIN_FAILED"];

  if (highSeverity.includes(action)) {
    return "high";
  }
  if (mediumSeverity.includes(action)) {
    return "medium";
  }
  return "low";
}
