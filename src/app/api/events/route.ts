import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(["GENERAL", "SPORTS", "CULTURAL", "ACADEMIC", "FIELD_TRIP", "ASSEMBLY", "PARENT_MEETING", "GRADUATION", "COMPETITION", "WORKSHOP"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  location: z.string().optional(),
  maxParticipants: z.number().optional(),
  fee: z.number().optional(),
  requiresPermission: z.boolean().default(false),
  isPublished: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const upcoming = searchParams.get("upcoming") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {
      isPublished: true,
    };

    if (type) where.type = type;
    if (upcoming) where.startDate = { gte: new Date() };

    const [events, total] = await Promise.all([
      prisma.schoolEvent.findMany({
        where,
        include: {
          createdBy: {
            select: { firstName: true, lastName: true },
          },
          _count: {
            select: { participations: true },
          },
        },
        orderBy: { startDate: "asc" },
        skip,
        take: limit,
      }),
      prisma.schoolEvent.count({ where }),
    ]);

    return NextResponse.json({
      events,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error(" fetching events:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createEventSchema.parse(body);

    const event = await prisma.schoolEvent.create({
      data: {
        schoolId: session.user.schoolId!,
        title: validatedData.title,
        description: validatedData.description,
        type: validatedData.type,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        location: validatedData.location,
        maxParticipants: validatedData.maxParticipants,
        fee: validatedData.fee,
        requiresPermission: validatedData.requiresPermission,
        isPublished: validatedData.isPublished,
        createdById: session.user.id,
      },
    });

    // Notify all users if published
    if (validatedData.isPublished) {
      const users = await prisma.user.findMany({
        where: { schoolId: session.user.schoolId, isActive: true },
        select: { id: true },
      });

      await prisma.notification.createMany({
        data: users.map(u => ({
          userId: u.id,
          type: "INFO" as const,
          title: "Nouvel événement",
          message: `${validatedData.title} - ${new Date(validatedData.startDate).toLocaleDateString("fr-FR")}`,
          link: `/events/${event.id}`,
        })),
      });
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
    }
    logger.error(" creating event:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
