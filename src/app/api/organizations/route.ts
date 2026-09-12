import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { createApiHandler, createPaginatedResponse } from "@/lib/api/api-helpers";
import { getListWindow } from "@/lib/api/list-window";

export const dynamic = "force-dynamic";

export const GET = createApiHandler(async (request, context) => {
        const session = context.session;

  // Lot 3 : curseur sur le nom par défaut, ?page= toléré (ancien format).
  const list = getListWindow(request, { sortField: "name", direction: "asc", defaultLimit: 50, maxLimit: 200 });
  const search = new URL(request.url).searchParams.get("search") || "";

  let manageableMemberships: Array<{
    organizationId: string;
    isOwner: boolean;
    canManageSites: boolean;
  }> = [];

  if (session.user.role !== "SUPER_ADMIN") {
    const organizationAccess = await getOrganizationAccessForUser(session.user.id);
    manageableMemberships = organizationAccess.memberships
      .filter((membership) => membership.isOwner || membership.canManageSites)
      .map((membership) => ({
        organizationId: membership.organizationId,
        isOwner: membership.isOwner,
        canManageSites: membership.canManageSites,
      }));

    if (manageableMemberships.length === 0) {
      return NextResponse.json({ error: "Accès organisation refusé" }, { status: 403 });
    }
  }

  const manageableOrganizationIds = manageableMemberships.map((membership) => membership.organizationId);
  const where: Prisma.OrganizationWhereInput = {
    ...(session.user.role === "SUPER_ADMIN" ? {} : { id: { in: manageableOrganizationIds } }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { code: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

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
        description: true,
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

  const membershipByOrganizationId = new Map(
    manageableMemberships.map((membership) => [membership.organizationId, membership] as const)
  );

  const rows = organizations.map((organization) => ({
    ...organization,
    membership:
      session.user.role === "SUPER_ADMIN"
        ? null
        : membershipByOrganizationId.get(organization.id) || null,
  }));
  if (list.offset) return createPaginatedResponse(rows, total ?? 0, list.offset);
  return NextResponse.json(list.page(rows, (organization) => organization.name, total));

});
