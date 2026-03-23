import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import { getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";
import { logger } from "@/lib/utils/logger";

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
    const role = url.searchParams.get("role");
    const isActive = url.searchParams.get("isActive");
    const schoolId = url.searchParams.get("schoolId");

    // Restrict Super Admin to only see other Super Admins and School Admins (GDPR Compliance)
    const allowedRoles: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN"];
    
    const where: Prisma.UserWhereInput = {
      role: { in: allowedRoles }
    };
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (role) {
      if (allowedRoles.includes(role as UserRole)) {
        where.role = role as UserRole;
      }
    }
    
    if (isActive !== null) where.isActive = isActive === "true";
    if (schoolId) where.schoolId = schoolId;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          roles: true,
          isActive: true,
          schoolId: true,
          createdAt: true,
          updatedAt: true,
          school: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              sessions: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return createPaginatedResponse(
      users.map((u) => ({
        ...u,
        sessionCount: u._count.sessions,
        _count: undefined,
      })),
      total,
      { page, limit, skip }
    );
  } catch (error) {
    logger.error("Error fetching root users", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des utilisateurs" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Ne pas permettre la modification de l'email root
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (existingUser && isRootUserEmail(existingUser.email)) {
      return NextResponse.json(
        { error: "Modification de l'utilisateur root non autorisée" },
        { status: 403 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    logger.error("Error updating user", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'utilisateur" },
      { status: 500 }
    );
  }
}
