import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { classSchema } from "@/lib/validations/school";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import type { ClassWhereFilter } from "@/lib/types/api";
import { Permission } from "@/lib/rbac/permissions";
import { API_ERRORS } from "@/lib/constants/api-messages";

export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || session.user.schoolId;
    const classLevelId = searchParams.get("classLevelId");

    // Security: Non-SUPER_ADMIN can only access their school
    if (session.user.role !== "SUPER_ADMIN" && schoolId !== session.user.schoolId) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const where: ClassWhereFilter = { schoolId };
    if (classLevelId) where.classLevelId = classLevelId;

    const classes = await prisma.class.findMany({
      where,
      include: {
        classLevel: true,
        mainTeacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollments: {
              where: { status: "ACTIVE" },
            },
            classSubjects: true,
          },
        },
      },
      orderBy: [{ classLevel: { sequence: "asc" } }, { name: "asc" }],
    });

    return NextResponse.json(classes);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.CLASS_READ],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const validatedData = classSchema.parse(body);

    // Get schoolId - SUPER_ADMIN must get it from classLevel
    let schoolId: string | null = session.user.schoolId;

    if (session.user.role === "SUPER_ADMIN" && !schoolId) {
      // Get school from classLevel
      const classLevel = await prisma.classLevel.findUnique({
        where: { id: validatedData.classLevelId },
        select: { schoolId: true },
      });
      schoolId = classLevel?.schoolId || null;
    }

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    // Verify classLevel belongs to the school
    const classLevel = await prisma.classLevel.findUnique({
      where: { id: validatedData.classLevelId },
      select: { schoolId: true },
    });

    if (!classLevel || classLevel.schoolId !== schoolId) {
      return NextResponse.json(
        { ...translateError(API_ERRORS.INVALID_DATA, t), error: t("api.issues.invalid_class_level_ownership") || "Ce niveau n'appartient pas à votre établissement" },
        { status: 403 }
      );
    }

    // Check if class name already exists for this level
    const existing = await prisma.class.findFirst({
      where: {
        schoolId,
        classLevelId: validatedData.classLevelId,
        name: validatedData.name,
      },
    });

    if (existing) {
      return NextResponse.json(
        translateError(API_ERRORS.ALREADY_EXISTS("Une classe avec ce nom"), t),
        { status: 400 }
      );
    }

    // If mainTeacherId provided, verify teacher belongs to school
    if (validatedData.mainTeacherId) {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { id: validatedData.mainTeacherId },
        select: { schoolId: true },
      });

      if (!teacher || teacher.schoolId !== schoolId) {
        return NextResponse.json(
          { ...translateError(API_ERRORS.INVALID_DATA, t), error: t("api.issues.invalid_teacher_ownership") || "Cet enseignant n'appartient pas à votre établissement" },
          { status: 403 }
        );
      }
    }

    const newClass = await prisma.class.create({
      data: {
        schoolId,
        classLevelId: validatedData.classLevelId,
        name: validatedData.name,
        capacity: validatedData.capacity,
        mainTeacherId: validatedData.mainTeacherId,
      },
      include: {
        classLevel: true,
        mainTeacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(newClass, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.CLASS_CREATE],
  }
);
