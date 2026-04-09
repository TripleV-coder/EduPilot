import { NextRequest, NextResponse } from "next/server";
import { Prisma, ResourceType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { z } from "zod";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

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
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const subjectId = searchParams.get("subjectId");
    const classLevelId = searchParams.get("classLevelId");
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
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
        where,
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.resource.count({ where }),
    ]);

    return NextResponse.json({
      resources,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(" fetching resources:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des ressources" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/resources
 * Create educational resource (Teachers and Admins)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const allowedRoles = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "DIRECTOR",
      "TEACHER",
    ];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

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
}
