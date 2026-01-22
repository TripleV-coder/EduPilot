import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { scheduleSchema } from "@/lib/validations/schedule";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";

interface ScheduleWhereFilter {
  classId?: string;
  dayOfWeek?: number;
  classSubjectId?: { in: string[] };
}

/**
 * GET /api/schedules
 * Obtenir l'emploi du temps
 */
export const GET = createApiHandler(
  async (request, { session: _session }, _t) => {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
    const dayOfWeek = searchParams.get("dayOfWeek");

    const where: ScheduleWhereFilter = {};
    if (classId) where.classId = classId;
    if (dayOfWeek) where.dayOfWeek = parseInt(dayOfWeek);
    if (teacherId) {
      const teacherSubjects = await prisma.classSubject.findMany({
        where: { teacherId },
        select: { id: true },
      });
      where.classSubjectId = {
        in: teacherSubjects.map((c) => c.id),
      };
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        class: {
          include: {
            classLevel: true,
            classSubjects: {
              include: {
                subject: true,
                teacher: {
                  include: {
                    user: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(schedules);
  },
  {
    requireAuth: true,
  }
);

/**
 * POST /api/schedules
 * Créer un créneau
 */
export const POST = createApiHandler(
  async (request, { session: _session }, t) => {
    const body = await request.json();
    const validatedData = scheduleSchema.parse(body);

    // Check for conflicts
    const conflictingSchedule = await prisma.schedule.findFirst({
      where: {
        classId: validatedData.classId,
        dayOfWeek: validatedData.dayOfWeek,
        OR: [
          {
            startTime: { lte: validatedData.startTime },
            endTime: { gt: validatedData.startTime },
          },
          {
            startTime: { lt: validatedData.endTime },
            endTime: { gte: validatedData.endTime },
          },
        ],
      },
    });

    if (conflictingSchedule) {
      return NextResponse.json(
        translateError({ error: "Un créneau existe déjà à cette heure pour cette classe", key: "api.issues.already_exists", params: { resource: "Créneau" } }, t),
        { status: 400 }
      );
    }

    const schedule = await prisma.schedule.create({
      data: {
        classId: validatedData.classId,
        classSubjectId: validatedData.classSubjectId, // Ensure this field exists in schema and model
        dayOfWeek: validatedData.dayOfWeek,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        room: validatedData.room,
      },
      include: {
        class: {
          include: { classLevel: true },
        },
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
