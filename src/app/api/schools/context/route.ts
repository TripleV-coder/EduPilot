import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAccessibleSchoolIdsForUser, resolveActiveSchoolId } from "@/lib/auth/school-access";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

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
  });
}
