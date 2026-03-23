import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
    const action = url.searchParams.get("action");
    const entity = url.searchParams.get("entity");
    const schoolId = url.searchParams.get("schoolId");

    const where: Prisma.AuditLogWhereInput = {};
    if (search) {
      where.OR = [
        { entityId: { contains: search, mode: "insensitive" } },
        { ipAddress: { contains: search, mode: "insensitive" } },
        { user: { firstName: { contains: search, mode: "insensitive" } } },
        { user: { lastName: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (schoolId) where.schoolId = schoolId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return createPaginatedResponse(logs, total, { page, limit, skip });
  } catch (error) {
    logger.error("Error fetching root logs", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des journaux d'audit" },
      { status: 500 }
    );
  }
}
