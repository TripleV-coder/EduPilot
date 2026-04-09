import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { publicHolidaySchema } from "@/lib/validations/calendar";
import { createApiHandler } from "@/lib/api/api-helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/calendar/public-holidays
 * Liste des jours fériés
 */
export const GET = createApiHandler(
  async (request, { session }, _t) => {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const activeSchoolId = getActiveSchoolId(session);
    const schoolId =
      requestedSchoolId || activeSchoolId;

    const where: Prisma.PublicHolidayWhereInput = {
      OR: [
        { schoolId: null }, // Jours fériés nationaux
        ...(schoolId ? [{ schoolId }] : []), // Jours fériés de l'école
      ],
    };

    if (year) {
      const yearNum = parseInt(year);
      where.date = {
        gte: new Date(`${yearNum}-01-01`),
        lte: new Date(`${yearNum}-12-31`),
      };
    }

    const holidays = await prisma.publicHoliday.findMany({
      where,
      include: {
        school: {
          select: { name: true },
        },
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(holidays);
  },
  {
    requireAuth: true,
  }
);

/**
 * POST /api/calendar/public-holidays
 * Créer un jour férié
 */
export const POST = createApiHandler(
  async (request, { session }, _t) => {
    const body = await request.json();
    const data = publicHolidaySchema.parse(body);
    const activeSchoolId = getActiveSchoolId(session);

    // Les jours fériés nationaux ne peuvent être créés que par super admin
    const schoolId =
      body.isNational && session.user.role === "SUPER_ADMIN" ? null : activeSchoolId;

    const holiday = await prisma.publicHoliday.create({
      data: {
        schoolId,
        name: data.name,
        type: data.type,
        date: new Date(data.date),
        isRecurring: data.isRecurring,
        description: data.description,
      },
      include: {
        school: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(holiday, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
