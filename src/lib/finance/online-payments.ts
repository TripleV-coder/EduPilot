/**
 * Paiements en ligne (Mobile Money, FedaPay, Flutterwave, Paystack) : solde,
 * réservation, confirmation et réconciliation — un seul endroit pour toutes les
 * règles d'argent du paiement en ligne (audit du 2026-10-15).
 *
 * Règles :
 * 1. Solde d'un frais (même règle que le guichet, `computeStudentBalances`) :
 *    dû = total de l'échéancier s'il existe (bourses déduites à sa création),
 *    sinon montant du frais ; encaissé = validé + rapproché.
 * 2. Un essai en ligne en attente depuis moins de 24 h RÉSERVE son montant :
 *    disponible pour un nouvel essai = dû − encaissé − réservé. Un essai plus
 *    ancien ne réserve plus rien (il ne peut pas bloquer la famille).
 * 3. Création d'un essai et confirmation se font sous un verrou par élève et
 *    par frais : deux demandes simultanées ne créent pas deux essais.
 * 4. Une confirmation n'est prise en compte que si le montant reçu est
 *    EXACTEMENT le montant attendu (FCFA entiers) et la devise XOF. Sinon :
 *    aucune validation, le paiement est marqué « à rapprocher » (note + journal).
 * 5. Une confirmation authentique arrivée après l'expiration locale (EXPIRED)
 *    valide encore le paiement : l'argent a été reçu. Un éventuel trop-perçu
 *    est enregistré et signalé, jamais ignoré.
 * 6. Après 24 h sans réponse, le fournisseur est interrogé : payé et au bon
 *    montant → validé ; échec confirmé → annulé ; incertain → EXPIRED, à
 *    rapprocher. Rien n'est supprimé.
 * 7. Toute validation recalcule l'échéancier (total payé, état des échéances)
 *    dans la même transaction et sous le même verrou : relances, plafond du
 *    guichet et soldes ne restent jamais sur un état antérieur (lot 3a).
 */
import type { Prisma, PaymentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { appendNote, syncPaymentPlanLedger } from "@/lib/finance/helpers";

export const ONLINE_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000;
export const EXPECTED_CURRENCY = "XOF";

export type OnlineProvider = "FEDAPAY" | "MOMO" | "FLUTTERWAVE" | "PAYSTACK";

type Db = Prisma.TransactionClient;

/** Verrou transactionnel par élève et par frais (libéré à la fin de la transaction). */
export async function lockStudentFee(tx: Db, studentId: string, feeId: string): Promise<void> {
    // `void` non désérialisable par Prisma : casté en texte
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${studentId}:${feeId}`}))::text`;
}

export interface FeeBalance {
    billed: number;
    settled: number;
    /** Essais en ligne en attente depuis moins de 24 h. */
    reserved: number;
    /** Reste dû (dû − encaissé). */
    remaining: number;
    /** Montant qu'un nouvel essai peut encore demander (reste dû − réservé). */
    available: number;
}

export async function getFeeBalance(db: Db, studentId: string, feeId: string, now = new Date()): Promise<FeeBalance | null> {
    const [fee, plan, payments] = await Promise.all([
        db.fee.findUnique({ where: { id: feeId }, select: { amount: true } }),
        db.paymentPlan.findFirst({
            where: { studentId, feeId, status: { not: "CANCELLED" } },
            select: { totalAmount: true },
            orderBy: { createdAt: "desc" },
        }),
        db.payment.findMany({
            where: { studentId, feeId, deletedAt: null, status: { in: ["VERIFIED", "RECONCILED", "PENDING"] } },
            select: { amount: true, status: true, createdAt: true },
        }),
    ]);
    if (!fee) return null;
    const billed = Math.round(Number(plan?.totalAmount ?? fee.amount));
    const reservedSince = now.getTime() - ONLINE_PAYMENT_TTL_MS;
    let settled = 0;
    let reserved = 0;
    for (const p of payments) {
        const amount = Math.round(Number(p.amount));
        if (p.status === "PENDING") {
            if (p.createdAt.getTime() > reservedSince) reserved += amount;
        } else {
            settled += amount;
        }
    }
    const remaining = Math.max(0, billed - settled);
    return { billed, settled, reserved, remaining, available: Math.max(0, remaining - reserved) };
}

// ─────────────────────────── Confirmation ───────────────────────────

export type ConfirmOutcome =
    | { outcome: "CONFIRMED"; paymentId: string; overpaid: number }
    | { outcome: "ALREADY_PROCESSED"; paymentId: string }
    | { outcome: "MISMATCH"; paymentId: string; reason: string }
    | { outcome: "NOT_FOUND" };

/** Montant d'un fournisseur ramené en FCFA ; null s'il est absent ou illisible. */
export function parseProviderAmount(value: unknown, provider: OnlineProvider): number | null {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
    if (!Number.isFinite(n)) return null;
    // Paystack exprime les montants en centièmes de la devise
    return provider === "PAYSTACK" ? n / 100 : n;
}

/** Devise d'un fournisseur (chaîne « XOF » ou objet `{ iso: "XOF" }`) ; null si absente. */
export function parseProviderCurrency(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
    if (value && typeof value === "object" && typeof (value as { iso?: unknown }).iso === "string") {
        return (value as { iso: string }).iso.trim().toUpperCase();
    }
    return null;
}

/** Écart qui empêche une validation, ou null si montant et devise sont conformes. */
export function confirmationMismatch(expected: number, receivedAmount: number | null, receivedCurrency: string | null): string | null {
    if (receivedCurrency !== null && receivedCurrency !== EXPECTED_CURRENCY) {
        return `devise reçue ${receivedCurrency} au lieu de ${EXPECTED_CURRENCY}`;
    }
    if (receivedAmount === null) return "montant non transmis par le fournisseur";
    if (receivedAmount !== expected) return `montant reçu ${receivedAmount} FCFA au lieu de ${expected} FCFA`;
    return null;
}

/**
 * Confirmation d'un paiement en ligne par son fournisseur (signature déjà
 * vérifiée par l'appelant). Idempotente : une confirmation reçue deux fois ne
 * compte qu'une fois.
 */
export async function confirmOnlinePayment(params: {
    reference: string;
    provider: OnlineProvider;
    /** Montant reçu, déjà ramené en FCFA (`parseProviderAmount`) ; null = inconnu. */
    receivedAmount: number | null;
    /** Devise reçue ; null = non transmise (la transaction a été créée en XOF par EduPilot). */
    receivedCurrency: string | null;
    providerTransactionId?: string | null;
    source: string;
}): Promise<ConfirmOutcome> {
    const payment = await prisma.payment.findUnique({
        where: { reference: params.reference },
        select: { id: true, studentId: true, feeId: true, amount: true, status: true, notes: true },
    });
    if (!payment) return { outcome: "NOT_FOUND" };
    if (payment.status === "VERIFIED" || payment.status === "RECONCILED") {
        return { outcome: "ALREADY_PROCESSED", paymentId: payment.id };
    }

    const expected = Math.round(Number(payment.amount));
    const reason = confirmationMismatch(expected, params.receivedAmount, params.receivedCurrency);
    if (reason) {
        // Aucune validation : le comptable rapproche à la main, l'écart est tracé
        await prisma.payment.update({
            where: { id: payment.id },
            data: { notes: appendNote(payment.notes, `À rapprocher (${params.source}) : ${reason}.`) },
        });
        logger.warn("Paiement en ligne : confirmation refusée", {
            paymentId: payment.id,
            reason,
            source: params.source,
            providerTransactionId: params.providerTransactionId ?? null,
        });
        return { outcome: "MISMATCH", paymentId: payment.id, reason };
    }

    return prisma.$transaction(async (tx) => {
        await lockStudentFee(tx, payment.studentId, payment.feeId);
        const balance = await getFeeBalance(tx, payment.studentId, payment.feeId);
        const now = new Date();
        // Validation unique : seul un paiement encore en attente ou expiré passe à « validé »
        const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: { in: ["PENDING", "EXPIRED"] satisfies PaymentStatus[] } },
            data: {
                status: "VERIFIED",
                paidAt: now,
                reconciledAt: now,
                ...(params.providerTransactionId ? { providerTransactionId: params.providerTransactionId } : {}),
            },
        });
        if (claimed.count !== 1) return { outcome: "ALREADY_PROCESSED" as const, paymentId: payment.id };

        // Trop-perçu : l'argent est reçu (on l'enregistre), l'excédent est signalé
        const overpaid = balance ? Math.max(0, balance.settled + expected - balance.billed) : 0;
        const late = payment.status === "EXPIRED" ? " (confirmation tardive, après expiration)" : "";
        const excess = overpaid > 0 ? ` Trop-perçu de ${overpaid} FCFA à traiter.` : "";
        await tx.payment.update({
            where: { id: payment.id },
            data: { notes: appendNote(payment.notes, `Confirmé par ${params.source}${late}.${excess}`) },
        });
        // Même règle d'imputation que le guichet ; une erreur annule toute la validation
        await syncPaymentPlanLedger(tx, payment.studentId, payment.feeId);
        if (overpaid > 0) logger.warn("Paiement en ligne : trop-perçu", { paymentId: payment.id, overpaid, source: params.source });
        return { outcome: "CONFIRMED" as const, paymentId: payment.id, overpaid };
    });
}

/** Échec confirmé par le fournisseur : l'essai est annulé (la dette reste due). */
export async function failOnlinePayment(reference: string, source: string): Promise<number> {
    const result = await prisma.payment.updateMany({
        where: { reference, status: { in: ["PENDING", "EXPIRED"] satisfies PaymentStatus[] } },
        data: { status: "CANCELLED" },
    });
    if (result.count > 0) logger.info("Paiement en ligne annulé par le fournisseur", { reference, source });
    return result.count;
}

export type WebhookProvider = "FLUTTERWAVE" | "PAYSTACK";

function str(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
}

/**
 * Lecture des événements Flutterwave (`data.tx_ref`, `data.status`
 * « successful ») et Paystack (`data.reference`, `data.status` « success »,
 * montant en centièmes). Les champs à la racine restent acceptés.
 */
export function readProviderEvent(body: Record<string, unknown>, provider: WebhookProvider) {
    const data = (body.data && typeof body.data === "object" ? body.data : body) as Record<string, unknown>;
    const reference =
        provider === "PAYSTACK"
            ? str(data.reference) ?? str(body.reference)
            : str(data.tx_ref) ?? str(body.tx_ref) ?? str(body.id) ?? str(body.transaction_id);
    const rawStatus = (str(data.status) ?? str(body.status) ?? "").toLowerCase();
    const status: "SUCCESS" | "FAILED" | null =
        rawStatus === "successful" || rawStatus === "success"
            ? "SUCCESS"
            : rawStatus === "failed" || rawStatus === "abandoned"
              ? "FAILED"
              : null;
    return {
        reference,
        status,
        amount: parseProviderAmount(data.amount ?? body.amount, provider),
        currency: parseProviderCurrency(data.currency ?? body.currency),
        providerTransactionId: str(data.id) ?? str(data.flw_ref),
    };
}

// ─────────────────────────── Réconciliation ───────────────────────────

export type VerifyFn = (
    provider: OnlineProvider,
    transactionId: string,
) => Promise<{ status: "SUCCESS" | "FAILED" | "PENDING"; rawData: unknown }>;

export interface ReconcileReport {
    examined: number;
    confirmed: number;
    cancelled: number;
    expired: number;
    mismatched: number;
    /** Erreur pendant la validation (recalcul compris) : laissé en attente, repris au passage suivant. */
    failed: number;
}

/** Montant et devise lus dans la réponse de vérification d'un fournisseur. */
function amountFromRaw(provider: OnlineProvider, raw: unknown): { amount: number | null; currency: string | null } {
    const r = (raw ?? {}) as Record<string, unknown>;
    const data = (r.data && typeof r.data === "object" ? r.data : r) as Record<string, unknown>;
    return { amount: parseProviderAmount(data.amount, provider), currency: parseProviderCurrency(data.currency) };
}

/**
 * Essais en ligne en attente depuis plus de 24 h : le fournisseur est
 * interrogé quand c'est possible, sinon l'essai passe à EXPIRED (à rapprocher).
 */
export async function reconcileStalePayments(verify: VerifyFn, now = new Date(), limit = 200): Promise<ReconcileReport> {
    const report: ReconcileReport = { examined: 0, confirmed: 0, cancelled: 0, expired: 0, mismatched: 0, failed: 0 };
    const stale = await prisma.payment.findMany({
        where: { status: "PENDING", deletedAt: null, createdAt: { lt: new Date(now.getTime() - ONLINE_PAYMENT_TTL_MS) } },
        select: { id: true, reference: true, provider: true, providerTransactionId: true, notes: true },
        orderBy: { createdAt: "asc" },
        take: limit,
    });
    for (const p of stale) {
        report.examined++;
        const provider = p.provider as OnlineProvider | null;
        let verdict: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
        let raw: unknown = null;
        if (provider && p.providerTransactionId) {
            try {
                ({ status: verdict, rawData: raw } = await verify(provider, p.providerTransactionId));
            } catch (error) {
                logger.warn("Réconciliation : fournisseur injoignable", { paymentId: p.id, reason: (error as Error).message });
            }
        }
        if (verdict === "SUCCESS" && provider && p.reference) {
            const { amount, currency } = amountFromRaw(provider, raw);
            let result: ConfirmOutcome;
            try {
                result = await confirmOnlinePayment({
                    reference: p.reference,
                    provider,
                    receivedAmount: amount,
                    receivedCurrency: currency,
                    providerTransactionId: p.providerTransactionId,
                    source: `réconciliation ${provider}`,
                });
            } catch (error) {
                // Validation annulée en bloc : le paiement reste en attente, les autres sont traités
                report.failed++;
                logger.error("Réconciliation : validation impossible, reprise au prochain passage", error, { paymentId: p.id });
                continue;
            }
            if (result.outcome === "CONFIRMED" || result.outcome === "ALREADY_PROCESSED") {
                report.confirmed++;
                continue;
            }
            if (result.outcome === "MISMATCH") report.mismatched++;
        } else if (verdict === "FAILED" && p.reference) {
            report.cancelled += await failOnlinePayment(p.reference, `réconciliation ${provider}`);
            continue;
        }
        // Résultat incertain : plus de réservation, à rapprocher ; rien n'est supprimé
        const current = await prisma.payment.findUnique({ where: { id: p.id }, select: { notes: true } });
        const moved = await prisma.payment.updateMany({
            where: { id: p.id, status: "PENDING" },
            data: {
                status: "EXPIRED",
                notes: appendNote(current?.notes ?? null, "Non confirmé après 24 h : à rapprocher avec le relevé du fournisseur."),
            },
        });
        report.expired += moved.count;
    }
    if (report.examined > 0) logger.info("Réconciliation des paiements en ligne", { ...report });
    return report;
}
