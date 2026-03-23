import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { calendarEventSchema } from "@/lib/validations/calendar";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";

/**
 * GET /api/calendar/events
 * Liste des événements du calendrier
 */
export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const type = searchParams.get("type");
    const schoolId =
      session.user.role === "SUPER_ADMIN" ? searchParams.get("schoolId") : session.user.schoolId;

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const where: Prisma.SchoolCalendarEventWhereInput = { schoolId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    if (type) {
      where.type = type as Prisma.EnumCalendarEventTypeFilter;
    }

    // Filtrer par rôle si nécessaire
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      where.OR = [
        { isPublic: true },
        { targetRoles: { has: session.user.role } },
      ];
    }

    const events = await prisma.schoolCalendarEvent.findMany({
      where,
      include: {
        academicYear: {
          select: { name: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(events);
  },
  {
    requireAuth: true,
  }
);

/**
 * POST /api/calendar/events
 * Créer un événement de calendrier
 */
export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const data = calendarEventSchema.parse(body);

    // Vérifier l'accès à l'année académique
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
      select: { schoolId: true },
    });

    if (!academicYear) {
      return NextResponse.json(
        translateError({ error: "Année scolaire non trouvée", key: "api.issues.not_found", params: { resource: "Année scolaire" } }, t),
        { status: 404 }
      );
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      academicYear.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    const event = await prisma.schoolCalendarEvent.create({
      data: {
        schoolId: academicYear.schoolId,
        academicYearId: data.academicYearId,
        name: data.name,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        isAllDay: data.isAllDay,
        description: data.description,
        isPublic: data.isPublic,
        targetRoles: data.targetRoles,
      },
      include: {
        academicYear: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(event, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
