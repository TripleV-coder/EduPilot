import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isZodError } from "@/lib/is-zod-error";
import { createApiHandler } from "@/lib/api/api-helpers";
import { z } from "zod";
import type { NotificationWhereFilter } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const createNotificationSchema = z.object({
  userId: z.string().cuid(),
  type: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR", "GRADE", "PAYMENT", "BULLETIN", "ENROLLMENT", "SYSTEM"]),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  link: z.string().url().optional().or(z.literal("")),
});

export const GET = createApiHandler(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "20"), 1), 100); // Between 1 and 100

    const where: NotificationWhereFilter = {
      userId: session.user.id,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false,
        },
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    logger.error(" fetching notifications:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des notifications" },
      { status: 500 }
    );
  }
});

export const POST = createApiHandler(
  async (request, { session }) => {
    try {
      const body = await request.json();
      const validatedData = createNotificationSchema.parse(body);

      // CRITICAL: Verify target user belongs to same school (multi-tenant security)
      const targetUser = await prisma.user.findUnique({
        where: { id: validatedData.userId },
        select: { id: true, schoolId: true },
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: "Utilisateur non trouvé" },
          { status: 404 }
        );
      }

      // SUPER_ADMIN can send to anyone, others only to their school
      if (session.user.role !== "SUPER_ADMIN") {
        if (targetUser.schoolId !== getActiveSchoolId(session)) {
          return NextResponse.json(
            { error: "Vous ne pouvez envoyer des notifications qu'aux utilisateurs de votre établissement" },
            { status: 403 }
          );
        }
      }

      const notification = await prisma.notification.create({
        data: {
          userId: validatedData.userId,
          type: validatedData.type,
          title: validatedData.title,
          message: validatedData.message,
          link: validatedData.link || null,
        },
      });

      return NextResponse.json(notification, { status: 201 });
    } catch (error: unknown) {
      logger.error(" creating notification:", error as Error);
      if (isZodError(error)) {
        return NextResponse.json(
          { error: "Données invalides", details: error.issues },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Erreur lors de la création de la notification" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);

// Mark all as read
export const PATCH = createApiHandler(async (_request, { session }) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" marking notifications as read:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des notifications" },
      { status: 500 }
    );
  }
});
