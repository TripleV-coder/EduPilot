import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";

const createMessageSchema = z.object({
  recipientId: z.string().cuid(),
  subject: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  parentId: z.string().cuid().optional(), // For replies
});

/**
 * GET /api/messages
 * List user's messages (inbox/sent)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "inbox"; // inbox | sent | archived
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    interface MessageWhereFilter {
      senderId?: string;
      recipientId?: string;
      deletedBySender?: boolean;
      deletedByRecipient?: boolean;
      isRead?: boolean;
      isArchived?: boolean;
    }

    const where: MessageWhereFilter = {};

    if (type === "inbox") {
      where.recipientId = session.user.id;
      where.deletedByRecipient = false;
      if (unreadOnly) {
        where.isRead = false;
      }
    } else if (type === "sent") {
      where.senderId = session.user.id;
      where.deletedBySender = false;
    } else if (type === "archived") {
      where.recipientId = session.user.id;
      where.isArchived = true;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          parent: {
            select: {
              id: true,
              subject: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    // Get unread count
    const unreadCount = await prisma.message.count({
      where: {
        recipientId: session.user.id,
        isRead: false,
        deletedByRecipient: false,
      },
    });

    return NextResponse.json({
      messages,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(" fetching messages:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages
 * Send a new message
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createMessageSchema.parse(body);

    // Verify recipient exists and is in same school (except SUPER_ADMIN)
    const recipient = await prisma.user.findUnique({
      where: { id: validatedData.recipientId },
      select: { id: true, schoolId: true, isActive: true },
    });

    if (!recipient || !recipient.isActive) {
      return NextResponse.json(
        { error: "Destinataire invalide" },
        { status: 400 }
      );
    }

    // School isolation check
    const accessError = ensureSchoolAccess(session, recipient.schoolId);
    if (accessError) {
      return accessError;
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        recipientId: validatedData.recipientId,
        subject: validatedData.subject,
        content: validatedData.content,
        parentId: validatedData.parentId,
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Create notification for recipient
    await prisma.notification.create({
      data: {
        userId: validatedData.recipientId,
        type: "MESSAGE",
        title: "Nouveau message",
        message: `${session.user.firstName} ${session.user.lastName} vous a envoyé un message: "${validatedData.subject}"`,
        link: `/messages/${message.id}`,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    logger.error(" creating message:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 }
    );
  }
}
