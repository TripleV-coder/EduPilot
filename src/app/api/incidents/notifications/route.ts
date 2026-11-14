import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

const VALID_NOTIFICATION_TYPES = new Set<string>(Object.values(NotificationType));

/**
 * GET /api/incidents/notifications
 * Récupère les notifications liées aux incidents (absences, retards, incidents disciplinaires).
 */
export const GET = createApiHandler(
  async (request, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      // Borné : un ?limit absurde (ou illisible) ne charge pas toute la table
      const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 20;

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
      return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
    }
  },
);

/**
 * POST /api/incidents/notifications
 * Crée une notification liée à un incident pour un ou plusieurs parents.
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    try {
      const body = await request.json();
      const { title, message, userIds, type = "WARNING" } = body;

      if (!title || !message || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json(
          { error: "Champs requis: title, message, userIds (array)" },
          { status: 400 }
        );
      }
      // Bornes : textes et nombre de destinataires (évite l'envoi massif ou démesuré)
      if (
        typeof title !== "string" || typeof message !== "string" ||
        title.length > 200 || message.length > 2000 ||
        userIds.length > 500 || !userIds.every((id: unknown) => typeof id === "string")
      ) {
        return NextResponse.json(
          { error: "Notification invalide : titre ≤ 200 caractères, message ≤ 2 000, 500 destinataires au plus." },
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
      return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
);
