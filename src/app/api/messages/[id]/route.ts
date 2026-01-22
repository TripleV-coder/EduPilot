import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateMessageSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

/**
 * GET /api/messages/[id]
 * Get single message with thread
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id: params.id },
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
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        replies: {
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
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message non trouvé" },
        { status: 404 }
      );
    }

    // Check access
    if (
      message.senderId !== session.user.id &&
      message.recipientId !== session.user.id
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Mark as read if recipient is viewing
    if (message.recipientId === session.user.id && !message.isRead) {
      await prisma.message.update({
        where: { id: params.id },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    logger.error(" fetching message:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du message" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/messages/[id]
 * Update message status (read/archived)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateMessageSchema.parse(body);

    const message = await prisma.message.findUnique({
      where: { id: params.id },
      select: { senderId: true, recipientId: true },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message non trouvé" },
        { status: 404 }
      );
    }

    // Only recipient can update message status
    if (message.recipientId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const updateData: any = {};
    if (validatedData.isRead !== undefined) {
      updateData.isRead = validatedData.isRead;
      updateData.readAt = validatedData.isRead ? new Date() : null;
    }
    if (validatedData.isArchived !== undefined) {
      updateData.isArchived = validatedData.isArchived;
    }

    const updatedMessage = await prisma.message.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" updating message:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du message" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/[id]
 * Soft delete message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id: params.id },
      select: { senderId: true, recipientId: true },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message non trouvé" },
        { status: 404 }
      );
    }

    // Soft delete based on role
    const updateData: any = {};
    if (message.senderId === session.user.id) {
      updateData.deletedBySender = true;
    }
    if (message.recipientId === session.user.id) {
      updateData.deletedByRecipient = true;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Check if both deleted, then hard delete
    const currentMessage = await prisma.message.findUnique({
      where: { id: params.id },
      select: { deletedBySender: true, deletedByRecipient: true },
    });

    if (
      currentMessage &&
      (currentMessage.deletedBySender || updateData.deletedBySender) &&
      (currentMessage.deletedByRecipient || updateData.deletedByRecipient)
    ) {
      // Both parties deleted, hard delete
      await prisma.message.delete({
        where: { id: params.id },
      });
    } else {
      // Soft delete
      await prisma.message.update({
        where: { id: params.id },
        data: updateData,
      });
    }

    return NextResponse.json(
      { message: "Message supprimé avec succès" },
      { status: 200 }
    );
  } catch (error) {
    logger.error(" deleting message:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du message" },
      { status: 500 }
    );
  }
}
