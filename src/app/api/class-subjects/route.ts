import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { classSubjectSchema } from "@/lib/validations/subject";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";


interface ClassSubjectWhereFilter {
  classId?: string;
  teacherId?: string;
}

export const GET = createApiHandler(
  async (request, { session: _session }, _t) => {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");

    const where: ClassSubjectWhereFilter = {};
    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;

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
  async (request, { session: _session }, t) => {
    const body = await request.json();
    const validatedData = classSubjectSchema.parse(body);

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
