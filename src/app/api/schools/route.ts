import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { SchoolLevel, SchoolType, SiteType } from "@prisma/client";
import { createApiHandler, translateError, getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";
import { createSchoolWithDefaults } from "@/lib/schools/provisioning";

// Schema validation for school creation
const schoolSchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  organizationId: z.string().cuid().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable().or(z.literal("")),
  logo: z.string().url("URL du logo invalide").optional().nullable().or(z.literal("")),
  type: z.nativeEnum(SchoolType).optional(),
  level: z.nativeEnum(SchoolLevel).optional(),
  siteType: z.nativeEnum(SiteType).optional(),
  parentSchoolId: z.string().cuid().optional().nullable(),
});

export const GET = createApiHandler(
  async (request, { session }, t) => {
    // Pagination
    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

    // Role-based filtering
    let whereClause = {};
    if (session.user.role === "SUPER_ADMIN") {
      // Super admin sees all schools
      whereClause = {};
    } else {
      const declaredSchoolIds = Array.isArray(session.user.accessibleSchoolIds)
        ? session.user.accessibleSchoolIds.filter((schoolId: unknown): schoolId is string => typeof schoolId === "string" && schoolId.length > 0)
        : [];
      const accessibleSchoolIds = declaredSchoolIds.length > 0
        ? declaredSchoolIds
        : await getAccessibleSchoolIdsForUser({
            userId: session.user.id,
            role: session.user.role,
            primarySchoolId: session.user.primarySchoolId ?? getActiveSchoolId(session) ?? null,
          });

      if (accessibleSchoolIds.length === 0) {
        return NextResponse.json(translateError({ error: "Aucun établissement associé", key: "api.issues.no_school_associated" }, t), { status: 403 });
      }

      whereClause = { id: { in: accessibleSchoolIds } };
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          city: true,
          level: true,
          type: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          siteType: true,
          parentSchoolId: true,
          parentSchool: { select: { name: true } },
          isActive: true,
          _count: {
            select: { users: true, classes: true, childSchools: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.school.count({ where: whereClause }),
    ]);

    return createPaginatedResponse(schools, total, { page, limit, skip });
  },
  {
    requireAuth: true,
  }
);

/**
 * POST /api/schools
 * @swagger
 * /api/schools:
 *   post:
 *     summary: Créer un établissement
 *     description: Crée un nouvel établissement scolaire (SUPER_ADMIN uniquement)
 *     tags: [Schools]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
   *               logo:
   *                 type: string
   *                 format: uri
 *     responses:
 *       201:
 *         description: Établissement créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/School'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const POST = createApiHandler(
  async (request, _context, t) => {
    const body = await request.json();
    const validatedData = schoolSchema.parse(body);

    let school;
    try {
      school = await prisma.$transaction((tx) =>
        createSchoolWithDefaults(tx, {
          name: validatedData.name,
          organizationId: validatedData.organizationId,
          address: validatedData.address,
          city: validatedData.city,
          phone: validatedData.phone,
          email: validatedData.email,
          logo: validatedData.logo,
          type: validatedData.type,
          level: validatedData.level,
          siteType: validatedData.siteType,
          parentSchoolId: validatedData.parentSchoolId,
        })
      );
    } catch (error) {
      if (error instanceof Error && error.message === "PARENT_SCHOOL_NOT_FOUND") {
        return NextResponse.json(
          translateError({ error: "Établissement parent introuvable" }, t),
          { status: 400 }
        );
      }

      if (error instanceof Error && error.message === "PARENT_SCHOOL_MUST_BE_MAIN") {
        return NextResponse.json(
          translateError({ error: "Une annexe doit être rattachée à un site principal." }, t),
          { status: 400 }
        );
      }

      if (error instanceof Error && error.message === "ORGANIZATION_NOT_FOUND") {
        return NextResponse.json(
          translateError({ error: "Organisation introuvable." }, t),
          { status: 400 }
        );
      }

      if (error instanceof Error && error.message === "ORGANIZATION_INACTIVE") {
        return NextResponse.json(
          translateError({ error: "Organisation inactive." }, t),
          { status: 400 }
        );
      }

      if (error instanceof Error && error.message === "PARENT_SCHOOL_ORGANIZATION_MISMATCH") {
        return NextResponse.json(
          translateError({ error: "Le site parent appartient à une autre organisation." }, t),
          { status: 400 }
        );
      }

      if (error instanceof Error && error.message === "PARENT_SCHOOL_REQUIRES_SHARED_ORGANIZATION") {
        return NextResponse.json(
          translateError({ error: "Une annexe doit partager la même organisation que son site parent." }, t),
          { status: 400 }
        );
      }

      throw error;
    }

    await invalidateByPath(CACHE_PATHS.schools);

    return NextResponse.json(school, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN"],
    requiredPermissions: [Permission.SCHOOL_CREATE],
  }
);
