import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";

export const GET = createApiHandler(
  async (_request, { params, session }) => {
    const { id } = params;

    // Security: Non-super-admins can only view their own school
    if (session?.user?.role !== "SUPER_ADMIN" && id !== session?.user?.schoolId) {
      return NextResponse.json({ error: "Accès refusé à cet établissement" }, { status: 403 });
    }

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        academicConfig: true,
        _count: {
          select: {
            users: true,
            classes: true,
            studentProfiles: true,
            teacherProfiles: true,
          }
        }
      }
    });

    if (!school) {
      return NextResponse.json({ error: "Établissement non trouvé" }, { status: 404 });
    }

    return NextResponse.json(school);
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);

export const PATCH = createApiHandler(
  async (request, { params }, t) => {
    const { id } = params;
    const body = await request.json();

    const school = await prisma.school.update({
      where: { id },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    });

    await invalidateByPath(CACHE_PATHS.schools);

    return NextResponse.json(school);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SCHOOL_UPDATE],
  }
);

export const DELETE = createApiHandler(
  async (_request, { params }) => {
    const { id } = params;

    await prisma.school.delete({
      where: { id },
    });

    await invalidateByPath(CACHE_PATHS.schools);

    return new NextResponse(null, { status: 204 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN"],
    requiredPermissions: [Permission.SCHOOL_DELETE],
  }
);
