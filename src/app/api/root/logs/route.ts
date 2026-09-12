import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import { createPaginatedResponse } from "@/lib/api/api-helpers";
import { getListWindow } from "@/lib/api/list-window";
import { logger } from "@/lib/utils/logger";

import { createApiHandler } from "@/lib/api/api-helpers";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
    async (request, context) => {

  const session = context.session;
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    // Lot 3 : curseur sur la date par défaut, ?page= toléré (ancien format).
    const list = getListWindow(request, { sortField: "createdAt", direction: "desc" });
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
        where: list.where(where),
        skip: list.skip,
        take: list.take,
        orderBy: list.orderBy,
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
      list.needsTotal ? prisma.auditLog.count({ where }) : Promise.resolve(undefined),
    ]);

    if (list.offset) return createPaginatedResponse(logs, total ?? 0, list.offset);
    return NextResponse.json(list.page(logs, (log) => log.createdAt, total));
  } catch (error) {
    logger.error("Error fetching root logs", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des journaux d'audit" },
      { status: 500 }
    );
  }
    },
    {},
);

