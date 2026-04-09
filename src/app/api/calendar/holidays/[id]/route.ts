import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { schoolHolidaySchema } from "@/lib/validations/calendar";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { canAccessSchool } from "@/lib/api/tenant-isolation";

/**
 * GET /api/calendar/holidays/[id]
 * Détails d'une vacance scolaire
 */
export const GET = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    const holiday = await prisma.schoolHoliday.findUnique({
      where: { id },
      include: {
        academicYear: {
          select: { name: true },
        },
      },
    });

    if (!holiday) {
      return NextResponse.json(
        translateError({ error: "Vacances non trouvées", key: "api.issues.not_found", params: { resource: "Vacances" } }, t),
        { status: 404 }
      );
    }

    // Vérifier l'accès
    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, holiday.schoolId)) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    return NextResponse.json(holiday);
  },
  {
    requireAuth: true,
  }
);

/**
 * PUT /api/calendar/holidays/[id]
 * Mettre à jour des vacances scolaires
 */
export const PUT = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    // Check existence and permissions first
    const holiday = await prisma.schoolHoliday.findUnique({
      where: { id },
    });

    if (!holiday) {
      return NextResponse.json(
        translateError({ error: "Vacances non trouvées", key: "api.issues.not_found", params: { resource: "Vacances" } }, t),
        { status: 404 }
      );
    }

    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, holiday.schoolId)) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    const body = await request.json();
    const data = schoolHolidaySchema.partial().parse(body);

    const updated = await prisma.schoolHoliday.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.type && { type: data.type }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: {
        academicYear: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(updated);
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);

/**
 * DELETE /api/calendar/holidays/[id]
 * Supprimer des vacances scolaires
 */
export const DELETE = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;
    const holiday = await prisma.schoolHoliday.findUnique({
      where: { id },
    });

    if (!holiday) {
      return NextResponse.json(
        translateError({ error: "Vacances non trouvées", key: "api.issues.not_found", params: { resource: "Vacances" } }, t),
        { status: 404 }
      );
    }

    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, holiday.schoolId)) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    await prisma.schoolHoliday.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Vacances supprimées" });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
