import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { getOwnStudentIds } from "@/lib/auth/family-scope";
import { roleSatisfies } from "@/lib/rbac/permissions";

/**
 * GET /api/payments/status?ref=… — statut d'un paiement en ligne, lu en base
 * (S4, 2026-10-18). Sert la page de retour après paiement : le retour du
 * navigateur n'a aucune autorité, seul l'état enregistré (confirmé par le
 * webhook signé ou la réconciliation) fait foi.
 *
 * Lisible par la famille de l'élève (parent lié, élève lui-même) et par le
 * personnel financier de son école. Pour tout autre demandeur, même réponse
 * qu'une référence inexistante (aucune énumération). Aucun identifiant
 * fournisseur ni donnée d'un autre élève n'est renvoyé.
 */
const STAFF_ROLES = ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] as const;

type PublicStatus = "CONFIRMED" | "PENDING" | "FAILED" | "UNDER_REVIEW";

function publicStatus(status: string, notes: string | null): PublicStatus {
    if (status === "VERIFIED" || status === "RECONCILED") return "CONFIRMED";
    if (status === "CANCELLED" || status === "EXPIRED") return "FAILED";
    // En attente : résultat inconnu ou bloqué → « en vérification », jamais « échoué »
    if (notes && /(incertain|inconnu|bloquée|refusée)/i.test(notes)) return "UNDER_REVIEW";
    return "PENDING";
}

export const GET = createApiHandler(async (request, { session }) => {
    const reference = new URL(request.url).searchParams.get("ref")?.trim();
    if (!reference || reference.length > 100) {
        return NextResponse.json({ error: "Référence de paiement requise" }, { status: 400 });
    }
    const notFound = () => NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

    const payment = await prisma.payment.findUnique({
        where: { reference },
        select: {
            studentId: true,
            amount: true,
            status: true,
            notes: true,
            paidAt: true,
            fee: { select: { name: true } },
            student: { select: { schoolId: true } },
        },
    });
    if (!payment) return notFound();

    const role = session.user.role;
    const ownIds = await getOwnStudentIds(role, session.user.id);
    const allowed = ownIds
        ? ownIds.includes(payment.studentId)
        : role === "SUPER_ADMIN" || (roleSatisfies(role, [...STAFF_ROLES]) && canAccessSchool(session, payment.student.schoolId));
    if (!allowed) return notFound();

    return NextResponse.json({
        reference,
        status: publicStatus(payment.status, payment.notes),
        amount: Math.round(Number(payment.amount)),
        feeName: payment.fee.name,
        paidAt: payment.status === "VERIFIED" || payment.status === "RECONCILED" ? payment.paidAt : null,
    });
});
