/**
 * Écritures qui consomment ou libèrent le reste dû d'un élève pour un frais
 * (lot 3b, audit paiements P-02/P-03/P-04) : encaissements manuels,
 * modifications, annulations, paiement d'une échéance.
 *
 * Chaque écriture s'exécute dans UNE transaction qui :
 * 1. prend le verrou par élève et par frais (`lockStudentFee`, le même que
 *    l'initiation et la confirmation des paiements en ligne) : guichet, API
 *    et paiement en ligne ne peuvent plus dépenser deux fois le même solde ;
 * 2. relit le solde à jour (`getFeeBalance`, jamais l'agrégat
 *    `paymentPlan.paidAmount`) : dû = total de l'échéancier s'il existe,
 *    sinon montant du frais ; encaissé = validé + rapproché ; réservé =
 *    essais en ligne encore en attente (PENDING), quel que soit leur âge ;
 * 3. écrit, puis recalcule l'échéancier (`syncPaymentPlanLedger`) dans la
 *    même transaction. Un refus ou une erreur n'écrit rien.
 *
 * Règles métier inchangées : imputation chronologique, bourses déduites à
 * la création d'un échéancier seulement, droits de modification actuels.
 */
import { Prisma, type PaymentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getFeeBalance, lockStudentFee, type FeeBalance } from "@/lib/finance/online-payments";
import { syncPaymentPlanLedger } from "@/lib/finance/helpers";

type Tx = Prisma.TransactionClient;

export interface FeeMutationRefusal {
    status: 400 | 403 | 404 | 409;
    error: string;
}

/** Refus levé dans la transaction : elle est annulée, rien n'est écrit. */
export class FeeMutationRefused extends Error {
    constructor(readonly refusal: FeeMutationRefusal) {
        super(refusal.error);
    }
}

export const refuse = (status: FeeMutationRefusal["status"], error: string): never => {
    throw new FeeMutationRefused({ status, error });
};

export type FeeMutationResult<T> =
    | { ok: true; value: T; plan: Awaited<ReturnType<typeof syncPaymentPlanLedger>> }
    | { ok: false; refusal: FeeMutationRefusal };

const SETTLED: PaymentStatus[] = ["VERIFIED", "RECONCILED"];

/** Poids d'un paiement sur le solde (même règle que getFeeBalance) : encaissé, réservé, ou rien. */
function weightOf(payment: { status: PaymentStatus; amount: Prisma.Decimal | number; deletedAt?: Date | null }) {
    const amount = Math.round(Number(payment.amount));
    if (payment.deletedAt) return { settled: 0, reserved: 0 };
    if (SETTLED.includes(payment.status)) return { settled: amount, reserved: 0 };
    if (payment.status === "PENDING") return { settled: 0, reserved: amount };
    return { settled: 0, reserved: 0 };
}

/** Disponible si ce paiement ne pesait plus sur le solde (avant de le modifier). */
export function availableWithout(
    balance: FeeBalance,
    payment: { status: PaymentStatus; amount: Prisma.Decimal | number; deletedAt?: Date | null },
): number {
    const w = weightOf(payment);
    const remaining = Math.max(0, balance.billed - (balance.settled - w.settled));
    return Math.max(0, remaining - (balance.reserved - w.reserved));
}

/** Un paiement dans ce statut pèserait-il sur le solde ? */
export function wouldWeigh(status: PaymentStatus): boolean {
    const weight = weightOf({ status, amount: 1 });
    return weight.settled + weight.reserved > 0;
}

/** Refuse un montant supérieur au disponible (solde nul compris). */
export function assertWithinAvailable(available: number, amount: number): void {
    const requested = Math.round(amount);
    if (requested > available) {
        refuse(400, `Le montant saisi (${requested} FCFA) dépasse le reste à payer disponible (${available} FCFA).`);
    }
}

/** Référence déjà portée par un autre paiement : refus avant toute écriture. */
export async function assertReferenceFree(tx: Tx, reference: string | null | undefined, exceptPaymentId?: string): Promise<void> {
    if (!reference) return;
    const existing = await tx.payment.findUnique({ where: { reference }, select: { id: true } });
    if (existing && existing.id !== exceptPaymentId) refuse(409, "Cette référence de paiement est déjà utilisée.");
}

/**
 * Exécute `work` sous le verrou élève/frais avec le solde à jour, puis
 * recalcule l'échéancier, le tout dans une seule transaction.
 */
export async function runFeeMutation<T>(
    studentId: string,
    feeId: string,
    work: (tx: Tx, balance: FeeBalance) => Promise<T>,
): Promise<FeeMutationResult<T>> {
    try {
        const { value, plan } = await prisma.$transaction(async (tx) => {
            await lockStudentFee(tx, studentId, feeId);
            const balance = await getFeeBalance(tx, studentId, feeId);
            if (!balance) refuse(404, "Frais introuvable");
            const value = await work(tx, balance!);
            const plan = await syncPaymentPlanLedger(tx, studentId, feeId);
            return { value, plan };
        });
        return { ok: true, value, plan };
    } catch (error) {
        if (error instanceof FeeMutationRefused) return { ok: false, refusal: error.refusal };
        // Référence invisible pour cette école (RLS) mais déjà prise ailleurs
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { ok: false, refusal: { status: 409, error: "Cette référence de paiement est déjà utilisée." } };
        }
        throw error;
    }
}
