/**
 * Remboursements tracés dans EduPilot (décision du 2026-11-02).
 *
 * Un remboursement est une ÉCRITURE D'EXTOURNE : une ligne de paiement au
 * montant négatif, liée au paiement remboursé (`refundOfId`), validée d'emblée
 * (l'argent est rendu par l'école). Conséquences, sans autre traitement :
 * - encaissé, reste à payer, statistiques, rapports : nets ;
 * - échéancier : recalculé sous le même verrou, le remboursement est déduit du
 *   paiement qu'il annule (une échéance couverte peut redevenir due).
 *
 * Règles :
 * 1. Seul un paiement validé ou rapproché, non supprimé, qui n'est pas lui-même
 *    un remboursement, peut être remboursé.
 * 2. Le cumul des remboursements ne dépasse jamais le montant du paiement
 *    (contrôle sous le verrou élève/frais : deux remboursements simultanés ne
 *    franchissent pas la limite).
 * 3. Montant en FCFA entiers, motif obligatoire, auteur et date tracés.
 * 4. Paiement en ligne : EduPilot trace le remboursement ; l'argent est rendu
 *    depuis l'espace du fournisseur (aucun appel de remboursement automatique).
 */
import type { PaymentMethod, Prisma } from "@prisma/client";
import { refuse, runFeeMutation, type FeeMutationResult } from "@/lib/finance/collection";

type Tx = Prisma.TransactionClient;

export const MAX_REFUND_REASON = 500;

/** Somme déjà remboursée (positive) d'un paiement : extournes actives seulement. */
export async function refundedTotal(tx: Tx, paymentId: string): Promise<number> {
    const agg = await tx.payment.aggregate({
        where: { refundOfId: paymentId, deletedAt: null, status: { in: ["VERIFIED", "RECONCILED"] } },
        _sum: { amount: true },
    });
    return Math.round(-Number(agg._sum.amount ?? 0));
}

export interface RefundInput {
    paymentId: string;
    amount: number;
    reason: string;
    method: PaymentMethod;
    reference?: string | null;
    actorId: string;
}

export type RefundRecord = {
    id: string;
    refundOfId: string;
    amount: number;
    refundedTotal: number;
    refundable: number;
};

/**
 * Enregistre un remboursement. Le paiement d'origine a déjà été lu et
 * contrôlé (école, rôle) par l'appelant ; il est relu ici sous le verrou.
 */
export async function recordRefund(
    original: { id: string; studentId: string; feeId: string },
    input: RefundInput,
): Promise<FeeMutationResult<RefundRecord>> {
    return runFeeMutation(original.studentId, original.feeId, async (tx) => {
        const payment = await tx.payment.findUnique({
            where: { id: original.id },
            select: { id: true, amount: true, status: true, deletedAt: true, refundOfId: true, studentId: true, feeId: true },
        });
        if (!payment || payment.deletedAt) return refuse(404, "Paiement non trouvé");
        if (payment.refundOfId) return refuse(409, "Un remboursement ne peut pas être remboursé.");
        if (payment.status !== "VERIFIED" && payment.status !== "RECONCILED") {
            return refuse(409, "Seul un paiement encaissé (validé ou rapproché) peut être remboursé.");
        }

        const amount = Math.round(input.amount);
        if (!Number.isInteger(input.amount) || amount <= 0) {
            return refuse(400, "Le montant du remboursement doit être un nombre entier de FCFA, supérieur à 0.");
        }

        const paid = Math.round(Number(payment.amount));
        const already = await refundedTotal(tx, payment.id);
        const refundable = Math.max(0, paid - already);
        if (amount > refundable) {
            return refuse(
                400,
                refundable === 0
                    ? "Ce paiement a déjà été intégralement remboursé."
                    : `Le remboursement (${amount} FCFA) dépasse le montant encore remboursable (${refundable} FCFA).`,
            );
        }

        if (input.reference) {
            const taken = await tx.payment.findUnique({ where: { reference: input.reference }, select: { id: true } });
            if (taken) return refuse(409, "Cette référence est déjà utilisée.");
        }

        const created = await tx.payment.create({
            data: {
                studentId: payment.studentId,
                feeId: payment.feeId,
                amount: -amount,
                method: input.method,
                reference: input.reference || null,
                status: "VERIFIED",
                paidAt: new Date(),
                receivedBy: input.actorId,
                refundOfId: payment.id,
                notes: `Remboursement : ${input.reason}`,
            },
            select: { id: true },
        });

        return {
            id: created.id,
            refundOfId: payment.id,
            amount,
            refundedTotal: already + amount,
            refundable: refundable - amount,
        };
    });
}
