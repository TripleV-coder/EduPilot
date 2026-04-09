import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import { getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";

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

  const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 50, maxLimit: 200 });
  const search = new URL(request.url).searchParams.get("search") || "";

  const where: Prisma.OrganizationWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        _count: {
          select: {
            schools: true,
            memberships: true,
          },
        },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return createPaginatedResponse(organizations, total, { page, limit, skip });
}
