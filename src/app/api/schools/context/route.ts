import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAccessibleSchoolIdsForUser, resolveActiveSchoolId } from "@/lib/auth/school-access";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { ALL_MODULE_IDS, normalizeEnabledModules } from "@/lib/modules/catalog";

/**
 * Modules actifs et cycles offerts de l'école active (Lot 6). Cette route est
 * la seule que TOUS les rôles appellent : c'est donc ici que la navigation lit
 * ce qu'elle doit masquer. Sans école active (super-admin en vue réseau), tout
 * le catalogue est renvoyé : on ne masque jamais hâtivement.
 */
async function activeSchoolSettings(schoolId: string | null) {
  if (!schoolId) return { enabledModules: [...ALL_MODULE_IDS], offeredLevels: [] as string[] };
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { enabledModules: true, offeredLevels: true },
  });
  if (!school) return { enabledModules: [...ALL_MODULE_IDS], offeredLevels: [] as string[] };
  return {
    enabledModules: normalizeEnabledModules(school.enabledModules),
    offeredLevels: school.offeredLevels as string[],
  };
}

export const GET = createApiHandler(async (_request, context) => {
        const session = context.session;

  const role = session.user.role;
  const primarySchoolId = session.user.primarySchoolId ?? null;
  const currentSchoolId = getActiveSchoolId(session) ?? null;

  if (role === "SUPER_ADMIN") {
    const schools = await prisma.school.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      activeSchoolId: currentSchoolId,
      primarySchoolId,
      primaryOrganizationId: session.user.primaryOrganizationId ?? null,
      organizationIds: session.user.organizationIds || [],
      isOrganizationManager: session.user.isOrganizationManager || false,
      schools,
      accessibleSchoolIds: schools.map((school) => school.id),
      ...(await activeSchoolSettings(currentSchoolId)),
    });
  }

  let accessibleSchoolIds = session.user.accessibleSchoolIds || [];

  if (accessibleSchoolIds.length === 0) {
    accessibleSchoolIds = await getAccessibleSchoolIdsForUser({
      userId: session.user.id,
      role,
      primarySchoolId,
    });
  }

  const schools = accessibleSchoolIds.length > 0
    ? await prisma.school.findMany({
        where: { id: { in: accessibleSchoolIds } },
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          isActive: true,
        },
        orderBy: { name: "asc" },
      })
    : [];

  const activeSchoolId = resolveActiveSchoolId({
    primarySchoolId,
    accessibleSchoolIds,
    requestedSchoolId: currentSchoolId,
  });

  return NextResponse.json({
    activeSchoolId,
    primarySchoolId,
    primaryOrganizationId: session.user.primaryOrganizationId ?? null,
    organizationIds: session.user.organizationIds || [],
    isOrganizationManager: session.user.isOrganizationManager || false,
    schools,
    accessibleSchoolIds,
    ...(await activeSchoolSettings(activeSchoolId)),
  });

});
