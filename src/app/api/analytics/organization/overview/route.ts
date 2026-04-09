import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { getOrganizationDashboardData } from "@/lib/services/organization-dashboard";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedOrganizationId = searchParams.get("organizationId");
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const periodId = searchParams.get("periodId") || undefined;

    let organizationId = requestedOrganizationId || session.user.primaryOrganizationId || null;

    if (session.user.role !== "SUPER_ADMIN") {
      const organizationAccess = await getOrganizationAccessForUser(session.user.id);
      const manageableOrganizationIds = organizationAccess.memberships
        .filter((membership) => membership.isOwner || membership.canManageSites)
        .map((membership) => membership.organizationId);

      if (manageableOrganizationIds.length === 0) {
        return NextResponse.json({ error: "Accès organisation refusé" }, { status: 403 });
      }

      organizationId = organizationId || manageableOrganizationIds[0] || null;

      if (!organizationId || !manageableOrganizationIds.includes(organizationId)) {
        return NextResponse.json({ error: "Organisation hors périmètre autorisé" }, { status: 403 });
      }
    } else if (!organizationId) {
      const firstOrganization = await prisma.organization.findFirst({
        orderBy: { name: "asc" },
        select: { id: true },
      });

      if (!firstOrganization) {
        return NextResponse.json({ error: "Aucune organisation disponible" }, { status: 404 });
      }

      organizationId = firstOrganization.id;
    }

    if (!organizationId) {
      return NextResponse.json({ error: "Organisation requise" }, { status: 400 });
    }

    const data = await getOrganizationDashboardData({
      organizationId,
      preferredSchoolId: getActiveSchoolId(session),
      academicYearId,
      periodId,
    });

    return NextResponse.json(data);
  } catch (error) {
    logger.error("fetching organization dashboard:", error as Error);
    return NextResponse.json(
      { error: (error as Error).message || "Erreur lors du chargement du cockpit organisation" },
      { status: 500 }
    );
  }
}
