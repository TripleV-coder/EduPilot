import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { createPaginatedResponse, getPaginationParams } from "@/lib/api/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 50, maxLimit: 200 });
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
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
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
    prisma.organization.count({ where }),
  ]);

  const membershipByOrganizationId = new Map(
    manageableMemberships.map((membership) => [membership.organizationId, membership] as const)
  );

  return createPaginatedResponse(
    organizations.map((organization) => ({
      ...organization,
      membership:
        session.user.role === "SUPER_ADMIN"
          ? null
          : membershipByOrganizationId.get(organization.id) || null,
    })),
    total,
    { page, limit, skip }
  );
}
