/**
 * Paiements en ligne (Mobile Money, FedaPay, Flutterwave, Paystack) : solde,
 * réservation, confirmation et réconciliation — un seul endroit pour toutes les
 * règles d'argent du paiement en ligne (audit du 2026-10-15).
 *
 * Règles :
 * 1. Solde d'un frais (même règle que le guichet, `computeStudentBalances`) :
 *    dû = total de l'échéancier s'il existe (bourses déduites à sa création),
 *    sinon montant du frais ; encaissé = validé + rapproché.
 * 2. Un essai en ligne en attente (PENDING) RÉSERVE son montant, quel que
 *    soit son âge : disponible = dû − encaissé − réservé. La réservation ne
 *    tombe que lorsque le statut l'établit : validé, annulé (échec ou
 *    expiration définitifs chez le fournisseur) ou expiré (échec de
 *    l'initialisation chez le fournisseur, voir initiate). Les 24 h ne
 *    sont qu'un seuil de réconciliation : avant elle, une confirmation reste
 *    possible et le guichet ne doit pas consommer ce montant (lot 3b).
 * 3. Création d'un essai et confirmation se font sous un verrou par élève et
 *    par frais : deux demandes simultanées ne créent pas deux essais.
 * 4. Une confirmation n'est prise en compte que si le montant reçu est
 *    EXACTEMENT le montant attendu (FCFA entiers) et la devise XOF. Sinon :
 *    aucune validation, le paiement est marqué « à rapprocher » (note + journal).
 * 5. Une confirmation authentique (signature, référence, montant et devise
 *    conformes) arrivée après l'expiration locale (EXPIRED) ou une annulation
 *    (CANCELLED) valide encore le paiement : l'argent a été reçu. L'état
 *    antérieur est noté ; après une annulation manuelle ou d'origine inconnue
 *    (`cancellationSource`), l'administration financière est alertée. Un
 *    éventuel trop-perçu est enregistré et signalé, jamais ignoré (lot 3b).
 * 6. Après 24 h sans réponse, le fournisseur est interrogé : payé et au bon
 *    montant → validé ; échec ou expiration définitifs → annulé ; en attente,
 *    injoignable ou incertain → reste PENDING (réservé), alerte à
 *    l'administration financière après 48 h. Rien n'est supprimé (lot 3b).
 * 7. Toute validation recalcule l'échéancier (total payé, état des échéances)
 *    dans la même transaction et sous le même verrou : relances, plafond du
 *    guichet et soldes ne restent jamais sur un état antérieur (lot 3a).
 */
import type { Prisma, PaymentStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { appendNote, syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { createNotifications } from "@/lib/services/notification.service";

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
    /** Essais en ligne encore en attente (PENDING), quel que soit leur âge. */
    reserved: number;
    /** Reste dû (dû − encaissé). */
    remaining: number;
    /** Montant qu'un nouvel essai peut encore demander (reste dû − réservé). */
    available: number;
}

export async function getFeeBalance(db: Db, studentId: string, feeId: string): Promise<FeeBalance | null> {
    const [fee, plan, payments] = await Promise.all([
        db.fee.findUnique({ where: { id: feeId }, select: { amount: true } }),
        db.paymentPlan.findFirst({
            where: { studentId, feeId, status: { not: "CANCELLED" } },
            select: { totalAmount: true },
            orderBy: { createdAt: "desc" },
        }),
        db.payment.findMany({
            where: { studentId, feeId, deletedAt: null, status: { in: ["VERIFIED", "RECONCILED", "PENDING"] } },
            select: { amount: true, status: true },
        }),
    ]);
    if (!fee) return null;
    const billed = Math.round(Number(plan?.totalAmount ?? fee.amount));
    let settled = 0;
    let reserved = 0;
    for (const p of payments) {
        const amount = Math.round(Number(p.amount));
        if (p.status === "PENDING") reserved += amount;
        else settled += amount;
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
        select: { id: true, studentId: true, feeId: true, amount: true, status: true, notes: true, student: { select: { schoolId: true } } },
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

    const result = await prisma.$transaction(async (tx) => {
        await lockStudentFee(tx, payment.studentId, payment.feeId);
        // État relu sous verrou : une annulation manuelle concurrente est vue ici
        const current = await tx.payment.findUnique({
            where: { id: payment.id },
            select: { status: true, notes: true, cancellationSource: true },
        });
        if (!current || !(["PENDING", "EXPIRED", "CANCELLED"] as PaymentStatus[]).includes(current.status)) {
            return { outcome: "ALREADY_PROCESSED" as const, paymentId: payment.id, alert: null };
        }
        const balance = await getFeeBalance(tx, payment.studentId, payment.feeId);
        const now = new Date();
        // Validation unique (idempotente) : en attente, expiré, ou annulé — une
        // confirmation authentique prouve que l'argent est reçu (lot 3b)
        const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: current.status },
            data: {
                status: "VERIFIED",
                paidAt: now,
                reconciledAt: now,
                ...(params.providerTransactionId ? { providerTransactionId: params.providerTransactionId } : {}),
            },
        });
        if (claimed.count !== 1) return { outcome: "ALREADY_PROCESSED" as const, paymentId: payment.id, alert: null };

        // Trop-perçu : l'argent est reçu (on l'enregistre), l'excédent est signalé
        const overpaid = balance ? Math.max(0, balance.settled + expected - balance.billed) : 0;
        const origin =
            current.cancellationSource === "PROVIDER" ? "échec signalé par le fournisseur"
            : current.cancellationSource === "MANUAL" ? "annulation manuelle par l'école"
            : "origine inconnue";
        const previous =
            current.status === "EXPIRED" ? " (confirmation tardive, après expiration)"
            : current.status === "CANCELLED" ? ` (validé après annulation — état antérieur : annulé, ${origin})`
            : "";
        const excess = overpaid > 0 ? ` Trop-perçu de ${overpaid} FCFA à traiter.` : "";
        await tx.payment.update({
            where: { id: payment.id },
            data: { notes: appendNote(current.notes, `Confirmé par ${params.source}${previous}.${excess}`) },
        });
        // Même règle d'imputation que le guichet ; une erreur annule toute la validation
        await syncPaymentPlanLedger(tx, payment.studentId, payment.feeId);
        if (overpaid > 0) logger.warn("Paiement en ligne : trop-perçu", { paymentId: payment.id, overpaid, source: params.source });
        // Annulation décidée par l'école (ou d'origine inconnue) : un responsable doit le savoir
        const alert = current.status === "CANCELLED" && current.cancellationSource !== "PROVIDER" ? { origin, overpaid } : null;
        return { outcome: "CONFIRMED" as const, paymentId: payment.id, overpaid, alert };
    });

    if (result.alert) {
        logger.warn("Paiement en ligne : validé après une annulation manuelle ou d'origine inconnue", { paymentId: payment.id, source: params.source });
        await alertFinanceStaff(
            payment.student.schoolId,
            "Paiement validé après une annulation",
            `Le fournisseur a confirmé un paiement en ligne de ${expected} FCFA (référence ${params.reference}) qui avait été annulé (${result.alert.origin}). Il est désormais comptabilisé${result.alert.overpaid > 0 ? ` ; trop-perçu de ${result.alert.overpaid} FCFA à traiter` : ""}. Vérifiez la situation de la famille.`,
        ).catch((error) => logger.error("Alerte financière non envoyée", error, { paymentId: payment.id }));
    }
    if (result.outcome === "CONFIRMED") return { outcome: "CONFIRMED", paymentId: result.paymentId, overpaid: result.overpaid };
    return { outcome: "ALREADY_PROCESSED", paymentId: result.paymentId };
}

/** Échec confirmé par le fournisseur : l'essai est annulé (la dette reste due). */
export async function failOnlinePayment(reference: string, source: string): Promise<number> {
    const result = await prisma.payment.updateMany({
        where: { reference, status: { in: ["PENDING", "EXPIRED"] satisfies PaymentStatus[] } },
        data: { status: "CANCELLED", cancellationSource: "PROVIDER" },
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
    /** Résultat inconnu (en attente, injoignable, incertain) : reste PENDING, montant réservé. */
    stillPending: number;
    /** Alertes envoyées à l'administration financière (en attente depuis plus de 48 h). */
    alerted: number;
    mismatched: number;
    /** Erreur pendant la validation (recalcul compris) : laissé en attente, repris au passage suivant. */
    failed: number;
}

/** Au-delà, un paiement toujours en attente est signalé à l'administration financière (jamais libéré). */
export const PENDING_ALERT_MS = 48 * 60 * 60 * 1000;
const UNCERTAIN_NOTE = "Sans réponse définitive du fournisseur après 24 h : reste en attente, montant réservé.";
const ALERT_NOTE = "Signalé à l'administration financière : en attente depuis plus de 48 h.";

/** Montant et devise lus dans la réponse de vérification d'un fournisseur. */
function amountFromRaw(provider: OnlineProvider, raw: unknown): { amount: number | null; currency: string | null } {
    const r = (raw ?? {}) as Record<string, unknown>;
    const data = (r.data && typeof r.data === "object" ? r.data : r) as Record<string, unknown>;
    return { amount: parseProviderAmount(data.amount, provider), currency: parseProviderCurrency(data.currency) };
}

/**
 * Essais en ligne en attente depuis plus de 24 h : le fournisseur est
 * interrogé (lot 3b) :
 * - payé au bon montant → validé (chemin de confirmation, échéancier recalculé) ;
 * - échec ou expiration DÉFINITIFS chez le fournisseur (FAILED : FedaPay
 *   declined/canceled/expired, Paystack failed/abandoned, MoMo et
 *   Flutterwave failed) → annulé, la réservation est libérée ;
 * - en attente, injoignable, réponse illisible, sans identifiant fournisseur
 *   ou montant non conforme → RESTE PENDING : une absence d'information ne
 *   vaut jamais échec, le montant reste réservé et l'essai est réexaminé au
 *   passage suivant. Au-delà de 48 h, l'administration financière est
 *   alertée une fois ; aucune libération automatique.
 */
export async function reconcileStalePayments(verify: VerifyFn, now = new Date(), limit = 200): Promise<ReconcileReport> {
    const report: ReconcileReport = { examined: 0, confirmed: 0, cancelled: 0, stillPending: 0, alerted: 0, mismatched: 0, failed: 0 };
    const stale = await prisma.payment.findMany({
        where: { status: "PENDING", deletedAt: null, createdAt: { lt: new Date(now.getTime() - ONLINE_PAYMENT_TTL_MS) } },
        select: {
            id: true, reference: true, provider: true, providerTransactionId: true, amount: true, createdAt: true,
            student: { select: { schoolId: true } },
        },
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
                // Fournisseur injoignable : résultat inconnu, pas un échec
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
            // Montant ou devise non conformes : noté « à rapprocher », reste réservé
            if (result.outcome === "MISMATCH") report.mismatched++;
        } else if (verdict === "FAILED" && p.reference) {
            report.cancelled += await failOnlinePayment(p.reference, `réconciliation ${provider}`);
            continue;
        }

        // Résultat inconnu : reste PENDING et réservé ; notes ajoutées une seule fois
        report.stillPending++;
        const current = await prisma.payment.findUnique({ where: { id: p.id }, select: { notes: true, status: true } });
        if (!current || current.status !== "PENDING") continue;
        let notes = current.notes ?? null;
        if (!notes?.includes(UNCERTAIN_NOTE)) notes = appendNote(notes, UNCERTAIN_NOTE);
        const overdue = p.createdAt.getTime() < now.getTime() - PENDING_ALERT_MS;
        const alertNow = overdue && !notes.includes(ALERT_NOTE);
        if (alertNow) notes = appendNote(notes, ALERT_NOTE);
        if (notes !== current.notes) {
            const updated = await prisma.payment.updateMany({ where: { id: p.id, status: "PENDING" }, data: { notes } });
            if (updated.count === 0) continue;
        }
        if (alertNow) {
            await alertFinanceStaff(
                p.student.schoolId,
                "Paiement en ligne sans réponse définitive",
                `Un paiement en ligne de ${Math.round(Number(p.amount))} FCFA (référence ${p.reference ?? "inconnue"}) est en attente depuis plus de 48 h sans réponse définitive du fournisseur. Son montant reste réservé : vérifiez le relevé du fournisseur avant tout encaissement de ce montant.`,
            );
            report.alerted++;
        }
    }
    if (report.examined > 0) logger.info("Réconciliation des paiements en ligne", { ...report });
    return report;
}

/** Alerte aux comptables et à l'administration de l'école (notification de type paiement). */
async function alertFinanceStaff(schoolId: string, title: string, message: string): Promise<void> {
    const staff = await prisma.user.findMany({
        where: { schoolId, isActive: true, role: { in: ["ACCOUNTANT", "SCHOOL_ADMIN"] } },
        select: { id: true },
    });
    if (staff.length === 0) return;
    await createNotifications(
        staff.map(({ id }) => ({ userId: id, type: "PAYMENT" as const, title, message, link: "/dashboard/finance/reconciliation" })),
    );
}
