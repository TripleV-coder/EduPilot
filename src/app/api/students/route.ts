import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { studentCreateSchema } from "@/lib/validations/user";
import { issueProvisionalPassword } from "@/lib/auth/provisional-password";
import { isZodError } from "@/lib/is-zod-error";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { buildCursorPage, getCursorParams, keysetOrderBy, keysetWhere } from "@/lib/api/pagination";
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
/** Plafond de sécurité d'un effectif de classe (?classId=) : aucune classe réelle ne l'atteint. */
const CLASS_ROSTER_MAX = 1000;

export const GET = createApiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    let academicYearId = searchParams.get("academicYearId");
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    // N19 : l'effectif d'une classe est borné par nature et ne doit jamais être
    // tronqué (appel, saisie de notes, bulletins, promotion) : plafond de sécurité
    // CLASS_ROSTER_MAX avec ?classId=, 100 pour les listes de l'établissement.
    const listLimits = { defaultLimit: 20, maxLimit: classId ? CLASS_ROSTER_MAX : 100 };
    // Lot 3 : curseur (keyset), total sur la première page seulement.
    // L'ancien mode ?page= a été retiré au Lot 8.
    const cursorPage = getCursorParams(searchParams, listLimits);
    const emptyList = () =>
      NextResponse.json({
        data: [],
        pagination: { limit: cursorPage.limit, nextCursor: null, hasNextPage: false, ...(cursorPage.withTotal ? { total: 0 } : {}) },
      });

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
        return emptyList();
      }

      where.id = { in: childrenIds };
    } else if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      });
      
      if (!studentProfile) {
        return emptyList();
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
        where: cursorPage.cursor ? { AND: [where, keysetWhere("user.lastName", "asc", cursorPage.cursor)] } : where,
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
        orderBy: keysetOrderBy("user.lastName", "asc"),
        take: cursorPage.limit + 1,
      }),
      cursorPage.withTotal ? prisma.studentProfile.count({ where }) : Promise.resolve(undefined),
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
    const cursorResult = buildCursorPage(students, cursorPage.limit, (student) => student.user.lastName);
    const formattedStudents = cursorResult.data.map((student) => {
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

    return NextResponse.json({
      data: formattedStudents,
      pagination: { ...cursorResult.pagination, ...(total !== undefined ? { total } : {}) },
    });
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
    let validatedData: z.infer<typeof studentCreateSchema>;
    try {
      validatedData = studentCreateSchema.parse(body);
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json(
          { error: "Données invalides", details: error.issues },
          { status: 400 }
        );
      }
      throw error;
    }
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

    // N31 : jamais de mot de passe partagé. Sans mot de passe choisi par
    // l'auteur, un mot de passe provisoire unique est généré et renvoyé une fois.
    const provisional = validatedData.password ? null : await issueProvisionalPassword();
    const hashedPassword = provisional?.hash ?? (await bcrypt.hash(validatedData.password as string, 10));

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          password: hashedPassword,
          role: "STUDENT",
          schoolId: targetSchoolId,
          phone: validatedData.phone,
          // Mot de passe connu de l'auteur de la création : à changer (M1).
          mustChangePassword: true,
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
    return NextResponse.json(
      provisional ? { ...result, provisionalPassword: provisional.plain } : result,
      { status: 201 },
    );
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE],
  }
);
