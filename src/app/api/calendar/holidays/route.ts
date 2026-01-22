import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { schoolHolidaySchema } from "@/lib/validations/calendar";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";

/**
 * GET /api/calendar/holidays
 * Liste des vacances scolaires
 */
export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const schoolId =
      session.user.role === "SUPER_ADMIN" ? searchParams.get("schoolId") : session.user.schoolId;

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const where: any = { schoolId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const holidays = await prisma.schoolHoliday.findMany({
      where,
      include: {
        academicYear: {
          select: { name: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(holidays);
  },
  {
    requireAuth: true,
  }
);

/**
 * POST /api/calendar/holidays
 * Créer des vacances scolaires
 */
export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const data = schoolHolidaySchema.parse(body);

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

    const holiday = await prisma.schoolHoliday.create({
      data: {
        schoolId: academicYear.schoolId,
        academicYearId: data.academicYearId,
        name: data.name,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        description: data.description,
      },
      include: {
        academicYear: {
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
