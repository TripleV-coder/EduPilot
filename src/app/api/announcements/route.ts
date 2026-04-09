import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma, AnnouncementType, AnnouncementPriority } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { cacheMiddleware, generateCacheKey, invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { getPaginationParams } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const createAnnouncementSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  type: z.enum(["GENERAL", "ACADEMIC", "EVENT", "URGENT", "MAINTENANCE", "HOLIDAY"]).default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  targetRoles: z.array(z.enum(["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT"])).optional(),
  isPublished: z.boolean().default(false),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  attachments: z.array(z.string().url()).optional(),
});

/**
 * GET /api/announcements
 * List announcements
 * @swagger
 * /api/announcements:
 *   get:
 *     summary: Liste des annonces
 *     description: Récupère les annonces publiées avec filtres optionnels
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *         description: Type d'annonce
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *         description: Priorité de l'annonce
 *       - name: includeExpired
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Inclure les annonces expirées
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
 *         description: Liste des annonces
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 announcements:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Cache key based on user role, school, and query params
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.searchParams);
    // Include role and schoolId in search params for cache key
    searchParams.set("role", session.user.role);
    const activeSchoolId = getActiveSchoolId(session);
    if (activeSchoolId) {
      searchParams.set("schoolId", activeSchoolId);
    }
    const cacheKey = generateCacheKey("/api/announcements", searchParams, session.user.id);

    const cachedHandler = cacheMiddleware({ ttl: 60, key: cacheKey }); // 60s cache for announcements

    const handler = async () => {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get("type");
      const priority = searchParams.get("priority");
      const includeExpired = searchParams.get("includeExpired") === "true";
      const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

      const where: Prisma.AnnouncementWhereInput = {
        isPublished: true,
      };

      // Multi-tenant filtering: users only see announcements from their school
      // SUPER_ADMIN can see all if no schoolId is provided in session (unlikely) or filters
      if (session.user.role !== "SUPER_ADMIN" && getActiveSchoolId(session)) {
        where.schoolId = getActiveSchoolId(session);
      }

      // Filter by type
      if (type) {
        where.type = type as AnnouncementType;
      }

      // Filter by priority
      if (priority) {
        where.priority = priority as AnnouncementPriority;
      }

      // Filter by expiration
      if (!includeExpired) {
        where.OR = [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ];
      }

      // Filter by user role - only show announcements targeted to user's role
      if (session.user.role) {
        where.OR = [
          { targetRoles: { isEmpty: true } }, // No specific roles = visible to all
          { targetRoles: { has: session.user.role } }, // Has user's role
        ];
      }

      const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
          where,
          select: {
            id: true,
            title: true,
            content: true,
            type: true,
            priority: true,
            isPublished: true,
            publishedAt: true,
            expiresAt: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
            school: {
              select: {
                name: true,
                logo: true,
              },
            },
          },
          orderBy: [
            { priority: "desc" },
            { publishedAt: "desc" },
          ],
          skip,
          take: limit,
        }),
        prisma.announcement.count({ where }),
      ]);

      return NextResponse.json({
        announcements,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    };

    const response = await cachedHandler(handler, request);
    return withHttpCache(response, request, { private: true, maxAge: 60, staleWhileRevalidate: 30 });
  } catch (error) {
    logger.error(" fetching announcements:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des annonces" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 * Create announcement (Admin/Director only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!getActiveSchoolId(session)) {
      return NextResponse.json(
        { error: "Utilisateur non associé à un établissement" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createAnnouncementSchema.parse(body);

    const targetSchoolId = session.user.role === "SUPER_ADMIN" ? (body.schoolId || getActiveSchoolId(session)) : getActiveSchoolId(session);

    if (!targetSchoolId) {
      return NextResponse.json(
        { error: "Établissement cible requis" },
        { status: 400 }
      );
    }

    const announcementData: Prisma.AnnouncementUncheckedCreateInput = {
      schoolId: targetSchoolId,
      title: validatedData.title,
      content: validatedData.content,
      type: validatedData.type as AnnouncementType,
      priority: validatedData.priority as AnnouncementPriority,
      targetRoles: validatedData.targetRoles || [],
      isPublished: validatedData.isPublished,
      attachments: validatedData.attachments || [],
      authorId: session.user.id,
    };

    if (validatedData.publishedAt) {
      announcementData.publishedAt = new Date(validatedData.publishedAt);
    } else if (validatedData.isPublished) {
      announcementData.publishedAt = new Date();
    }

    if (validatedData.expiresAt) {
      announcementData.expiresAt = new Date(validatedData.expiresAt);
    }

    const announcement = await prisma.announcement.create({
      data: announcementData,
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        school: {
          select: {
            name: true,
          },
        },
      },
    });

    // Create notifications if published
    if (announcement.isPublished) {
      // Get users to notify based on targetRoles
      const targetWhere: Prisma.UserWhereInput = {
        isActive: true,
        schoolId: announcement.schoolId, // LIMIT TO CURRENT TENANT
      };

      if (validatedData.targetRoles && validatedData.targetRoles.length > 0) {
        targetWhere.role = { in: validatedData.targetRoles as any };
      }

      const usersToNotify = await prisma.user.findMany({
        where: targetWhere,
        select: { id: true },
      });

      if (usersToNotify.length > 0) {
        const notifications: Prisma.NotificationCreateManyInput[] = usersToNotify.map((u) => ({
          userId: u.id,
          type: announcement.priority === "URGENT" ? "WARNING" : "INFO",
          title: `Nouvelle annonce: ${announcement.title}`,
          message: announcement.content.substring(0, 150) + (announcement.content.length > 150 ? "..." : ""),
          link: `/announcements/${announcement.id}`,
        }));

        await prisma.notification.createMany({
          data: notifications,
        });
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_ANNOUNCEMENT",
        entity: "Announcement",
        entityId: announcement.id,
        newValues: {
          title: announcement.title,
          type: announcement.type,
          priority: announcement.priority,
        },
      },
    });

    await invalidateByPath(CACHE_PATHS.announcements);

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { status: 400 }
      );
    }

    logger.error(" creating announcement:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'annonce" },
      { status: 500 }
    );
  }
}
