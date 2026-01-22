import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { teacherCreateSchema } from "@/lib/validations/user";
import { logger } from "@/lib/utils/logger";
import { sanitizeRequestBody } from "@/lib/sanitize";
import { createApiHandler, createPaginatedResponse, getPaginationParams, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";

interface TeacherWhereFilter {
  user?: {
    schoolId?: string | null;
  };
  schoolId?: string;
}

export const GET = createApiHandler(
  async (request, { session }, _t) => {
    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

    const where: TeacherWhereFilter = {};

    if (session.user.role !== "SUPER_ADMIN") {
      where.user = { schoolId: session.user.schoolId };
    }

    const [teachers, total] = await Promise.all([
      prisma.teacherProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              isActive: true,
              schoolId: true,
              school: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          classSubjects: {
            take: 10,
            include: {
              class: {
                include: { classLevel: true },
              },
              subject: true,
            },
          },
          mainClasses: {
            include: { classLevel: true },
          },
        },
        orderBy: { user: { lastName: "asc" } },
        skip,
        take: limit,
      }),
      prisma.teacherProfile.count({ where }),
    ]);

    return createPaginatedResponse(teachers, page, limit, total);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.TEACHER_READ],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const sanitizedBody = sanitizeRequestBody(body);
    const validatedData = teacherCreateSchema.parse(sanitizedBody);

    const schoolId = session.user.schoolId;
    if (!schoolId && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    if (session.user.role === "SUPER_ADMIN" && !schoolId) {
      return NextResponse.json(translateError({ error: "Vous devez sélectionner un établissement", key: "api.issues.school_required" }, t), { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        translateError(API_ERRORS.ALREADY_EXISTS("Un utilisateur avec cet email"), t),
        { status: 400 }
      );
    }

    if (validatedData.matricule && schoolId) {
      const existingTeacher = await prisma.teacherProfile.findFirst({
        where: {
          schoolId,
          matricule: validatedData.matricule,
        },
      });

      if (existingTeacher) {
        return NextResponse.json(
          translateError(API_ERRORS.ALREADY_EXISTS("Un enseignant avec ce matricule"), t),
          { status: 400 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validatedData.email.toLowerCase(),
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          phone: validatedData.phone,
          password: hashedPassword,
          role: "TEACHER",
          schoolId,
        },
      });

      const teacherProfile = await tx.teacherProfile.create({
        data: {
          userId: user.id,
          schoolId: schoolId!,
          matricule: validatedData.matricule,
          specialization: validatedData.specialization,
          hireDate: validatedData.hireDate,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Teacher",
          entityId: teacherProfile.id,
          newValues: { email: validatedData.email, specialization: validatedData.specialization },
        },
      });

      return {
        ...teacherProfile,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    });

    logger.info("Teacher created", { teacherId: result.id, createdBy: session.user.id });
    return NextResponse.json(result, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.TEACHER_CREATE],
  }
);
