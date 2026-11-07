/**
 * Création des notifications in-app. Le flux SSE (`/api/notifications/stream`)
 * les relève en base : aucun relais de publication (Redis retiré le 2026-11-07).
 */
import prisma from "@/lib/prisma";

type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "GRADE" | "PAYMENT" | "BULLETIN" | "ENROLLMENT" | "SYSTEM" | "MESSAGE" | "ATTENDANCE";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

interface BulkNotificationParams {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const notif = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    },
  });

  return notif;
}

/** Notifications au contenu propre à chaque destinataire, en une seule insertion. */
export async function createNotifications(items: CreateNotificationParams[]) {
  if (items.length === 0) return { count: 0 };
  const result = await prisma.notification.createMany({
    data: items.map((item) => ({
      userId: item.userId,
      type: item.type,
      title: item.title,
      message: item.message,
      link: item.link,
    })),
  });

  return result;
}

export async function createBulkNotifications(params: BulkNotificationParams) {
  const data = params.userIds.map((userId) => ({
    userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
  }));

  return prisma.notification.createMany({ data });
}
