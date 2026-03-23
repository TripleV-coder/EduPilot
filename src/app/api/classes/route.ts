import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { classSchema } from "@/lib/validations/school";
import { createApiHandler, translateError, getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS, CACHE_TTL_MEDIUM, generateCacheKey, withCache } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import type { ClassWhereFilter } from "@/lib/types/api";
import { Permission } from "@/lib/rbac/permissions";
import { API_ERRORS } from "@/lib/constants/api-messages";

/**
 * GET /api/classes
 * @swagger
 * /api/classes:
 *   get:
 *     summary: Liste des classes
 *     description: Récupère la liste paginée des classes
 *     tags: [Classes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: schoolId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par établissement
 *       - name: classLevelId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par niveau
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Liste des classes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Class'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || session.user.schoolId;
    const classLevelId = searchParams.get("classLevelId");
    const search = searchParams.get("search");

    // Pagination
    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 50, maxLimit: 200 });

    // Security: Non-SUPER_ADMIN can only access their school
    if (session.user.role !== "SUPER_ADMIN" && schoolId !== session.user.schoolId) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    if (session.user.role !== "SUPER_ADMIN" && !schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const where: Prisma.ClassWhereInput = {};
    if (schoolId) where.schoolId = schoolId;
    if (classLevelId) where.classLevelId = classLevelId;
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const url = new URL(request.url);
    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);

    const handler = async () => {
      const [classes, total] = await Promise.all([
        prisma.class.findMany({
          where,
          select: {
            id: true,
            name: true,
            classLevel: {
              select: {
                id: true,
                name: true,
                level: true,
                sequence: true,
              },
            },
            mainTeacher: {
              select: {
                id: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            capacity: true,
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
          skip,
          take: limit,
        }),
        prisma.class.count({ where }),
      ]);

      return createPaginatedResponse(classes, total, { page, limit, skip });
    };

    const response = await withCache(handler as any, { ttl: CACHE_TTL_MEDIUM, key: cacheKey });
    return withHttpCache(response, request, {
      private: true,
      maxAge: CACHE_TTL_MEDIUM,
      staleWhileRevalidate: 30,
    });
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

    // Récupérer le classLevel une seule fois (évite la double requête)
    const classLevel = await prisma.classLevel.findUnique({
      where: { id: validatedData.classLevelId },
      select: { schoolId: true },
    });

    if (session.user.role === "SUPER_ADMIN" && !schoolId) {
      schoolId = classLevel?.schoolId || null;
    }

    if (!schoolId) {
      if (session.user.role === "SUPER_ADMIN") {
        return NextResponse.json([]);
      }
      return NextResponse.json(translateError(API_ERRORS.MISSING_PERMISSIONS, t), { status: 400 });
    }

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

    await invalidateByPath(CACHE_PATHS.classes);

    return NextResponse.json(newClass, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.CLASS_CREATE],
  }
);
