import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

export const dynamic = "force-dynamic";

const addMemberSchema = z.object({
  organizationId: z.string().cuid("ID organisation invalide"),
  userId: z.string().cuid("ID utilisateur invalide"),
  title: z.string().optional().nullable(),
  isOwner: z.boolean().optional().default(false),
  // Jamais implicite (S5) : un membre n'est gestionnaire que si on le demande
  canManageSites: z.boolean().optional().default(false),
});

/**
 * Rôles admissibles comme membres d'une organisation (S5) : une adhésion
 * ouvre l'accès aux écoles de l'organisation, elle est réservée à leurs
 * responsables (spécification NETWORK_ADMIN, 2026-07-02).
 */
const ELIGIBLE_ROLES = new Set(["NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]);

class MembershipRefused extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}
const refuse = (status: 400 | 403 | 404 | 409, message: string): never => {
  throw new MembershipRefused(status, message);
};

/**
 * POST /api/organizations/members — ajoute ou modifie un membre (S5).
 *
 * - Seul un propriétaire ou un gestionnaire (canManageSites) de
 *   l'organisation agit, relu en base sous verrou : un droit retiré entre-temps
 *   ne permet plus d'agir.
 * - Seul un propriétaire accorde ou retire la propriété ou la gestion, et
 *   modifie un propriétaire ou un gestionnaire : un gestionnaire n'ajoute ou
 *   ne modifie que des membres simples.
 * - Admissibles : comptes actifs d'un rôle de direction (NETWORK_ADMIN,
 *   SCHOOL_ADMIN, DIRECTOR) rattachés à une école de l'organisation ; un
 *   NETWORK_ADMIN sans école ne peut être ajouté que par SUPER_ADMIN.
 * - Le dernier propriétaire n'est jamais rétrogradé.
 * Verrou transactionnel par organisation : deux modifications simultanées
 * (par exemple deux propriétaires qui se rétrogradent) sont sérialisées.
 */
export const POST = createApiHandler(async (request, context) => {
  const session = context.session;
  try {
    const body = await request.json();
    const data = addMemberSchema.parse(body);
    const isRoot = session.user.role === "SUPER_ADMIN";

    const { membership, targetUser, organization } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`organization-membership:${data.organizationId}`}))::text`;

      const organization = await tx.organization.findUnique({
        where: { id: data.organizationId },
        select: { id: true, name: true, isActive: true, schools: { select: { id: true } } },
      });
      if (!organization || !organization.isActive) refuse(404, "Organisation introuvable ou inactive.");

      // Droits de l'auteur, relus sous verrou
      const caller = isRoot
        ? null
        : await tx.organizationMembership.findUnique({
            where: { organizationId_userId: { organizationId: data.organizationId, userId: session.user.id } },
            select: { isOwner: true, canManageSites: true },
          });
      if (!isRoot && (!caller || (!caller.isOwner && !caller.canManageSites))) {
        refuse(403, "Vous n'avez pas les droits de gestion sur cette organisation.");
      }
      const callerIsOwner = isRoot || caller!.isOwner;
      if ((data.isOwner || data.canManageSites) && !callerIsOwner) {
        refuse(403, "Seul un propriétaire peut accorder des droits de gestion ou de propriété.");
      }

      // Compte admissible : actif, rôle de direction, école de l'organisation
      const targetUser = await tx.user.findUnique({
        where: { id: data.userId },
        select: { id: true, firstName: true, lastName: true, email: true, isActive: true, role: true, schoolId: true },
      });
      const schoolIds = new Set(organization!.schools.map((school) => school.id));
      const inOrganization = targetUser?.schoolId ? schoolIds.has(targetUser.schoolId) : false;
      const rootAddingNetworkAdmin = isRoot && targetUser?.role === "NETWORK_ADMIN" && !targetUser.schoolId;
      // Hors de l'organisation : même réponse qu'un compte inexistant (pas de sondage des autres écoles)
      if (!targetUser || !targetUser.isActive || (!inOrganization && !rootAddingNetworkAdmin)) {
        refuse(404, "Utilisateur introuvable ou inactif.");
      }
      if (!ELIGIBLE_ROLES.has(targetUser!.role)) {
        refuse(400, "Seuls les responsables d'un établissement de l'organisation peuvent en être membres.");
      }

      const existing = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: data.organizationId, userId: data.userId } },
        select: { isOwner: true, canManageSites: true },
      });
      if (existing && (existing.isOwner || existing.canManageSites) && !callerIsOwner) {
        refuse(403, "Seul un propriétaire peut modifier un propriétaire ou un gestionnaire.");
      }
      if (existing?.isOwner && !data.isOwner) {
        const owners = await tx.organizationMembership.count({ where: { organizationId: data.organizationId, isOwner: true } });
        if (owners <= 1) refuse(409, "Impossible de retirer le dernier propriétaire de l'organisation.");
      }

      const membership = await tx.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: data.organizationId, userId: data.userId } },
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

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: existing ? "ORGANIZATION_MEMBER_UPDATED" : "ORGANIZATION_MEMBER_ADDED",
          entity: "organizationMembership",
          entityId: membership.id,
          oldValues: existing ? { isOwner: existing.isOwner, canManageSites: existing.canManageSites } : undefined,
          newValues: {
            organizationId: data.organizationId,
            targetUserId: data.userId,
            isOwner: data.isOwner,
            canManageSites: data.canManageSites,
          },
        },
      });

      return { membership, targetUser: targetUser!, organization: organization! };
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
    if (error instanceof MembershipRefused) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error("Error managing organization membership", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la gestion du membre d'organisation" },
      { status: 500 }
    );
  }
});
