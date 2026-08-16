import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { cacheMiddleware, generateCacheKey, invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { createApiHandler, getPaginationParams } from "@/lib/api/api-helpers";

import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";
import { sanitizePlainText } from "@/lib/sanitize";
import { checkRateLimit, strictLimiter } from "@/lib/rate-limit";
import { createNotification } from "@/lib/services/notification.service";

const createMessageSchema = z.object({
  recipientId: z.string().cuid(),
  subject: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  parentId: z.string().cuid().optional(), // For replies
});

/**
 * GET /api/messages
 * List user's messages (inbox/sent)
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Liste des messages
 *     description: Récupère les messages (boîte de réception, envoyés, archivés)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [inbox, sent, archived]
 *           default: inbox
 *         description: Type de messages à récupérer
 *       - name: unreadOnly
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filtrer uniquement les messages non lus (pour inbox)
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Liste des messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                 unreadCount:
 *                   type: integer
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export const GET = createApiHandler(async (request, context) => {
  try {
    // Cache key based on user and query params
    const url = new URL(request.url);
    const cacheKey = generateCacheKey("/api/messages", url.searchParams, context.session.user.id);

    const cachedHandler = cacheMiddleware({ ttl: 30, key: cacheKey }); // 30s cache for messages

    const handler = async () => {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get("type") || "inbox"; // inbox | sent | archived
      const unreadOnly = searchParams.get("unreadOnly") === "true";
      const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

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
        where.recipientId = context.session.user.id;
        where.deletedByRecipient = false;
        if (unreadOnly) {
          where.isRead = false;
        }
      } else if (type === "sent") {
        where.senderId = context.session.user.id;
        where.deletedBySender = false;
      } else if (type === "archived") {
        where.recipientId = context.session.user.id;
        where.isArchived = true;
      }

      const [messages, total, unreadCount] = await Promise.all([
        prisma.message.findMany({
          where,
          select: {
            id: true,
            subject: true,
            content: true,
            isRead: true,
            isArchived: true,
            createdAt: true,
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
        type === "inbox"
          ? prisma.message.count({
            where: {
              recipientId: context.session.user.id,
              isRead: false,
              deletedByRecipient: false,
            },
          })
          : Promise.resolve(0),
      ]);

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
    };

    const response = await cachedHandler(handler, request);
    return withHttpCache(response, request, { private: true, maxAge: 30, staleWhileRevalidate: 15 });
  } catch (error) {
    logger.error(" fetching messages:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des messages" },
      { status: 500 }
    );
  }
});

/**
 * POST /api/messages
 * Send a new message
 */
export const POST = createApiHandler(async (request, context) => {
  try {
    // Anti-spam : 20 messages / minute par utilisateur
    const rate = await checkRateLimit(strictLimiter, `messages:${context.session.user.id}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Trop de messages envoyés. Réessayez dans une minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = createMessageSchema.parse(body);

    if (validatedData.recipientId === context.session.user.id) {
      return NextResponse.json(
        { error: "Impossible de s'envoyer un message à soi-même" },
        { status: 400 }
      );
    }

    // If this is a reply, verify parent message access
    if (validatedData.parentId) {
      const parentMessage = await prisma.message.findUnique({
        where: { id: validatedData.parentId },
        select: { senderId: true, recipientId: true },
      });

      if (!parentMessage || (parentMessage.senderId !== context.session.user.id && parentMessage.recipientId !== context.session.user.id)) {
        return NextResponse.json(
          { error: "Message parent invalide ou accès refusé" },
          { status: 403 }
        );
      }
    }

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
    const accessError = ensureSchoolAccess(context.session, recipient.schoolId);
    if (accessError) {
      return accessError;
    }

    // Neutralise tout HTML embarqué (le contenu est rendu en texte,
    // mais on ne stocke jamais de payload script en base)
    const subject = sanitizePlainText(validatedData.subject);
    const content = sanitizePlainText(validatedData.content);

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId: context.session.user.id,
        recipientId: validatedData.recipientId,
        subject,
        content,
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

    // Notification destinataire — createNotification publie aussi sur Redis
    // (publisher singleton, livraison SSE immédiate si REDIS_URL configuré)
    await createNotification({
      userId: validatedData.recipientId,
      type: "MESSAGE",
      title: "Nouveau message",
      message: `${context.session.user.firstName} ${context.session.user.lastName} vous a envoyé un message: "${subject}"`,
      link: "/dashboard/messages",
    });

    await invalidateByPath(CACHE_PATHS.messages);

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
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

    logger.error("Error creating message", error as Error, { module: "api/messages" });
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 }
    );
  }
});
