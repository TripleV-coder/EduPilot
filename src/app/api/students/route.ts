import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { studentCreateSchema } from "@/lib/validations/user";
import type { StudentWhereFilter } from "@/lib/types/api";
import { logger } from "@/lib/utils/logger";
import { sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler, getPaginationParams, createPaginatedResponse, translateError } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";

import { API_ERRORS } from "@/lib/constants/api-messages";

export const GET = createApiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const academicYearId = searchParams.get("academicYearId");
    const search = searchParams.get("search");

    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

    const where: StudentWhereFilter = {};

    if (session.user.role !== "SUPER_ADMIN") {
      where.user = { schoolId: session.user.schoolId };
    }

    if (classId || academicYearId) {
      where.enrollments = {
        some: {
          ...(classId && { classId }),
          ...(academicYearId && { academicYearId }),
          status: "ACTIVE",
        },
      };
    }

    // Search logic (text search)
    if (search) {
      const sanitizedSearch = sanitizePlainText(search);
      where.OR = [
        { matricule: { contains: sanitizedSearch, mode: "insensitive" } },
        { user: { firstName: { contains: sanitizedSearch, mode: "insensitive" } } },
        { user: { lastName: { contains: sanitizedSearch, mode: "insensitive" } } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              schoolId: true,
            },
          },
          enrollments: {
            where: { status: "ACTIVE" },
            include: { class: true }
          }
        },
        skip,
        take: limit,
        orderBy: { user: { lastName: "asc" } }
      }),
      prisma.studentProfile.count({ where })
    ]);

    const formattedStudents = students.map(student => ({
      ...student,
      user: {
        id: student.user.id,
        email: student.user.email,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        schoolId: student.user.schoolId,
      },
    }));

    return createPaginatedResponse(formattedStudents, page, limit, total);
  },
  {
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT"],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    // Custom auth check for school ID presence
    if (session.user.role !== "SUPER_ADMIN" && !session.user.schoolId) {
      return NextResponse.json(translateError({ error: "Aucun établissement associé", key: "api.issues.no_school_associated" }, t), { status: 403 });
    }

    const body = await request.json();
    const validatedData = studentCreateSchema.parse(body);

    // Validate Class ID if provided
    if (validatedData.classId) {
      const classExists = await prisma.class.findUnique({
        where: { id: validatedData.classId },
      });

      if (!classExists) {
        return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Classe"), t), { status: 404 });
      }

      // Ensure class belongs to the same school
      if (session.user.role !== "SUPER_ADMIN" && classExists.schoolId !== session.user.schoolId) {
        return NextResponse.json({
          ...translateError(API_ERRORS.INVALID_DATA, t),
          error: t("api.issues.invalid_class_ownership")
        }, { status: 400 });
      }
    }

    // Determine schoolId for the new user
    const schoolId = session.user.role === "SUPER_ADMIN" && validatedData.classId
      ? (await prisma.class.findUnique({ where: { id: validatedData.classId }, select: { schoolId: true } }))?.schoolId
      : session.user.schoolId;

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    // Check email uniqueness explicitly to match previous behavior/tests
    if (validatedData.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });
      if (existingUser) {
        return NextResponse.json(translateError(API_ERRORS.ALREADY_EXISTS("Un utilisateur avec cet email"), t), { status: 400 });
      }
    }

    const hashedPassword = validatedData.password ? await bcrypt.hash(validatedData.password, 10) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          password: hashedPassword || await bcrypt.hash(Math.random().toString(36), 10), // Fallback if password missing (should be covered by validation)
          role: "STUDENT",
          schoolId: schoolId,
          phone: validatedData.phone,
        },
      });

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          matricule: validatedData.matricule,
          dateOfBirth: validatedData.dateOfBirth,
          gender: validatedData.gender,
          birthPlace: validatedData.birthPlace,
          nationality: validatedData.nationality,
          address: validatedData.address,
          schoolId: schoolId,
        },
      });

      if (validatedData.classId && validatedData.academicYearId) {
        await tx.enrollment.create({
          data: {
            studentId: studentProfile.id,
            classId: validatedData.classId,
            academicYearId: validatedData.academicYearId,
            status: "ACTIVE",
          },
        });
      }

      return {
        ...studentProfile,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    });

    logger.info("Student created", { studentId: result.id, createdBy: session.user.id });
    return NextResponse.json(result, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE],
  }
);
