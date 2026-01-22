import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";

const gradeUpdateSchema = z.object({
  value: z.coerce.number().min(0).max(20).optional().nullable(),
  isAbsent: z.boolean().optional(),
  isExcused: z.boolean().optional(),
  comment: z.string().optional().nullable(),
});

export const GET = createApiHandler(
  async (request, { params }, t) => {
    const { id } = await params;
    const grade = await prisma.grade.findUnique({
      where: { id },
      include: {
        evaluation: {
          include: {
            classSubject: {
              include: {
                class: true,
                subject: true,
              },
            },
            period: true,
            type: true,
          },
        },
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!grade) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Note"), t), { status: 404 });
    }

    return NextResponse.json(grade);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.GRADE_READ],
  }
);

export const PATCH = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;

    const existingGrade = await prisma.grade.findUnique({
      where: { id },
      include: {
        evaluation: {
          include: {
            classSubject: true,
          },
        },
      },
    });

    if (!existingGrade) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Note"), t), { status: 404 });
    }

    // Teachers can only update grades for their own class subjects
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (existingGrade.evaluation.classSubject.teacherId !== teacherProfile?.id) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    const body = await request.json();
    const validatedData = gradeUpdateSchema.parse(body);

    const updatedGrade = await prisma.grade.update({
      where: { id },
      data: validatedData,
      include: {
        evaluation: true,
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedGrade);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.GRADE_UPDATE],
  }
);

export const DELETE = createApiHandler(
  async (request, { params, session }, t) => {
    const { id } = await params;

    const existingGrade = await prisma.grade.findUnique({
      where: { id },
      include: {
        evaluation: {
          include: {
            classSubject: true,
          },
        },
      },
    });

    if (!existingGrade) {
      return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Note"), t), { status: 404 });
    }

    // Teachers can only delete grades for their own class subjects
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (existingGrade.evaluation.classSubject.teacherId !== teacherProfile?.id) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }
    }

    await prisma.grade.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.GRADE_DELETE],
  }
);
