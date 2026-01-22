import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

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
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const includeExpired = searchParams.get("includeExpired") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {
      isPublished: true,
    };

    // Filter by type
    if (type) {
      where.type = type;
    }

    // Filter by priority
    if (priority) {
      where.priority = priority;
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
        include: {
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

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: "Utilisateur non associé à un établissement" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createAnnouncementSchema.parse(body);

    const announcementData: any = {
      title: validatedData.title,
      content: validatedData.content,
      type: validatedData.type,
      priority: validatedData.priority,
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
      const targetWhere: any = {
        isActive: true,
      };

      if (validatedData.targetRoles && validatedData.targetRoles.length > 0) {
        targetWhere.role = { in: validatedData.targetRoles };
      }

      const usersToNotify = await prisma.user.findMany({
        where: targetWhere,
        select: { id: true },
      });

      if (usersToNotify.length > 0) {
        const notifications = usersToNotify.map((u) => ({
          userId: u.id,
          type: announcement.priority === "URGENT" ? "WARNING" : "INFO",
          title: `Nouvelle annonce: ${announcement.title}`,
          message: announcement.content.substring(0, 150) + (announcement.content.length > 150 ? "..." : ""),
          link: `/announcements/${announcement.id}`,
        }));

        await prisma.notification.createMany({
          data: notifications as any,
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

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
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
