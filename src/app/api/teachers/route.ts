import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import bcrypt from "bcryptjs";
import { teacherCreateSchema } from "@/lib/validations/user";
import { checkTeacherQuota } from "@/lib/saas/quotas";
import {
  CACHE_TTL_MEDIUM,
  generateCacheKey,
  invalidateByPath,
  CACHE_PATHS,
  withCache,
} from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * GET /api/teachers
 * Liste les enseignants de l'école de l'utilisateur connecté
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const searchParams = new URL(request.url).searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const skip = (page - 1) * limit;
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");

    const schoolId =
      session.user.role === "SUPER_ADMIN"
        ? (searchParams.get("schoolId") ?? undefined)
        : (session.user.schoolId ?? undefined);

    const where: Prisma.TeacherProfileWhereInput = {};
    if (schoolId) where.schoolId = schoolId;

    const userWhere: Prisma.UserWhereInput = {};

    if (search) {
      userWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status === "ACTIVE") userWhere.isActive = true;
    if (status === "INACTIVE") userWhere.isActive = false;

    if (Object.keys(userWhere).length > 0) {
      where.user = userWhere;
    }

    const cacheKey = generateCacheKey(request.nextUrl.pathname, request.nextUrl.searchParams, session.user.id);

    const handler = async () => {
      const [teachers, total] = await Promise.all([
        prisma.teacherProfile.findMany({
          where,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                isActive: true,
              },
            },
            classSubjects: {
              include: { subject: { select: { id: true, name: true } } },
            },
          },
          orderBy: { user: { lastName: "asc" } },
          skip,
          take: limit,
        }),
        prisma.teacherProfile.count({ where }),
      ]);

      // Deduplicate subjects per teacher
      const teachersWithUniqueSubjects = teachers.map((teacher) => {
        const seenSubjects = new Map<string, { id: string; name: string }>();
        teacher.classSubjects.forEach((cs) => {
          if (cs.subject && !seenSubjects.has(cs.subject.id)) {
            seenSubjects.set(cs.subject.id, cs.subject);
          }
        });
        return {
          ...teacher,
          subjects: Array.from(seenSubjects.values()),
        };
      });

      return NextResponse.json({
        teachers: teachersWithUniqueSubjects,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    };

    const response = await withCache(handler as any, { ttl: CACHE_TTL_MEDIUM, key: cacheKey });
    return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_MEDIUM, staleWhileRevalidate: 30 });
  } catch (error) {
    logger.error("Error fetching teachers", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des enseignants" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teachers
 * Créé un nouvel enseignant
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const schoolId = session.user.schoolId;
    if (!schoolId && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Aucun établissement associé" }, { status: 400 });
    }

    // Checking Quota
    if (schoolId) {
      const quota = await checkTeacherQuota(schoolId);
      if (!quota.allowed) {
        return NextResponse.json({ error: `Quota d'enseignants atteint (${quota.limit}). Veuillez passer à un plan supérieur.` }, { status: 403 });
      }
    }

    const body = await request.json();
    const validatedData = teacherCreateSchema.parse(body);

    const targetSchoolId = schoolId || body.schoolId; // if super_admin provides it

    if (!targetSchoolId) {
      return NextResponse.json({ error: "School ID is required" }, { status: 400 });
    }

    // Check if email is unique
    const existingEmail = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingEmail) {
      return NextResponse.json({ error: "Un utilisateur existe déjà avec cet email" }, { status: 400 });
    }

    const hashedPassword = validatedData.password ? await bcrypt.hash(validatedData.password, 10) : await bcrypt.hash(Math.random().toString(36), 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          password: hashedPassword,
          role: "TEACHER",
          schoolId: targetSchoolId,
          phone: validatedData.phone,
        }
      });

      const profile = await tx.teacherProfile.create({
        data: {
          userId: user.id,
          schoolId: targetSchoolId,
          matricule: validatedData.matricule || null,
          specialization: validatedData.specialization || null,
          hireDate: validatedData.hireDate ? new Date(validatedData.hireDate) : null,
        }
      });

      return {
        user,
        profile
      };
    });

    logger.info("Teacher created", { teacherId: result.profile.id, createdBy: session.user.id });

    await invalidateByPath(CACHE_PATHS.teachers).catch(() => {});
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    logger.error("Error creating teacher", error);

    // Zod Validation Error handling
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: (error as Error).message || "Erreur lors de la création de l'enseignant" },
      { status: 500 }
    );
  }
}
