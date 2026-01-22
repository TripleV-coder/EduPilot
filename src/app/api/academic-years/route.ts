import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { academicYearSchema } from "@/lib/validations/school";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";


export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || session.user.schoolId;

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.MISSING_PERMISSIONS, t), { status: 400 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      schoolId !== session.user.schoolId
    ) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId },
      include: {
        periods: {
          orderBy: { sequence: "asc" },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(academicYears);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.ACADEMIC_YEAR_READ],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    let schoolId = session.user.schoolId;
    const body = await request.json();

    if (session.user.role === "SUPER_ADMIN" && body.schoolId) {
      schoolId = body.schoolId;
    }

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const validatedData = academicYearSchema.parse(body);

    // Check if year name already exists for this school
    const existing = await prisma.academicYear.findFirst({
      where: { schoolId, name: validatedData.name },
    });

    if (existing) {
      return NextResponse.json(translateError(API_ERRORS.ALREADY_EXISTS("Année scolaire"), t), { status: 409 });
    }

    // Get academic config for periods
    const academicConfig = await prisma.academicConfig.findFirst({
      where: { schoolId },
    });

    // If this year is set as current, unset others
    if (validatedData.isCurrent) {
      await prisma.academicYear.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId,
        name: validatedData.name,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        isCurrent: validatedData.isCurrent,
      },
    });

    // Auto-create periods based on config
    if (academicConfig) {
      const periodType = academicConfig.periodType;
      const periodsCount = academicConfig.periodsCount;
      const periodLabels = periodType === "SEMESTER"
        ? ["1er Semestre", "2ème Semestre"]
        : ["1er Trimestre", "2ème Trimestre", "3ème Trimestre"];

      const totalDays = Math.floor(
        (validatedData.endDate.getTime() - validatedData.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysPerPeriod = Math.floor(totalDays / periodsCount);

      for (let i = 0; i < periodsCount; i++) {
        const periodStart = new Date(validatedData.startDate);
        periodStart.setDate(periodStart.getDate() + i * daysPerPeriod);

        const periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + daysPerPeriod - 1);

        await prisma.period.create({
          data: {
            academicYearId: academicYear.id,
            name: periodLabels[i] || `Période ${i + 1}`,
            type: periodType,
            startDate: periodStart,
            endDate: i === periodsCount - 1 ? validatedData.endDate : periodEnd,
            sequence: i + 1,
          },
        });
      }
    }

    const result = await prisma.academicYear.findUnique({
      where: { id: academicYear.id },
      include: {
        periods: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json(result, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.ACADEMIC_YEAR_CREATE],
  }
);
