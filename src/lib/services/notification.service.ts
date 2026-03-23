import prisma from "@/lib/prisma";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.warn("⚠️  REDIS_URL non défini — les notifications temps réel seront désactivées");
}
let publisher: Redis | null = null;
function getPublisher(): Redis | null {
  if (!redisUrl) return null;
  if (!publisher) {
    publisher = new Redis(redisUrl);
  }
  return publisher;
}

type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR" | "GRADE" | "PAYMENT" | "BULLETIN" | "ENROLLMENT" | "SYSTEM";

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

// Notify when a new grade is added
export async function notifyNewGrade(
  studentUserId: string,
  subjectName: string,
  grade: number
) {
  return createNotification({
    userId: studentUserId,
    type: "GRADE",
    title: "Nouvelle note",
    message: `Vous avez reçu une note de ${grade}/20 en ${subjectName}`,
    link: "/student/grades",
  });
}

// Notify when a payment is recorded
export async function notifyPayment(
  parentUserId: string,
  studentName: string,
  amount: number,
  feeName: string
) {
  return createNotification({
    userId: parentUserId,
    type: "PAYMENT",
    title: "Paiement enregistré",
    message: `Un paiement de ${amount} FCFA pour ${feeName} a été enregistré pour ${studentName}`,
    link: "/parent/payments",
  });
}

// Notify when bulletin is available
export async function notifyBulletinAvailable(
  studentUserId: string,
  periodName: string
) {
  return createNotification({
    userId: studentUserId,
    type: "BULLETIN",
    title: "Bulletin disponible",
    message: `Votre bulletin pour ${periodName} est maintenant disponible`,
    link: "/student/bulletins",
  });
}

// Notify new enrollment
export async function notifyEnrollment(
  studentUserId: string,
  className: string,
  academicYear: string
) {
  return createNotification({
    userId: studentUserId,
    type: "ENROLLMENT",
    title: "Inscription confirmée",
    message: `Votre inscription en ${className} pour l'année ${academicYear} a été confirmée`,
    link: "/dashboard",
  });
}

// System notification to all users of a school
export async function notifySchoolUsers(
  schoolId: string,
  title: string,
  message: string,
  link?: string
) {
  const users = await prisma.user.findMany({
    where: { schoolId, isActive: true },
    select: { id: true },
  });

  return createBulkNotifications({
    userIds: users.map((u) => u.id),
    type: "SYSTEM",
    title,
    message,
    link,
  });
}

// Get unread count for a user
export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

// Mark all as read for a user
export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
}

// Delete old notifications (older than 30 days)
export async function cleanupOldNotifications() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return prisma.notification.deleteMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      isRead: true,
    },
  });
}
