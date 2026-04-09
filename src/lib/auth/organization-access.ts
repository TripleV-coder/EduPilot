import prisma from "@/lib/prisma";

export type OrganizationMembershipContext = {
  organizationId: string;
  organizationName: string;
  isOwner: boolean;
  canManageSites: boolean;
  schoolIds: string[];
};

export async function getOrganizationMembershipContextForUser(userId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId,
      // P9: Only include memberships for active organizations
      organization: { isActive: true },
    },
    select: {
      organizationId: true,
      isOwner: true,
      canManageSites: true,
      organization: {
        select: {
          id: true,
          name: true,
          schools: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((membership) => ({
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    isOwner: membership.isOwner,
    canManageSites: membership.canManageSites,
    schoolIds: membership.organization.schools.map((school) => school.id),
  })) satisfies OrganizationMembershipContext[];
}

export async function getOrganizationAccessForUser(userId: string) {
  const memberships = await getOrganizationMembershipContextForUser(userId);
  const organizationIds = memberships.map((membership) => membership.organizationId);
  const accessibleSchoolIds = Array.from(
    new Set(memberships.flatMap((membership) => membership.schoolIds))
  );
  const manageableMemberships = memberships.filter(
    (membership) => membership.isOwner || membership.canManageSites
  );

  return {
    memberships,
    organizationIds,
    primaryOrganizationId: organizationIds[0] ?? null,
    accessibleSchoolIds,
    isOrganizationManager: manageableMemberships.length > 0,
  };
}
