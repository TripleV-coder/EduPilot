import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { scheduleSchema } from "@/lib/validations/schedule";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { canAccessSchool, ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { assertModelAccess, requireSchoolContext } from "@/lib/security/tenant";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";

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
  async (request, { session }, _t) => {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
    const dayOfWeek = searchParams.get("dayOfWeek");
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const activeSchoolId = getActiveSchoolId(session);
    const scopedSchoolId = requestedSchoolId || activeSchoolId;

    const schoolContext = requireSchoolContext(session);
    if (schoolContext) return schoolContext;

    const where: Prisma.ScheduleWhereInput = {};
    if (classId) {
      const classAccess = await assertModelAccess(session, "class", classId, "Classe introuvable");
      if (classAccess) return classAccess;
      where.classId = classId;
    }
    if (dayOfWeek) where.dayOfWeek = parseInt(dayOfWeek);
    if (teacherId) {
      if (session.user.role !== "SUPER_ADMIN") {
        const teacher = await prisma.teacherProfile.findUnique({
          where: { id: teacherId },
          select: { schoolId: true },
        });
        if (!teacher) {
          return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }
        if (!scopedSchoolId || !(await isTeacherAssignedToSchool(teacherId, scopedSchoolId))) {
          return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }
      }
      const teacherSubjects = await prisma.classSubject.findMany({
        where: session.user.role === "SUPER_ADMIN"
          ? { teacherId }
          : { teacherId, class: { schoolId: scopedSchoolId || undefined } },
        select: { id: true },
      });
      where.classSubjectId = {
        in: teacherSubjects.map((c) => c.id),
      };
    }

    if (session.user.role !== "SUPER_ADMIN") {
      where.class = { schoolId: scopedSchoolId || undefined };
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
  async (request, { session }, t) => {
    const body = await request.json();
    const validatedData = scheduleSchema.parse(body);

    const schoolContext = requireSchoolContext(session);
    if (schoolContext) return schoolContext;

    const classAccess = await assertModelAccess(session, "class", validatedData.classId, "Classe introuvable");
    if (classAccess) return classAccess;

    let teacherIdForConflict: string | null = null;
    if (validatedData.classSubjectId) {
      const classSubject = await prisma.classSubject.findUnique({
        where: { id: validatedData.classSubjectId },
        select: { classId: true, teacherId: true, class: { select: { schoolId: true } } },
      });
      if (!classSubject) {
        return NextResponse.json({ error: "Matière de classe introuvable" }, { status: 404 });
      }
      if (classSubject.classId !== validatedData.classId) {
        return NextResponse.json({ error: "Cette matière n'appartient pas à la classe sélectionnée" }, { status: 400 });
      }
      if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, classSubject.class.schoolId)) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
      if (
        session.user.role !== "SUPER_ADMIN" &&
        classSubject.teacherId &&
        !(await isTeacherAssignedToSchool(classSubject.teacherId, classSubject.class.schoolId))
      ) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
      teacherIdForConflict = classSubject.teacherId;
    }

    // Check for conflicts (Class level)
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

    // Check for conflicts (Teacher level)
    if (teacherIdForConflict) {
      const teacherConflict = await prisma.schedule.findFirst({
        where: {
          classSubject: { teacherId: teacherIdForConflict },
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

      if (teacherConflict) {
        return NextResponse.json(
          translateError({ error: "L'enseignant est déjà assigné à un autre cours sur cette plage horaire", key: "api.issues.teacher_conflict" }, t),
          { status: 400 }
        );
      }
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
