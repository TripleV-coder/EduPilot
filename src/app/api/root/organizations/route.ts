import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireRoot } from "@/lib/security/require-root";
import { getListWindow } from "@/lib/api/list-window";

import { createApiHandler } from "@/lib/api/api-helpers";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
    async (request, context) => {

  const session = context.session;
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  // Lot 3 : curseur sur le nom par défaut, ?page= toléré (ancien format).
  const list = getListWindow(request, { sortField: "name", direction: "asc", defaultLimit: 50, maxLimit: 200 });
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
      where: list.where(where),
      skip: list.skip,
      take: list.take,
      orderBy: list.orderBy,
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
    list.needsTotal ? prisma.organization.count({ where }) : Promise.resolve(undefined),
  ]);

  return NextResponse.json(list.page(organizations, (organization) => organization.name, total));
    },
    {},
);

