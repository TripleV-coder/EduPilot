import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const addMemberSchema = z.object({
  organizationId: z.string().cuid("ID organisation invalide"),
  userId: z.string().cuid("ID utilisateur invalide"),
  title: z.string().optional().nullable(),
  isOwner: z.boolean().optional().default(false),
  canManageSites: z.boolean().optional().default(true),
});

/**
 * P17: Organization membership management endpoint.
 * Allows organization owners/managers to invite co-managers to their organization.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = addMemberSchema.parse(body);

    // Verify the caller has management rights on this organization
    if (session.user.role !== "SUPER_ADMIN") {
      const access = await getOrganizationAccessForUser(session.user.id);
      const membership = access.memberships.find(
        (m) => m.organizationId === data.organizationId
      );

      if (!membership || (!membership.isOwner && !membership.canManageSites)) {
        return NextResponse.json(
          { error: "Vous n'avez pas les droits de gestion sur cette organisation." },
          { status: 403 }
        );
      }

      // Only owners can grant owner status
      if (data.isOwner && !membership.isOwner) {
        return NextResponse.json(
          { error: "Seul un propriétaire peut accorder le statut de propriétaire." },
          { status: 403 }
        );
      }
    }

    // Verify the target user exists and is active
    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json({ error: "Utilisateur introuvable ou inactif." }, { status: 404 });
    }

    // Verify the organization exists and is active
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
      select: { id: true, name: true, isActive: true },
    });

    if (!organization || !organization.isActive) {
      return NextResponse.json({ error: "Organisation introuvable ou inactive." }, { status: 404 });
    }

    // Upsert the membership
    const membership = await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: data.organizationId,
          userId: data.userId,
        },
      },
      create: {
        organizationId: data.organizationId,
        userId: data.userId,
        title: data.title ?? null,
        isOwner: data.isOwner,
        canManageSites: data.canManageSites,
      },
      update: {
        title: data.title ?? null,
        isOwner: data.isOwner,
        canManageSites: data.canManageSites,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ORGANIZATION_MEMBER_ADDED",
        entity: "organizationMembership",
        entityId: membership.id,
        newValues: {
          organizationId: data.organizationId,
          targetUserId: data.userId,
          isOwner: data.isOwner,
          canManageSites: data.canManageSites,
        },
      },
    });

    return NextResponse.json({
      data: {
        id: membership.id,
        organizationId: membership.organizationId,
        userId: membership.userId,
        isOwner: membership.isOwner,
        canManageSites: membership.canManageSites,
        user: {
          id: targetUser.id,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          email: targetUser.email,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error("Error managing organization membership", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la gestion du membre d'organisation" },
      { status: 500 }
    );
  }
}
