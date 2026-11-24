/**
 * Écritures comptables des paiements de frais (FIN-04, 2026-11-24).
 *
 * La scolarité relève du service de comptabilité : chaque encaissement de
 * frais apparaît dans son journal, sans ressaisie. Principe : par ÉCART,
 * idempotent. Pour chaque paiement, le journal doit refléter son montant
 * encaissé actuel (montant si validé ou rapproché, 0 sinon ; négatif pour un
 * remboursement). On n'écrit que la différence avec ce qui est déjà passé :
 * - validation → Débit trésorerie / Crédit 70100 Scolarité ;
 * - annulation d'un paiement validé → contre-passation (sens inverse) ;
 * - remboursement (extourne) → Débit 70100 / Crédit trésorerie ;
 * - montant corrigé → écriture de l'écart.
 * Rien n'est jamais modifié ni supprimé dans le journal.
 *
 * Trésorerie selon le moyen : espèces, chèque, autre → 57100 Caisse ;
 * virement → 52100 Banque ; Mobile Money ou paiement en ligne → 52200.
 * Appelé dans la transaction et sous le verrou élève/frais de chaque écriture
 * de paiement (runFeeMutation, confirmOnlinePayment).
 */
import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { ensureOpenChart } from "@/lib/accounting/ensure-chart";

type Tx = Prisma.TransactionClient;

const SETTLED: readonly PaymentStatus[] = ["VERIFIED", "RECONCILED"];
export const TUITION_INCOME_CODE = "70100";

export function treasuryCodeFor(method: PaymentMethod, provider: string | null): string {
    if (provider || method === "MOBILE_MONEY_MTN" || method === "MOBILE_MONEY_MOOV") return "52200";
    if (method === "BANK_TRANSFER") return "52100";
    return "57100";
}

/** Effet attendu d'un paiement sur l'encaissé (FCFA entiers, signé). */
export function expectedPostedAmount(payment: { status: PaymentStatus; amount: Prisma.Decimal | number | string; deletedAt: Date | null }): number {
    if (payment.deletedAt || !SETTLED.includes(payment.status)) return 0;
    return Math.round(Number(payment.amount));
}

/** Aligne le journal sur les paiements d'un élève pour un frais. Renvoie le nombre d'écritures créées. */
export async function syncFeeAccounting(tx: Tx, studentId: string, feeId: string): Promise<number> {
    const payments = await tx.payment.findMany({
        where: { studentId, feeId },
        select: {
            id: true, amount: true, status: true, method: true, provider: true, deletedAt: true, paidAt: true,
            refundOfId: true, fee: { select: { schoolId: true, name: true } },
        },
    });
    let created = 0;
    for (const payment of payments) {
        created += await postPaymentDelta(tx, payment);
    }
    return created;
}

async function postPaymentDelta(
    tx: Tx,
    payment: {
        id: string; amount: Prisma.Decimal; status: PaymentStatus; method: PaymentMethod; provider: string | null;
        deletedAt: Date | null; paidAt: Date | null; refundOfId: string | null; fee: { schoolId: string; name: string };
    },
): Promise<number> {
    const target = expectedPostedAmount(payment);
    const posted = await tx.journalEntry.aggregate({ where: { sourcePaymentId: payment.id }, _sum: { sourceAmountFcfa: true } });
    const already = Number(posted._sum.sourceAmountFcfa ?? 0);
    const delta = target - already;
    if (delta === 0) return 0;

    const schoolId = payment.fee.schoolId;
    await ensureOpenChart(tx as never, schoolId);
    const [fiscalYear, accounts, count] = await Promise.all([
        tx.fiscalYear.findFirst({ where: { schoolId, status: "OPEN" }, orderBy: { startDate: "desc" }, select: { id: true } }),
        tx.ohadaAccount.findMany({
            where: { schoolId, syscohadaCode: { in: [TUITION_INCOME_CODE, treasuryCodeFor(payment.method, payment.provider)] } },
            select: { id: true, syscohadaCode: true },
        }),
        tx.journalEntry.count({ where: { sourcePaymentId: payment.id } }),
    ]);
    const income = accounts.find((a) => a.syscohadaCode === TUITION_INCOME_CODE);
    const treasury = accounts.find((a) => a.syscohadaCode !== TUITION_INCOME_CODE);
    if (!fiscalYear || !income || !treasury) throw new Error(`Plan comptable incomplet pour l'école ${schoolId}`);

    // Entrée d'argent : Débit trésorerie / Crédit produit ; sortie : l'inverse
    const amount = Math.abs(delta);
    const [debit, credit] = delta > 0 ? [treasury, income] : [income, treasury];
    const kind = delta > 0 ? (already === 0 ? "Encaissement" : "Complément") : payment.refundOfId ? "Remboursement" : "Contre-passation";
    const label = `${kind} — ${payment.fee.name}`.slice(0, 200);
    await tx.journalEntry.create({
        data: {
            schoolId,
            fiscalYearId: fiscalYear.id,
            pieceRef: `PAY-${payment.id}-${count + 1}`,
            entryDate: payment.paidAt ?? new Date(),
            label,
            status: "POSTED",
            sourcePaymentId: payment.id,
            sourceAmountFcfa: BigInt(delta),
            lines: { create: [{ debitAccountId: debit.id, creditAccountId: credit.id, amountFcfa: BigInt(amount), label }] },
        },
    });
    // Soldes : même convention que la paie (compte débité +, compte crédité −)
    await tx.ohadaAccount.update({ where: { id: debit.id }, data: { balanceFcfa: { increment: BigInt(amount) } } });
    await tx.ohadaAccount.update({ where: { id: credit.id }, data: { balanceFcfa: { decrement: BigInt(amount) } } });
    return 1;
}

/** Rattrapage (historique, ou après incident) : tous les paiements d'une école. */
export async function backfillSchoolAccounting(
    /** Ouvre une transaction et prend le verrou élève/frais du couple avant `fn`. */
    runLocked: <T>(pair: { studentId: string; feeId: string }, fn: (tx: Tx) => Promise<T>) => Promise<T>,
    listPairs: () => Promise<Array<{ studentId: string; feeId: string }>>,
): Promise<{ pairs: number; entries: number }> {
    const pairs = await listPairs();
    let entries = 0;
    for (const pair of pairs) {
        entries += await runLocked(pair, (tx) => syncFeeAccounting(tx, pair.studentId, pair.feeId));
    }
    return { pairs: pairs.length, entries };
}
