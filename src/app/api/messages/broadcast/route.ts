import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import Redis from "ioredis";

const broadcastSchema = z.object({
    classId: z.string().cuid(),
    subject: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
});

async function publishNotification(userId: string, payload: any) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;
    try {
        const redis = new Redis(redisUrl);
        await redis.publish(`notifications:${userId}`, JSON.stringify(payload));
        await redis.quit();
    } catch {
        // silent (SSE fallback polling DB still works)
    }
}

/**
 * POST /api/messages/broadcast
 * Send a message to all parents of students in a given class
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const body = await req.json();
        const { classId, subject, content } = broadcastSchema.parse(body);

        // Verify the class belongs to the user's school
        const classRecord = await prisma.class.findUnique({
            where: { id: classId },
            select: { id: true, name: true, schoolId: true },
        });

        if (!classRecord) {
            return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
        }

        if (session.user.role !== "SUPER_ADMIN" && classRecord.schoolId !== session.user.schoolId) {
            return NextResponse.json({ error: "Accès non autorisé à cette classe" }, { status: 403 });
        }

        // Get all parents of students enrolled in this class
        const enrollments = await prisma.enrollment.findMany({
            where: {
                classId,
                status: "ACTIVE",
            },
            select: {
                student: {
                    select: {
                        parentStudents: {
                            select: {
                                parent: {
                                    select: {
                                        userId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Collect unique parent user IDs
        const parentUserIds = new Set<string>();
        enrollments.forEach((enrollment) => {
            enrollment.student.parentStudents.forEach((ps) => {
                parentUserIds.add(ps.parent.userId);
            });
        });

        if (parentUserIds.size === 0) {
            return NextResponse.json({
                error: "Aucun parent trouvé pour cette classe",
                sent: 0,
            }, { status: 400 });
        }

        // Create messages in batch
        const recipientIds = Array.from(parentUserIds);
        const messages = await prisma.message.createMany({
            data: recipientIds.map((recipientId) => ({
                senderId: session.user.id,
                recipientId,
                subject,
                content,
            })),
        });

        // Create notifications (batch)
        await prisma.notification.createMany({
            data: recipientIds.map((userId) => ({
                userId,
                type: "MESSAGE",
                title: "Nouveau message",
                message: `${session.user.firstName} ${session.user.lastName} vous a envoyé un message: "${subject}"`,
                link: `/dashboard/messages`,
            })),
        });

        // Best-effort realtime push
        await Promise.all(
            recipientIds.slice(0, 200).map((userId) =>
                // Les notifications ont été créées via createMany (pas de payload détaillé à publier).
                // On déclenche donc un refresh côté client pour qu'il refetch proprement.
                publishNotification(userId, { REFRESH_REQUIRED: true })
            )
        );

        await invalidateByPath(CACHE_PATHS.messages).catch(() => {});

        logger.info("Broadcast message sent", {
            classId,
            className: classRecord.name,
            sentBy: session.user.id,
            recipientCount: messages.count,
        });

        return NextResponse.json({
            success: true,
            sent: messages.count,
            className: classRecord.name,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
        }
        logger.error("Broadcast error", error);
        return NextResponse.json({ error: "Erreur lors de l'envoi groupé" }, { status: 500 });
    }
}
