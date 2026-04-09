import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import { getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { logger } from "@/lib/utils/logger";
import { SchoolType, SchoolLevel } from "@prisma/client";
import { countTeachersForSchool } from "@/lib/teachers/school-assignments";
import { authLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getClientIdentifier } from "@/lib/api/middleware-rate-limit";
import {
  createOrganization,
  createOrganizationMembership,
  createSchoolAdminUser,
  createSchoolWithDefaults,
} from "@/lib/schools/provisioning";
import { schoolDeploymentSchema, schoolQuotaUpdateSchema } from "@/lib/validations/root";

function requireRoot(session: Session | null, userEmail?: string | null, userId?: string | null) {
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isRootUserEmail(userEmail) || !hasValidRootSession(session)) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const { page, limit, skip } = getPaginationParams(request);
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const type = url.searchParams.get("type");
    const level = url.searchParams.get("level");
    const isActive = url.searchParams.get("isActive");

    const where: Prisma.SchoolWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { organization: { is: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }
    if (type) where.type = type as SchoolType;
    if (level) where.level = level as SchoolLevel;
    if (isActive !== null) where.isActive = isActive === "true";

    const [schools, total, studentCounts, userCounts] = await Promise.all([
      prisma.school.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          code: true,
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          type: true,
          level: true,
          siteType: true,
          parentSchoolId: true,
          parentSchool: {
            select: {
              id: true,
              name: true,
            },
          },
          city: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              classes: true,
            },
          },
        },
      }),
      prisma.school.count({ where }),
      prisma.studentProfile.groupBy({
        by: ["schoolId"],
        _count: true,
      }),
      prisma.user.groupBy({
        by: ["schoolId"],
        _count: true,
      }),
    ]);

    const studentCountBySchool = new Map(studentCounts.map((s) => [s.schoolId, s._count]));
    const userCountBySchool = new Map(userCounts.filter(u => u.schoolId !== null).map((u) => [u.schoolId, u._count]));
    const teacherCountBySchool = new Map(
      await Promise.all(
        schools.map(async (school) => [school.id, await countTeachersForSchool(school.id)] as const)
      )
    );

    return createPaginatedResponse(
      schools.map((s) => {
        return {
          ...s,
          stats: {
            users: userCountBySchool.get(s.id) ?? 0,
            classes: s._count.classes,
            students: studentCountBySchool.get(s.id) ?? 0,
            teachers: teacherCountBySchool.get(s.id) ?? 0,
          },
          _count: undefined,
        };
      }),
      total,
      { page, limit, skip }
    );
  } catch (error) {
    logger.error("Error fetching root schools", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des écoles" },
      { status: 500 }
    );
  }
}
export async function PATCH(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  // P8: Rate-limit root write operations
  const identifier = getClientIdentifier(request);
  const rl = await checkRateLimit(authLimiter, identifier);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes. Réessayez plus tard." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const validatedData = schoolQuotaUpdateSchema.parse(body);
    const { id, ...data } = validatedData;

    const school = await prisma.school.update({
      where: { id },
      data: {
        isActive: data.isActive,
        planId: data.planId,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        level: true,
        isActive: true,
        planId: true,
      },
    });

    await invalidateByPath(CACHE_PATHS.schools);

    return NextResponse.json({ data: school });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error("Error updating school", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'école" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  // P8: Rate-limit root write operations
  const identifier = getClientIdentifier(request);
  const rl = await checkRateLimit(authLimiter, identifier);
  if (!rl.success) {
    return NextResponse.json({ error: "Trop de requêtes. Réessayez plus tard." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const validatedData = schoolDeploymentSchema.parse(body);
    
    const result = await prisma.$transaction(async (tx) => {
      let organization = null;

      if (validatedData.organizationMode === "CREATE") {
        organization = await createOrganization(tx, {
          name: validatedData.organizationName as string,
          description: validatedData.organizationDescription || null,
        });
      }

      const resolvedOrganizationId =
        validatedData.organizationMode === "CREATE"
          ? organization?.id || null
          : validatedData.organizationMode === "EXISTING"
            ? validatedData.organizationId || null
            : null;

      const school = await createSchoolWithDefaults(tx, {
        organizationId: resolvedOrganizationId,
        name: validatedData.name,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        city: validatedData.city || null,
        address: validatedData.address || null,
        logo: validatedData.logo || null,
        type: validatedData.type,
        level: validatedData.level,
        parentSchoolId: validatedData.parentSchoolId || null,
      });

      const adminUser = await createSchoolAdminUser(tx, school.id, {
        email: validatedData.adminEmail,
        password: validatedData.adminPassword,
        firstName: validatedData.adminFirstName,
        lastName: validatedData.adminLastName,
      });

      const membershipOrganizationId =
        resolvedOrganizationId ||
        school.organizationId ||
        school.organization?.id ||
        null;

      if (membershipOrganizationId && validatedData.assignAdminAsOrganizationManager) {
        await createOrganizationMembership(tx, {
          organizationId: membershipOrganizationId,
          userId: adminUser.id,
          title: "Chef d'organisation",
          isOwner: true,
          canManageSites: true,
        });
      }

      return { school, adminUser, organization };
    });

    await invalidateByPath(CACHE_PATHS.schools);

    return NextResponse.json({ 
      data: result.school,
      organization: result.organization || result.school.organization || null,
      admin: { 
        id: result.adminUser.id, 
        email: result.adminUser.email,
        firstName: result.adminUser.firstName,
        lastName: result.adminUser.lastName
      }
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message === "PARENT_SCHOOL_NOT_FOUND") {
      return NextResponse.json({ error: "Établissement parent introuvable" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "PARENT_SCHOOL_MUST_BE_MAIN") {
      return NextResponse.json({ error: "Une annexe doit être rattachée à un site principal." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ORGANIZATION_NOT_FOUND") {
      return NextResponse.json({ error: "Organisation introuvable." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ORGANIZATION_INACTIVE") {
      return NextResponse.json({ error: "Organisation inactive." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "PARENT_SCHOOL_ORGANIZATION_MISMATCH") {
      return NextResponse.json({ error: "Le site parent appartient à une autre organisation." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "PARENT_SCHOOL_REQUIRES_SHARED_ORGANIZATION") {
      return NextResponse.json({ error: "Une annexe doit partager la même organisation que son site parent." }, { status: 400 });
    }
    if ((error as any).code === 'P2002') {
      return NextResponse.json({ error: "Cet email administrateur est déjà utilisé" }, { status: 400 });
    }
    logger.error("Error creating school in root", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erreur lors de la création de l'établissement" },
      { status: 500 }
    );
  }
}
