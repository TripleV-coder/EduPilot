import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { userSchema } from "@/lib/validations/user";
import type { UserWhereFilter } from "@/lib/types/api";
import type { UserRole } from "@prisma/client";
import { SchoolLevel, SchoolType } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { sanitizeRequestBody, sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler, getPaginationParams, createPaginatedResponse, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { checkStudentQuota, checkTeacherQuota } from "@/lib/saas/quotas";
import { canCreateRole } from "@/lib/rbac/permissions";

export const GET = createApiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const schoolId = searchParams.get("schoolId");
    const search = searchParams.get("search");

    // Pagination parameters
    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

    // Build where clause based on user role with proper typing
    const where: UserWhereFilter = {};

    if (session.user.role === "SUPER_ADMIN") {
      if (schoolId) where.schoolId = schoolId;
      if (role) where.role = role as UserRole;
    } else {
      // Non-super admins can only see users from their school
      where.schoolId = session.user.schoolId;
      if (role) where.role = role as UserRole;
    }

    // Search filter
    if (search) {
      const sanitizedSearch = sanitizePlainText(search);
      where.OR = [
        { firstName: { contains: sanitizedSearch, mode: "insensitive" } },
        { lastName: { contains: sanitizedSearch, mode: "insensitive" } },
        { email: { contains: sanitizedSearch, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          roles: true,
          isActive: true,
          schoolId: true,
          createdAt: true,
          school: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          teacherProfile: {
            select: {
              id: true,
              matricule: true,
              specialization: true,
            },
          },
          studentProfile: {
            select: {
              id: true,
              matricule: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return createPaginatedResponse(users, total, { page, limit, skip });
  },
  {
    requireAuth: true,
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    // Parse and sanitize body
    const body = await request.json();
    const sanitizedBody = sanitizeRequestBody(body);
    const schoolCreateSchema = z.object({
      name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
      address: z.string().optional(),
      city: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email("Email invalide").optional(),
      type: z.nativeEnum(SchoolType).optional(),
      level: z.nativeEnum(SchoolLevel).optional(),
      parentSchoolId: z.string().cuid().optional(),
    });

    const createUserSchema = userSchema.extend({
      school: schoolCreateSchema.optional(),
    });

    const validatedData = createUserSchema.parse(sanitizedBody);

    if (validatedData.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "La création d'un Super Admin est réservée à la configuration initiale." },
        { status: 403 }
      );
    }

    if (!canCreateRole(session.user.role, validatedData.role)) {
      return NextResponse.json(
        { error: "Vous n'êtes pas autorisé à créer ce type de compte." },
        { status: 403 }
      );
    }

    // Cohérence métier: la création d'un élève doit passer par /api/students
    // afin de garantir le profil élève + inscription académique.
    if (validatedData.role === "STUDENT") {
      return NextResponse.json(
        {
          error: "Utilisez le module d'inscription élève (/api/students) pour créer un compte élève complet.",
          code: "USE_STUDENTS_ENDPOINT",
        },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        translateError(API_ERRORS.ALREADY_EXISTS("Un utilisateur avec cet email"), t),
        { status: 400 }
      );
    }

    // Non-super admins can only create users for their school
    const targetSchoolId =
      session.user.role === "SUPER_ADMIN" ? validatedData.schoolId : session.user.schoolId;

    if (session.user.role !== "SUPER_ADMIN" && !targetSchoolId) {
      return NextResponse.json(
        { error: "Aucun établissement associé à ce compte" },
        { status: 403 }
      );
    }

    if (!targetSchoolId && !validatedData.school) {
      return NextResponse.json(
        { error: "Un établissement est requis pour ce rôle." },
        { status: 400 }
      );
    }

    if (validatedData.school && validatedData.schoolId) {
      return NextResponse.json(
        { error: "Fournissez soit un établissement existant, soit les informations pour en créer un." },
        { status: 400 }
      );
    }

    if (validatedData.school && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Seul le Super Admin peut créer un établissement lors de la création d'un compte." },
        { status: 403 }
      );
    }

    if (validatedData.school && validatedData.role !== "SCHOOL_ADMIN") {
      return NextResponse.json(
        { error: "La création d'établissement est réservée aux comptes Admin. École." },
        { status: 400 }
      );
    }

    // Quota Enforcement
    if (targetSchoolId) {
      if (validatedData.role === "STUDENT") {
        const studentQuota = await checkStudentQuota(targetSchoolId);
        if (!studentQuota.allowed) {
          return NextResponse.json(
            translateError({
              error: `Quota d'élèves atteint (${studentQuota.limit}).`,
              key: "api.issues.quota_exceeded",
              params: { resource: "élèves", limit: studentQuota.limit }
            }, t),
            { status: 403 }
          );
        }
      } else if (validatedData.role === "TEACHER") {
        const teacherQuota = await checkTeacherQuota(targetSchoolId);
        if (!teacherQuota.allowed) {
          return NextResponse.json(
            translateError({
              error: `Quota d'enseignants atteint (${teacherQuota.limit}).`,
              key: "api.issues.quota_exceeded",
              params: { resource: "enseignants", limit: teacherQuota.limit }
            }, t),
            { status: 403 }
          );
        }
      }
    }

    // Password is required for new users
    if (!validatedData.password) {
      return NextResponse.json(
        { ...translateError(API_ERRORS.INVALID_DATA, t), error: t("api.issues.password_required") || "Le mot de passe est obligatoire" },
        // Ideally should have a key for password required in i18n
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    let result: { user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; role: UserRole; isActive: boolean; schoolId: string | null; createdAt: Date } };
    try {
      result = await prisma.$transaction(async (tx) => {
        let resolvedSchoolId = targetSchoolId ?? null;

        if (validatedData.school) {
          if (validatedData.school.parentSchoolId) {
            const parent = await tx.school.findUnique({
              where: { id: validatedData.school.parentSchoolId },
              select: { id: true },
            });
            if (!parent) {
              throw new Error("PARENT_SCHOOL_NOT_FOUND");
            }
          }

          const school = await tx.school.create({
            data: {
              name: validatedData.school.name,
              address: validatedData.school.address,
              city: validatedData.school.city,
              phone: validatedData.school.phone,
              email: validatedData.school.email,
              type: validatedData.school.type ?? "PRIVATE",
              level: validatedData.school.level ?? "PRIMARY",
              parentSchoolId: validatedData.school.parentSchoolId ?? null,
              code: validatedData.school.name.substring(0, 3).toUpperCase() + "-" + Math.floor(Math.random() * 1000),
              academicConfig: {
                create: {
                  periodType: "TRIMESTER",
                }
              },
              academicYears: {
                create: {
                  name: new Date().getFullYear().toString() + "-" + (new Date().getFullYear() + 1).toString(),
                  startDate: new Date(new Date().getFullYear(), 8, 1),
                  endDate: new Date(new Date().getFullYear() + 1, 5, 30),
                  isCurrent: true,
                  periods: {
                    create: [
                      {
                        name: "Trimestre 1",
                        type: "TRIMESTER",
                        startDate: new Date(new Date().getFullYear(), 8, 1),
                        endDate: new Date(new Date().getFullYear(), 11, 20),
                        sequence: 1
                      },
                      {
                        name: "Trimestre 2",
                        type: "TRIMESTER",
                        startDate: new Date(new Date().getFullYear() + 1, 0, 5),
                        endDate: new Date(new Date().getFullYear() + 1, 2, 30),
                        sequence: 2
                      },
                      {
                        name: "Trimestre 3",
                        type: "TRIMESTER",
                        startDate: new Date(new Date().getFullYear() + 1, 3, 10),
                        endDate: new Date(new Date().getFullYear() + 1, 5, 30),
                        sequence: 3
                      },
                    ]
                  }
                }
              }
            },
            select: { id: true },
          });
          resolvedSchoolId = school.id;
        }

        const user = await tx.user.create({
          data: {
            email: validatedData.email,
            firstName: validatedData.firstName,
            lastName: validatedData.lastName,
            phone: validatedData.phone,
            role: validatedData.role,
            roles: [validatedData.role], // Initialize array with primary role
            schoolId: resolvedSchoolId,
            password: hashedPassword,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            roles: true,
            isActive: true,
            schoolId: true,
            createdAt: true,
          },
        });

        return { user };
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PARENT_SCHOOL_NOT_FOUND") {
        return NextResponse.json(
          { error: "Établissement parent introuvable" },
          { status: 400 }
        );
      }
      throw error;
    }

    logger.info("User created", { userId: result.user.id, createdBy: session.user.id });
    return NextResponse.json(result.user, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
