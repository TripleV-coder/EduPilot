import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { studentCreateSchema } from "@/lib/validations/user";
import { logger } from "@/lib/utils/logger";
import { sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler, getPaginationParams, createPaginatedResponse, translateError } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { checkStudentQuota } from "@/lib/saas/quotas";

import { API_ERRORS } from "@/lib/constants/api-messages";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/students
 * @swagger
 * /api/students:
 *   get:
 *     summary: Liste des élèves
 *     description: Récupère la liste paginée des élèves avec filtres optionnels
 *     tags: [Students]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: classId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par classe
 *       - name: academicYearId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par année académique
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Recherche par nom, prénom ou matricule
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Liste des élèves
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Student'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const GET = createApiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    let academicYearId = searchParams.get("academicYearId");
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

    if (!academicYearId && session.user.role !== "SUPER_ADMIN" && getActiveSchoolId(session)) {
      const currentYear = await prisma.academicYear.findFirst({
        where: { schoolId: getActiveSchoolId(session), isCurrent: true },
        select: { id: true }
      });
      if (currentYear) {
        academicYearId = currentYear.id;
      }
    }

    const where: Prisma.StudentProfileWhereInput = {};
    const userFilter: Prisma.UserWhereInput = {};

    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          parentStudents: {
            select: { studentId: true },
          },
        },
      });

      const childrenIds = parentProfile?.parentStudents.map((child) => child.studentId) ?? [];
      if (childrenIds.length === 0) {
        return createPaginatedResponse([], 0, { page, limit, skip });
      }

      where.id = { in: childrenIds };
    } else if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      });
      
      if (!studentProfile) {
        return createPaginatedResponse([], 0, { page, limit, skip });
      }
      
      where.id = studentProfile.id;
    }

    if (session.user.role !== "SUPER_ADMIN") {
      userFilter.schoolId = getActiveSchoolId(session);
    }

    if (status) {
      userFilter.isActive = status === "ACTIVE";
    }

    if (Object.keys(userFilter).length > 0) {
      where.user = userFilter;
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
        select: {
          id: true,
          matricule: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
              schoolId: true,
            },
          },
          enrollments: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              class: {
                select: {
                  id: true,
                  name: true,
                  classLevel: {
                    select: {
                      id: true,
                      name: true,
                      level: true,
                    }
                  }
                },
              },
              academicYear: {
                select: {
                  id: true,
                  name: true,
                  isCurrent: true,
                }
              }
            },
            take: 1, // Only need first active enrollment
          }
        },
        skip,
        take: limit,
        orderBy: { user: { lastName: "asc" } }
      }),
      prisma.studentProfile.count({ where })
    ]);

    interface StudentRowWithUser {
      id: string;
      matricule: string;
      user: { id: string; email: string; firstName: string; lastName: string; isActive: boolean; schoolId: string | null };
      enrollments: Array<{
        id: string;
        class: {
          id: string;
          name: string;
          classLevel: { id: string; name: string; level: string; }
        };
        academicYear: { id: string; name: string; isCurrent: boolean; }
      }>;
    }
    const formattedStudents = students.map((student) => {
      const row = student as unknown as StudentRowWithUser;
      return {
        ...row,
        user: {
          id: row.user.id,
          email: row.user.email,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          isActive: row.user.isActive,
          schoolId: row.user.schoolId,
        },
      };
    });

    return createPaginatedResponse(formattedStudents, total, { page, limit, skip });
  },
  {
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT"],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    if (session.user.role !== "SUPER_ADMIN" && !getActiveSchoolId(session)) {
      return NextResponse.json(translateError({ error: "Aucun établissement associé", key: "api.issues.no_school_associated" }, t), { status: 403 });
    }

    const activeSchoolId = getActiveSchoolId(session);

    const body = await request.json();
    const validatedData = studentCreateSchema.parse(body);
    let targetSchoolId = activeSchoolId;

    // Validate Class ID if provided
    if (validatedData.classId) {
      const classExists = await prisma.class.findUnique({
        where: { id: validatedData.classId },
      });

      if (!classExists) {
        return NextResponse.json(translateError(API_ERRORS.NOT_FOUND("Classe"), t), { status: 404 });
      }

      if (!canAccessSchool(session, classExists.schoolId)) {
        return NextResponse.json({
          ...translateError(API_ERRORS.INVALID_DATA, t),
          error: t("api.issues.invalid_class_ownership")
        }, { status: 400 });
      }

      targetSchoolId = classExists.schoolId;
    }

    if (targetSchoolId) {
      const quota = await checkStudentQuota(targetSchoolId);
      if (!quota.allowed) {
        return NextResponse.json(translateError({
          error: `Quota d'élèves atteint (${quota.limit}). Veuillez passer à un plan supérieur.`,
          code: "QUOTA_EXCEEDED"
        }, t), { status: 403 });
      }
    }

    if (!targetSchoolId) {
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
          schoolId: targetSchoolId,
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
          schoolId: targetSchoolId,
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
