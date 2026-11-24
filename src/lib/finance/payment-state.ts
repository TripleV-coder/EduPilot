/**
 * Transitions MANUELLES de statut d'un paiement (FIN-03 / FIN-06, 2026-11-24).
 *
 * Les transitions automatiques (webhook signé, réconciliation, « Interroger le
 * fournisseur », remboursement) sont décrites dans online-payments.ts et
 * docs/EDUPILOT_FINANCIAL_RELIABILITY.md §4. Ici, les seules règles qu'une
 * modification à la main doit respecter :
 *
 * 1. Aucun paiement ne REVIENT « en attente » (PENDING) : cela recréerait une
 *    réservation et effacerait silencieusement un encaissement ou une
 *    annulation. Doublé en base (trigger payments_no_return_to_pending).
 * 2. Un paiement EN LIGNE (provider renseigné) n'est jamais validé à la main :
 *    seul le fournisseur prouve la réception de l'argent. Le rapprochement
 *    (RECONCILED) n'est possible qu'une fois le paiement validé.
 * 3. Le reste est inchangé (paiement déclaré au guichet : l'école atteste).
 */
import type { PaymentStatus } from "@prisma/client";

export const MANUAL_PAYMENT_STATUSES = ["PENDING", "VERIFIED", "RECONCILED", "CANCELLED"] as const satisfies readonly PaymentStatus[];

export function manualStatusRefusal(
    current: { status: PaymentStatus; provider: string | null },
    next: PaymentStatus | undefined,
): string | null {
    if (!next || next === current.status) return null;
    if (next === "PENDING") {
        return "Un paiement ne peut pas revenir « en attente » : annulez-le ou enregistrez un nouveau paiement.";
    }
    if (current.provider && next === "VERIFIED") {
        return "Paiement en ligne : seule la confirmation du fournisseur le valide. Utilisez « Interroger le fournisseur » (Finance › Rapprochement).";
    }
    if (current.provider && next === "RECONCILED" && current.status !== "VERIFIED") {
        return "Paiement en ligne : il ne peut être rapproché qu'après la confirmation du fournisseur.";
    }
    return null;
}
