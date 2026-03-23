import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Session } from "next-auth";
import { hash } from "bcryptjs";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import { getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { logger } from "@/lib/utils/logger";
import { SchoolType, SchoolLevel, UserRole } from "@prisma/client";

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
      ];
    }
    if (type) where.type = type as SchoolType;
    if (level) where.level = level as SchoolLevel;
    if (isActive !== null) where.isActive = isActive === "true";

    const [schools, total, studentCounts, teacherCounts, userCounts] = await Promise.all([
      prisma.school.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          level: true,
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
      prisma.teacherProfile.groupBy({
        by: ["schoolId"],
        _count: true,
      }),
      prisma.user.groupBy({
        by: ["schoolId"],
        _count: true,
      }),
    ]);

    const studentCountBySchool = new Map(studentCounts.map((s) => [s.schoolId, s._count]));
    const teacherCountBySchool = new Map(teacherCounts.map((t) => [t.schoolId, t._count]));
    const userCountBySchool = new Map(userCounts.filter(u => u.schoolId !== null).map((u) => [u.schoolId, u._count]));

    return createPaginatedResponse(
      schools.map((s) => {
        const totalUsers = Math.max(1, userCountBySchool.get(s.id) ?? 0);
        // Business Rule: A school should always have at least 1 user (the admin). 
        // If technical issues occurred during manual database edits, we enforce the rule.
        return {
          ...s,
          stats: {
            users: totalUsers,
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

import { schoolDeploymentSchema, schoolQuotaUpdateSchema } from "@/lib/validations/root";

export async function PATCH(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

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

  try {
    const body = await request.json();
    const validatedData = schoolDeploymentSchema.parse(body);
    
    const result = await prisma.$transaction(async (tx) => {
      const currentYear = new Date().getFullYear();
      const t1Start = new Date(currentYear, 8, 1);
      const t1End = new Date(currentYear, 11, 20);
      const t2Start = new Date(currentYear + 1, 0, 5);
      const t2End = new Date(currentYear + 1, 2, 30);
      const t3Start = new Date(currentYear + 1, 3, 10);
      const t3End = new Date(currentYear + 1, 5, 30);

      // 1. Create School (The Tenant Box)
      const school = await tx.school.create({
        data: {
          name: validatedData.name,
          code: validatedData.name.substring(0, 3).toUpperCase() + "-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
          email: validatedData.email || null,
          phone: validatedData.phone || null,
          city: validatedData.city || null,
          address: validatedData.address || null,
          type: validatedData.type,
          level: validatedData.level,
          isActive: true,
          academicConfig: {
            create: { 
              periodType: "TRIMESTER",
              periodsCount: 3,
              maxGrade: 20,
              passingGrade: 10
            }
          },
          academicYears: {
            create: {
              name: `${currentYear}-${currentYear + 1}`,
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
        }
      });

      // 2. Create the SCHOOL_ADMIN (The Tenant Owner)
      const hashedPassword = await hash(validatedData.adminPassword, 12);
      const adminUser = await tx.user.create({
        data: {
          email: validatedData.adminEmail,
          password: hashedPassword,
          firstName: validatedData.adminFirstName,
          lastName: validatedData.adminLastName,
          role: UserRole.SCHOOL_ADMIN,
          schoolId: school.id,
          isActive: true,
          mustChangePassword: true,
        }
      });

      return { school, adminUser };
    });

    await invalidateByPath(CACHE_PATHS.schools);

    return NextResponse.json({ 
      data: result.school,
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
