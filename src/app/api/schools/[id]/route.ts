import { NextResponse } from "next/server";
import { SchoolLevel, SchoolType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";

const updateSchoolSchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères").optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("Email invalide").nullable().optional(),
  logo: z.string().url("URL du logo invalide").nullable().optional(),
  type: z.nativeEnum(SchoolType).optional(),
  level: z.nativeEnum(SchoolLevel).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const GET = createApiHandler(
  async (_request, { params, session }) => {
    const { id } = await params;

    if (!canAccessSchool(session, id)) {
      return NextResponse.json({ error: "Accès refusé à cet établissement" }, { status: 403 });
    }

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        academicConfig: true,
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parentSchool: {
          select: {
            id: true,
            name: true,
          },
        },
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
  async (request, { params, session }) => {
    const { id } = await params;
    if (!canAccessSchool(session, id)) {
      return NextResponse.json({ error: "Accès refusé à cet établissement" }, { status: 403 });
    }

    const existingSchool = await prisma.school.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingSchool) {
      return NextResponse.json({ error: "Établissement non trouvé" }, { status: 404 });
    }

    const parsedBody = updateSchoolSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Données invalides", details: parsedBody.error.issues }, { status: 400 });
    }

    const school = await prisma.school.update({
      where: { id },
      data: {
        ...parsedBody.data,
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
    const { id } = await params;

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
