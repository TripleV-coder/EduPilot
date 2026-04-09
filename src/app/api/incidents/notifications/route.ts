import { NextRequest, NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const VALID_NOTIFICATION_TYPES = new Set<string>(Object.values(NotificationType));

/**
 * GET /api/incidents/notifications
 * Récupère les notifications liées aux incidents (absences, retards, incidents disciplinaires).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    // Fetch notifications related to attendance/incident types
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: {
          in: ["ATTENDANCE", "WARNING", "INFO"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      notifications,
      total: notifications.length,
    });
  } catch (error) {
    logger.error("Error fetching incident notifications", error instanceof Error ? error : new Error(String(error)), { module: "api/incidents/notifications" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/incidents/notifications
 * Crée une notification liée à un incident pour un ou plusieurs parents.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only admins, directors, and teachers can create incident notifications
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, userIds, type = "WARNING" } = body;

    if (!title || !message || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "Champs requis: title, message, userIds (array)" },
        { status: 400 }
      );
    }

    if (!VALID_NOTIFICATION_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Type de notification invalide: ${type}. Valeurs autorisées: ${[...VALID_NOTIFICATION_TYPES].join(", ")}` },
        { status: 400 }
      );
    }

    if (session.user.role !== "SUPER_ADMIN") {
      const targetUsers = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, schoolId: true },
      });
      if (targetUsers.length !== userIds.length) {
        return NextResponse.json({ error: "Utilisateurs invalides" }, { status: 400 });
      }
      const outOfScope = targetUsers.some(u => u.schoolId !== getActiveSchoolId(session));
      if (outOfScope) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Create notifications for all target users
    const notifications = await prisma.notification.createMany({
      data: userIds.map((userId: string) => ({
        userId,
        title,
        message,
        type,
      })),
    });

    return NextResponse.json({
      success: true,
      count: notifications.count,
    }, { status: 201 });
  } catch (error) {
    logger.error("Error creating incident notification", error instanceof Error ? error : new Error(String(error)), { module: "api/incidents/notifications" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
