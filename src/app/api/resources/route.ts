import { NextResponse } from "next/server";
import { createApiHandler, getPaginationParams } from "@/lib/api/api-helpers";
import { Prisma, ResourceType } from "@prisma/client";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { z } from "zod";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { buildCursorPage, getCursorParams, InvalidCursorError, keysetOrderBy, keysetWhere } from "@/lib/api/pagination";

const createResourceSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  type: z.enum(["LESSON", "EXERCISE", "EXAM", "CORRECTION", "DOCUMENT", "VIDEO", "AUDIO", "OTHER"]),
  category: z.string().optional(),
  subjectId: z.string().cuid().optional(),
  classLevelId: z.string().cuid().optional(),
  fileUrl: z.string().url(),
  fileType: z.string(),
  fileSize: z.number().optional(),
  thumbnailUrl: z.string().url().optional(),
  isPublic: z.boolean().default(false),
});

/**
 * GET /api/resources
 * List educational resources
 */
export const GET = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const subjectId = searchParams.get("subjectId");
    const classLevelId = searchParams.get("classLevelId");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    // N16 : taille plafonnée à 100, saisie non numérique → valeurs par défaut.
    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });
    // Lot 3 : curseur (keyset) par défaut, total sur la première page seulement ;
    // ?page= reste accepté avec l'ancien format jusqu'au Lot 8 (consommateurs non migrés).
    const cursorPage = searchParams.has("page") ? null : getCursorParams(searchParams, { defaultLimit: 20, maxLimit: 100 });
    const activeSchoolId = getActiveSchoolId(session);

    const where: Prisma.ResourceWhereInput = {
    };

    // Filter by type
    if (type) {
      where.type = type as ResourceType;
    }

    // Filter by subject
    if (subjectId) {
      where.subjectId = subjectId;
    }

    // Filter by class level
    if (classLevelId) {
      where.classLevelId = classLevelId;
    }

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Search in title and description
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Role-based filtering
    const userRole = session.user.role;
    if (userRole !== "SUPER_ADMIN") {
      if (!activeSchoolId) {
        return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
      }
      where.schoolId = activeSchoolId;
    }

    if (userRole === "STUDENT" || userRole === "PARENT") {
      // Students and parents only see public resources
      where.isPublic = true;
    }

    const [resources, total] = await Promise.all([
      prisma.resource.findMany({
        where: cursorPage?.cursor ? { AND: [where, keysetWhere("createdAt", "desc", cursorPage.cursor)] } : where,
        include: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          classLevel: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: cursorPage ? keysetOrderBy("createdAt", "desc") : { createdAt: "desc" },
        skip: cursorPage ? undefined : skip,
        take: cursorPage ? cursorPage.limit + 1 : limit,
      }),
      !cursorPage || cursorPage.withTotal ? prisma.resource.count({ where }) : Promise.resolve(undefined),
    ]);

    if (cursorPage) {
      const { data, pagination } = buildCursorPage(resources, cursorPage.limit, (resource) => resource.createdAt);
      return NextResponse.json({ data, pagination: { ...pagination, ...(total !== undefined ? { total } : {}) } });
    }

    return NextResponse.json({
      resources,
      pagination: {
        page,
        limit,
        total: total ?? 0,
        totalPages: Math.ceil((total ?? 0) / limit),
      },
    });
  } catch (error) {
    if (error instanceof InvalidCursorError) throw error; // 400 INVALID_CURSOR (createApiHandler)
    logger.error(" fetching resources:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des ressources" },
      { status: 500 }
    );
  }

  }
);

/**
 * POST /api/resources
 * Create educational resource (Teachers and Admins)
 */
export const POST = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;


    const activeSchoolId = getActiveSchoolId(session);
    if (!activeSchoolId) {
      return NextResponse.json(
        { error: "Utilisateur non associé à un établissement" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createResourceSchema.parse(body);

    const resource = await prisma.resource.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        type: validatedData.type,
        category: validatedData.category,
        subjectId: validatedData.subjectId,
        classLevelId: validatedData.classLevelId,
        fileUrl: validatedData.fileUrl,
        fileType: validatedData.fileType,
        fileSize: validatedData.fileSize,
        thumbnailUrl: validatedData.thumbnailUrl,
        isPublic: validatedData.isPublic,
        schoolId: activeSchoolId,
        uploadedById: session.user.id,
      },
      include: {
        subject: {
          select: {
            name: true,
          },
        },
        classLevel: {
          select: {
            name: true,
          },
        },
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_RESOURCE",
        entity: "Resource",
        entityId: resource.id,
        newValues: {
          title: resource.title,
          type: resource.type,
        },
      },
    });

    await invalidateByPath(CACHE_PATHS.resources);

    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { status: 400 }
      );
    }

    logger.error(" creating resource:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la ressource" },
      { status: 500 }
    );
  }

  },
  { allowedRoles: [ "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", ] }
);
