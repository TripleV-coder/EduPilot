import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { SchoolLevel, SchoolType } from "@prisma/client";
import { createApiHandler, translateError, getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import crypto from "crypto";
import { Permission } from "@/lib/rbac/permissions";

// Schema validation for school creation
const schoolSchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional(),
  website: z.string().url("URL invalide").optional(),
  type: z.nativeEnum(SchoolType).optional(),
  level: z.nativeEnum(SchoolLevel).optional(),
  parentSchoolId: z.string().cuid().optional(),
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
      // Others see only their school
      if (!session.user.schoolId) {
        return NextResponse.json(translateError({ error: "Aucun établissement associé", key: "api.issues.no_school_associated" }, t), { status: 403 });
      }
      whereClause = { id: session.user.schoolId };
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          level: true,
          type: true,
          parentSchoolId: true,
          isActive: true,
          _count: {
            select: { users: true, classes: true },
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
 *               website:
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

    if (validatedData.parentSchoolId) {
      const parent = await prisma.school.findUnique({
        where: { id: validatedData.parentSchoolId },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          translateError({ error: "Établissement parent introuvable" }, t),
          { status: 400 }
        );
      }
    }

    const currentYear = new Date().getFullYear();
    const t1Start = new Date(currentYear, 8, 1);     // 1 Sep
    const t1End = new Date(currentYear, 11, 20);     // 20 Dec
    const t2Start = new Date(currentYear + 1, 0, 5); // 5 Jan
    const t2End = new Date(currentYear + 1, 2, 30);  // 30 Mar
    const t3Start = new Date(currentYear + 1, 3, 10);// 10 Apr
    const t3End = new Date(currentYear + 1, 5, 30);  // 30 Jun

    const school = await prisma.school.create({
      data: {
        name: validatedData.name,
        address: validatedData.address,
        city: validatedData.city,
        phone: validatedData.phone,
        email: validatedData.email,
        type: validatedData.type ?? "PRIVATE",
        level: validatedData.level ?? "PRIMARY",
        parentSchoolId: validatedData.parentSchoolId ?? null,
        code: validatedData.name.substring(0, 3).toUpperCase() + "-" + crypto.randomBytes(3).toString('hex').toUpperCase(),
        // Create default academic config
        academicConfig: {
          create: {
            periodType: "TRIMESTER",
          }
        },
        academicYears: {
          create: {
            name: currentYear.toString() + "-" + (currentYear + 1).toString(),
            startDate: t1Start,
            endDate: t3End,
            isCurrent: true,
            periods: {
              create: [
                { name: "Trimestre 1", type: "TRIMESTER", startDate: t1Start, endDate: t1End, sequence: 1 },
                { name: "Trimestre 2", type: "TRIMESTER", startDate: t2Start, endDate: t2End, sequence: 2 },
                { name: "Trimestre 3", type: "TRIMESTER", startDate: t3Start, endDate: t3End, sequence: 3 },
              ]
            }
          }
        }
      },
      include: {
        academicConfig: true,
      },
    });

    await invalidateByPath(CACHE_PATHS.schools);

    return NextResponse.json(school, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN"],
    requiredPermissions: [Permission.SCHOOL_CREATE],
  }
);
