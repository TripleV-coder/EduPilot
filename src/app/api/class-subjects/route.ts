import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { classSubjectSchema } from "@/lib/validations/subject";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { assertModelAccess, requireSchoolContext } from "@/lib/security/tenant";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";


interface ClassSubjectWhereFilter {
  classId?: string;
  teacherId?: string;
}

export const GET = createApiHandler(
  async (request, { session }, _t) => {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");

    const schoolContext = requireSchoolContext(session);
    if (schoolContext) return schoolContext;

    const where: Prisma.ClassSubjectWhereInput = {};
    const activeSchoolId = getActiveSchoolId(session);
    if (classId) {
      const classAccess = await assertModelAccess(session, "class", classId, "Classe introuvable");
      if (classAccess) return classAccess;
      where.classId = classId;
    }
    if (teacherId) {
      if (session.user.role !== "SUPER_ADMIN") {
        const teacher = await prisma.teacherProfile.findUnique({
          where: { id: teacherId },
          select: { schoolId: true },
        });
        if (!teacher) {
          return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }
        if (!activeSchoolId || !(await isTeacherAssignedToSchool(teacherId, activeSchoolId))) {
          return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }
      }
      where.teacherId = teacherId;
    }

    if (session.user.role !== "SUPER_ADMIN" && activeSchoolId) {
      where.class = { schoolId: activeSchoolId };
    }

    const classSubjects = await prisma.classSubject.findMany({
      where,
      include: {
        class: {
          include: { classLevel: true },
        },
        subject: true,
        teacher: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { subject: { name: "asc" } },
    });

    return NextResponse.json(classSubjects);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SUBJECT_READ],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const validatedData = classSubjectSchema.parse(body);

    const schoolContext = requireSchoolContext(session);
    if (schoolContext) return schoolContext;
    const activeSchoolId = getActiveSchoolId(session);

    const classAccess = await assertModelAccess(session, "class", validatedData.classId, "Classe introuvable");
    if (classAccess) return classAccess;

    const schoolClass = await prisma.class.findUnique({
      where: { id: validatedData.classId },
      select: { schoolId: true },
    });

    if (!schoolClass) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      const subject = await prisma.subject.findUnique({
        where: { id: validatedData.subjectId },
        select: { schoolId: true },
      });
      if (!subject) {
        return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
      }
      if (subject.schoolId !== schoolClass.schoolId) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }

      if (validatedData.teacherId) {
        const teacher = await prisma.teacherProfile.findUnique({
          where: { id: validatedData.teacherId },
          select: { schoolId: true },
        });
        if (!teacher) {
          return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }
        if (!activeSchoolId || !(await isTeacherAssignedToSchool(validatedData.teacherId, schoolClass.schoolId))) {
          return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }
      }
    }

    // Check if already exists
    const existing = await prisma.classSubject.findFirst({
      where: {
        classId: validatedData.classId,
        subjectId: validatedData.subjectId,
      },
    });

    if (existing) {
      return NextResponse.json(translateError(API_ERRORS.ALREADY_EXISTS("Matière assignée"), t), { status: 400 });
    }

    const classSubject = await prisma.classSubject.create({
      data: {
        classId: validatedData.classId,
        subjectId: validatedData.subjectId,
        teacherId: validatedData.teacherId,
        coefficient: validatedData.coefficient,
        weeklyHours: validatedData.weeklyHours,
      },
      include: {
        class: {
          include: { classLevel: true },
        },
        subject: true,
        teacher: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    return NextResponse.json(classSubject, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SUBJECT_UPDATE],
  }
);
