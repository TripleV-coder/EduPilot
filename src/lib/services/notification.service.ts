import prisma from "@/lib/prisma";
import Redis from "ioredis";
import { logger } from "@/lib/utils/logger";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  logger.warn("REDIS_URL non défini — les notifications temps réel seront désactivées", {
    module: "notification.service",
  });
}
let publisher: Redis | null = null;
function getPublisher(): Redis | null {
  if (!redisUrl) return null;
  if (!publisher) {
    publisher = new Redis(redisUrl);
  }
  return publisher;
}

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

  getPublisher()?.publish(`notifications:${params.userId}`, JSON.stringify(notif)).catch(() => { });
  return notif;
}

export async function createBulkNotifications(params: BulkNotificationParams) {
  const data = params.userIds.map((userId) => ({
    userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link,
  }));

  const result = await prisma.notification.createMany({ data });

  const pub = getPublisher();
  params.userIds.forEach(userId => {
    pub?.publish(`notifications:${userId}`, JSON.stringify({ REFRESH_REQUIRED: true })).catch(() => { });
  });

  return result;
}
