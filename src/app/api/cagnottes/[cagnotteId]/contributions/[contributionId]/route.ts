import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { sanitizePlainText } from "@/lib/sanitize";
import { createAuditLog } from "@/lib/security/audit-log";
import { CAGNOTTE_REVIEWER_ROLES } from "@/lib/cagnotte/contributions";
import { formatCurrency } from "@/lib/types/finance";

const reviewSchema = z.object({
  decision: z.enum(["CONFIRM", "REJECT"]),
  note: z.string().max(300).optional(),
});

/**
 * PATCH /api/cagnottes/[cagnotteId]/contributions/[contributionId]
 *
 * Le comptable ou la direction confirme une contribution déclarée (espèces
 * reçues, relevé Mobile Money vérifié) ou la rejette, motif obligatoire
 * (TD-019). Décision unique : la mise à jour est conditionnée au statut
 * « en attente », deux validations simultanées ne s'appliquent qu'une fois.
 * Journal public, journal d'audit et notification à la famille.
 */
export const PATCH = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const { cagnotteId, contributionId } = await context.params;

    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 });
    }

    const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Décision invalide (CONFIRM ou REJECT)." }, { status: 400 });
    }
    const { decision } = parsed.data;
    const note = parsed.data.note ? sanitizePlainText(parsed.data.note).trim().slice(0, 300) : "";
    if (decision === "REJECT" && note.length < 3) {
      return NextResponse.json(
        { error: "Indiquez le motif du rejet : la famille le verra." },
        { status: 400 },
      );
    }

    // Cloisonnement : la contribution doit appartenir à une cagnotte de l'école active.
    const contribution = await prisma.cagnotteContribution.findFirst({
      where: { id: contributionId, cagnotteId, cagnotte: { schoolId } },
      select: {
        id: true,
        status: true,
        amountFcfa: true,
        parentUserId: true,
        cagnotte: { select: { title: true } },
      },
    });
    if (!contribution) {
      return NextResponse.json({ error: "Contribution introuvable" }, { status: 404 });
    }

    const nextStatus = decision === "CONFIRM" ? "CONFIRMED" : "REJECTED";
    const now = new Date();

    const applied = await prisma.$transaction(async (tx) => {
      const updated = await tx.cagnotteContribution.updateMany({
        where: { id: contribution.id, status: "PENDING" },
        data: {
          status: nextStatus,
          reviewedById: session.user.id,
          reviewedAt: now,
          reviewNote: note || null,
        },
      });
      if (updated.count === 0) return false;

      await tx.cagnotteJournalEntry.create({
        data: {
          cagnotteId,
          kind: decision === "CONFIRM" ? "CONTRIBUTION_PAID" : "CONTRIBUTION_REJECTED",
          actorUserId: session.user.id,
          amountFcfa: contribution.amountFcfa,
          message: note || null,
        },
      });

      await tx.notification.create({
        data: {
          userId: contribution.parentUserId,
          type: decision === "CONFIRM" ? "SUCCESS" : "WARNING",
          title: decision === "CONFIRM" ? "Contribution confirmée" : "Contribution non validée",
          message:
            decision === "CONFIRM"
              ? `Votre contribution de ${formatCurrency(Number(contribution.amountFcfa))} à « ${contribution.cagnotte.title} » a été reçue par l'établissement.`
              : `Votre contribution de ${formatCurrency(Number(contribution.amountFcfa))} à « ${contribution.cagnotte.title} » n'a pas été validée : ${note}`,
          link: `/dashboard/cagnotte/${cagnotteId}`,
        },
      });
      return true;
    });

    if (!applied) {
      return NextResponse.json(
        { error: "Cette contribution a déjà été traitée.", code: "CONTRIBUTION_ALREADY_REVIEWED" },
        { status: 409 },
      );
    }

    await createAuditLog({
      userId: session.user.id,
      action: decision === "CONFIRM" ? "CAGNOTTE_CONTRIBUTION_CONFIRM" : "CAGNOTTE_CONTRIBUTION_REJECT",
      entity: "CagnotteContribution",
      entityId: contribution.id,
      schoolId,
      newValues: { status: nextStatus, note: note || null, amountFcfa: contribution.amountFcfa.toString() },
    });

    return NextResponse.json({ id: contribution.id, status: nextStatus });
  },
  { allowedRoles: [...CAGNOTTE_REVIEWER_ROLES] },
);
