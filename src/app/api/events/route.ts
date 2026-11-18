import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma, EventType } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { familyStudents } from "@/lib/events/family";
import { getListWindow } from "@/lib/api/list-window";

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

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const upcoming = searchParams.get("upcoming") === "true";
    // N16 : taille plafonnée à 100, saisie non numérique → valeurs par défaut.
    // Lot 3 : curseur sur la date de début par défaut, ?page= toléré (ancien format).
    const list = getListWindow(request, { sortField: "startDate", direction: "asc", defaultLimit: 20, maxLimit: 100 });

    const where: Prisma.SchoolEventWhereInput = {
      isPublished: true,
    };

    if (session.user.role !== "SUPER_ADMIN" && getActiveSchoolId(session)) {
      where.schoolId = getActiveSchoolId(session);
    }

    if (type) where.type = type as EventType;
    if (upcoming) where.startDate = { gte: new Date() };

    const [events, total] = await Promise.all([
      prisma.schoolEvent.findMany({
        where: list.where(where),
        include: {
          createdBy: {
            select: { firstName: true, lastName: true },
          },
          _count: {
            select: { participations: true },
          },
        },
        orderBy: list.orderBy,
        skip: list.skip,
        take: list.take,
      }),
      list.needsTotal ? prisma.schoolEvent.count({ where }) : Promise.resolve(undefined),
    ]);

    // Élève ou parent : qui de la famille est inscrit à chaque évènement
    const viewerStudents = await familyStudents(session.user);
    if (viewerStudents.length > 0 && events.length > 0) {
      const registrations = await prisma.eventParticipation.findMany({
        where: { eventId: { in: events.map((e) => e.id) }, studentId: { in: viewerStudents.map((v) => v.id) } },
        select: { eventId: true, studentId: true },
      });
      const byEvent = new Map<string, string[]>();
      for (const r of registrations) byEvent.set(r.eventId, [...(byEvent.get(r.eventId) ?? []), r.studentId]);
      const withRegistrations = events.map((e) => ({ ...e, myRegistrations: byEvent.get(e.id) ?? [] }));
      return NextResponse.json({ ...list.page(withRegistrations, (event) => event.startDate, total), viewerStudents });
    }

    return NextResponse.json({ ...list.page(events, (event) => event.startDate, total), viewerStudents });
  
    } catch (error) {
    logger.error(" fetching events:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }

});

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const body = await request.json();
    const validatedData = createEventSchema.parse(body);

    const targetSchoolId =
      session.user.role === "SUPER_ADMIN"
        ? (body.schoolId || getActiveSchoolId(session) || null)
        : (getActiveSchoolId(session) || null);

    if (!targetSchoolId) {
      return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
    }

    const event = await prisma.schoolEvent.create({
      data: {
        schoolId: targetSchoolId,
        title: validatedData.title,
        description: validatedData.description,
        type: validatedData.type as EventType,
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
        where: { schoolId: targetSchoolId, isActive: true },
        select: { id: true },
      });

      await prisma.notification.createMany({
        data: users.map(u => ({
          userId: u.id,
          type: "INFO" as const,
          title: "Nouvel événement",
          message: `${validatedData.title} - ${new Date(validatedData.startDate).toLocaleDateString("fr-FR")}`,
          link: "/dashboard/events",
        })),
      });
    }

    return NextResponse.json(event, { status: 201 });
  
    } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating event:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] });
