import type { Prisma, PaymentStatus } from "@prisma/client";
import { CURRENT_PLAN_ORDER } from "@/lib/finance/helpers";
import { getFeeBalance, type FeeBalance } from "@/lib/finance/online-payments";
import { chronologicalCoverage } from "@/lib/finance/installment-coverage";
import { ONLINE_UNAVAILABLE_MESSAGE, resolveCollectingAccount } from "@/lib/payments/school-accounts";

/**
 * Situation financière d'UN enfant, vue par sa famille (parcours parent).
 *
 * Aucune règle de calcul n'est propre à ce module : chaque frais est lu par
 * `getFeeBalance` (source de vérité de l'initiation : échéancier en vigueur,
 * bourses déduites à sa création, sinon montant du frais ; payé = validé ;
 * réservé = essais en attente) et les échéances par `chronologicalCoverage`
 * (imputation chronologique de syncPaymentPlanLedger, lot 3c).
 *
 * Un enfant = une école : jamais de cumul entre enfants ni entre écoles.
 */
type Db = Prisma.TransactionClient;

const SETTLED_STATUSES: PaymentStatus[] = ["VERIFIED", "RECONCILED"];

/** Statut public d'un paiement, partagé avec /api/payments/status (S4). */
export type PublicPaymentStatus = "CONFIRMED" | "PENDING" | "FAILED" | "UNDER_REVIEW";

/** Notes posées par online-payments.ts sur un essai en attente qui demande un examen. */
const UNDER_REVIEW_MARKERS = /(incertain|inconnu|bloquée|refusée|à rapprocher|sans réponse définitive|signalé à l'administration)/i;

export function publicPaymentStatus(status: string, notes: string | null): PublicPaymentStatus {
    if (status === "VERIFIED" || status === "RECONCILED") return "CONFIRMED";
    if (status === "CANCELLED" || status === "EXPIRED") return "FAILED";
    // En attente mais à examiner → « en vérification », jamais « échoué » : résultat
    // inconnu, validation bloquée ou refusée, montant/devise non conformes (« À
    // rapprocher »), sans réponse après 24 h, signalé à l'administration
    if (notes && UNDER_REVIEW_MARKERS.test(notes)) return "UNDER_REVIEW";
    return "PENDING";
}

/** Inscription de l'année en cours, dans l'école de la fiche élève (lot 3f). */
async function currentEnrollment(db: Db, studentId: string, schoolId: string) {
    const enrollment = await db.enrollment.findFirst({
        where: { studentId, status: "ACTIVE", deletedAt: null, academicYear: { isCurrent: true }, class: { deletedAt: null } },
        orderBy: { enrolledAt: "desc" },
        select: {
            academicYearId: true,
            academicYear: { select: { name: true } },
            class: { select: { name: true, schoolId: true, classLevel: { select: { code: true, name: true } } } },
        },
    });
    // Une inscription dans une autre école que la fiche n'ouvre aucun frais
    return enrollment && enrollment.class.schoolId === schoolId ? enrollment : null;
}

/**
 * Frais qui concernent l'enfant : ceux de son école, actifs, de son année en
 * cours (ou sans année), de son niveau (ou tous niveaux) — même sélection que
 * l'encaissement au guichet (computeStudentBalances). Un frais FACULTATIF n'est
 * retenu que s'il est souscrit : échéancier non annulé ou paiement validé ou en attente
 * (même règle que computeStudentFeeDues : facultatif non souscrit = non dû).
 */
export async function applicableFamilyFees(db: Db, studentId: string) {
    const student = await db.studentProfile.findUnique({ where: { id: studentId }, select: { schoolId: true } });
    if (!student) return { enrollment: null, fees: [] };
    const enrollment = await currentEnrollment(db, studentId, student.schoolId);
    if (!enrollment) return { enrollment: null, fees: [] };

    const fees = await db.fee.findMany({
        where: {
            schoolId: student.schoolId,
            isActive: true,
            deletedAt: null,
            OR: [{ academicYearId: enrollment.academicYearId }, { academicYearId: null }],
            AND: [{ OR: [{ classLevelCode: null }, { classLevelCode: enrollment.class.classLevel.code }] }],
        },
        select: { id: true, name: true, description: true, amount: true, dueDate: true, isRequired: true },
        orderBy: [{ dueDate: "asc" }, { name: "asc" }],
    });
    const optionalIds = fees.filter((fee) => fee.isRequired === false).map((fee) => fee.id);
    if (optionalIds.length === 0) return { enrollment, fees };

    const [plans, payments] = await Promise.all([
        db.paymentPlan.findMany({ where: { studentId, feeId: { in: optionalIds }, status: { not: "CANCELLED" } }, select: { feeId: true } }),
        // Un paiement annulé ou jamais transmis ne vaut pas souscription
        db.payment.findMany({
            where: { studentId, feeId: { in: optionalIds }, deletedAt: null, status: { in: [...SETTLED_STATUSES, "PENDING"] } },
            select: { feeId: true },
            distinct: ["feeId"],
        }),
    ]);
    const subscribed = new Set([...plans, ...payments].map((row) => row.feeId));
    return { enrollment, fees: fees.filter((fee) => fee.isRequired !== false || subscribed.has(fee.id)) };
}

export async function isFeeApplicableToStudent(db: Db, studentId: string, feeId: string): Promise<boolean> {
    const { fees } = await applicableFamilyFees(db, studentId);
    return fees.some((fee) => fee.id === feeId);
}

/** Échéances de l'échéancier en vigueur (le plus récent non annulé, lot 3d). */
export async function currentPlanInstallments(db: Db, studentId: string, feeId: string) {
    return db.paymentPlan.findFirst({
        where: { studentId, feeId, status: { not: "CANCELLED" } },
        orderBy: CURRENT_PLAN_ORDER,
        select: {
            id: true,
            totalAmount: true,
            installmentPayments: { select: { id: true, amount: true, dueDate: true, status: true } },
        },
    });
}

export type PaymentIntent = "AMOUNT" | "NEXT_INSTALLMENT" | "FULL_BALANCE";

export type IntentResult =
    | { amount: number; installmentId?: string }
    | { error: "PAYMENT_IN_PROGRESS" | "NOTHING_DUE" | "NO_INSTALLMENT_DUE" };

/**
 * Montant d'une intention de paiement, recalculé par le SERVEUR au moment de
 * l'essai (sous le verrou élève/frais) : le navigateur n'indique que
 * l'intention, jamais le montant.
 *
 * - FULL_BALANCE : tout le disponible (reste − essais en attente) ;
 * - NEXT_INSTALLMENT : le reste de la plus ancienne échéance non soldée
 *   (imputation chronologique), plafonné au disponible.
 *
 * Tant qu'un essai en ligne est en attente, ces deux intentions sont refusées :
 * l'échéance visée ou le solde pourraient déjà être couverts par lui (double
 * clic, deux onglets, deux appareils). Le paiement d'un montant libre reste
 * possible dans la limite du disponible.
 */
export function intentAmount(
    mode: Exclude<PaymentIntent, "AMOUNT">,
    balance: FeeBalance,
    installments: Array<{ id: string; amount: unknown; dueDate: Date; status: string }> | null,
): IntentResult {
    if (balance.reserved > 0) return { error: "PAYMENT_IN_PROGRESS" };
    if (balance.available <= 0) return { error: "NOTHING_DUE" };
    if (mode === "FULL_BALANCE") return { amount: balance.available };
    const next = chronologicalCoverage(
        (installments ?? []).map((i) => ({ ...i, amount: Math.round(Number(i.amount)) })),
        balance.settled,
    ).find((row) => row.outstanding > 0);
    if (!next) return { error: "NO_INSTALLMENT_DUE" };
    return { amount: Math.min(next.outstanding, balance.available), installmentId: next.installment.id };
}

export type FamilyChildSummary = {
    studentId: string;
    firstName: string;
    lastName: string;
    schoolId: string;
    schoolName: string;
    className: string | null;
    academicYearName: string | null;
    remaining: number;
    reserved: number;
};

/** Enfants de la famille, chacun avec son école et son propre reste à payer. */
export async function listFamilyChildren(db: Db, studentIds: string[]): Promise<FamilyChildSummary[]> {
    const students = await db.studentProfile.findMany({
        where: { id: { in: studentIds }, deletedAt: null },
        select: {
            id: true,
            schoolId: true,
            user: { select: { firstName: true, lastName: true } },
            school: { select: { name: true } },
        },
        orderBy: [{ user: { firstName: "asc" } }, { id: "asc" }],
    });
    const out: FamilyChildSummary[] = [];
    for (const student of students) {
        const { enrollment, fees } = await applicableFamilyFees(db, student.id);
        let remaining = 0;
        let reserved = 0;
        for (const fee of fees) {
            const balance = await getFeeBalance(db, student.id, fee.id);
            if (!balance) continue;
            remaining += balance.remaining;
            reserved += balance.reserved;
        }
        out.push({
            studentId: student.id,
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            schoolId: student.schoolId,
            schoolName: student.school.name,
            className: enrollment ? `${enrollment.class.classLevel.name} — ${enrollment.class.name}` : null,
            academicYearName: enrollment?.academicYear.name ?? null,
            remaining,
            reserved,
        });
    }
    return out;
}

export type FamilyFeeView = FeeBalance & {
    feeId: string;
    name: string;
    description: string | null;
    dueDate: Date | null;
    isRequired: boolean;
    installments: Array<{
        id: string;
        amount: number;
        dueDate: Date;
        status: string;
        covered: number;
        outstanding: number;
        /** Seule la plus ancienne échéance non soldée est payable (lot 3c). */
        payable: boolean;
    }> | null;
    options: {
        /** Prochaine échéance : montant que le serveur demandera, sauf évolution entre-temps. */
        nextInstallment: { installmentId: string; dueDate: Date; amount: number } | null;
        fullBalance: number | null;
        /** Plafond du montant libre. */
        maxAmount: number;
        /** Un essai en ligne attend sa confirmation : seules les sommes libres restent possibles. */
        blockedByPending: boolean;
    };
};

export type FamilyPaymentView = {
    id: string;
    reference: string | null;
    feeName: string;
    amount: number;
    status: PublicPaymentStatus;
    method: string;
    online: boolean;
    date: Date;
    paidAt: Date | null;
    receiptAvailable: boolean;
    /** Remboursement (montant négatif) : sans reçu de paiement. */
    isRefund: boolean;
};

export type ChildFinance = {
    child: FamilyChildSummary & { matricule: string };
    totals: FeeBalance;
    fees: FamilyFeeView[];
    payments: FamilyPaymentView[];
    online: { available: boolean; message: string };
};

/** Situation complète d'un enfant (lien famille vérifié par l'appelant). */
export async function getChildFinance(db: Db, studentId: string): Promise<ChildFinance | null> {
    const student = await db.studentProfile.findUnique({
        where: { id: studentId },
        select: {
            id: true,
            matricule: true,
            schoolId: true,
            deletedAt: true,
            user: { select: { firstName: true, lastName: true } },
            school: { select: { name: true } },
        },
    });
    if (!student || student.deletedAt) return null;

    const { enrollment, fees } = await applicableFamilyFees(db, studentId);
    const feeViews: FamilyFeeView[] = [];
    const totals: FeeBalance = { billed: 0, settled: 0, reserved: 0, remaining: 0, available: 0 };
    for (const fee of fees) {
        const balance = await getFeeBalance(db, studentId, fee.id);
        if (!balance) continue;
        const plan = await currentPlanInstallments(db, studentId, fee.id);
        const coverage = plan
            ? chronologicalCoverage(
                  plan.installmentPayments.map((i) => ({ ...i, amount: Math.round(Number(i.amount)) })),
                  balance.settled,
              )
            : null;
        const firstOpen = coverage?.find((row) => row.outstanding > 0)?.installment.id ?? null;
        const blockedByPending = balance.reserved > 0;
        const next = plan ? intentAmount("NEXT_INSTALLMENT", balance, plan.installmentPayments) : null;
        const nextInstallment =
            next && "amount" in next && next.installmentId
                ? plan!.installmentPayments.find((i) => i.id === next.installmentId) ?? null
                : null;
        feeViews.push({
            feeId: fee.id,
            name: fee.name,
            description: fee.description,
            dueDate: fee.dueDate,
            isRequired: fee.isRequired,
            ...balance,
            installments: coverage
                ? coverage.map((row) => ({
                      id: row.installment.id,
                      amount: row.installment.amount,
                      dueDate: row.installment.dueDate,
                      status: row.installment.status,
                      covered: row.covered,
                      outstanding: row.outstanding,
                      payable: row.installment.id === firstOpen && !blockedByPending && balance.available > 0,
                  }))
                : null,
            options: {
                nextInstallment:
                    nextInstallment && next && "amount" in next
                        ? { installmentId: nextInstallment.id, dueDate: nextInstallment.dueDate, amount: next.amount }
                        : null,
                fullBalance: !blockedByPending && balance.available > 0 ? balance.available : null,
                maxAmount: balance.available,
                blockedByPending,
            },
        });
        totals.billed += balance.billed;
        totals.settled += balance.settled;
        totals.reserved += balance.reserved;
        totals.remaining += balance.remaining;
        totals.available += balance.available;
    }

    const payments = await db.payment.findMany({
        where: { studentId, deletedAt: null },
        select: {
            id: true,
            reference: true,
            amount: true,
            status: true,
            method: true,
            provider: true,
            notes: true,
            paidAt: true,
            createdAt: true,
            refundOfId: true,
            fee: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
    });

    const account = await resolveCollectingAccount(db, student.schoolId);
    return {
        child: {
            studentId: student.id,
            matricule: student.matricule,
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            schoolId: student.schoolId,
            schoolName: student.school.name,
            className: enrollment ? `${enrollment.class.classLevel.name} — ${enrollment.class.name}` : null,
            academicYearName: enrollment?.academicYear.name ?? null,
            remaining: totals.remaining,
            reserved: totals.reserved,
        },
        totals,
        fees: feeViews,
        // Notes internes et identifiants fournisseur jamais renvoyés
        payments: payments.map((p) => {
            const status = publicPaymentStatus(p.status, p.notes);
            return {
                id: p.id,
                reference: p.reference,
                feeName: p.fee.name,
                amount: Math.round(Number(p.amount)),
                status,
                method: p.method,
                online: p.provider !== null,
                date: p.createdAt,
                paidAt: SETTLED_STATUSES.includes(p.status) ? p.paidAt : null,
                receiptAvailable: status === "CONFIRMED" && !p.refundOfId,
                isRefund: p.refundOfId !== null,
            };
        }),
        online: account.ok
            ? { available: true, message: "Paiement en ligne disponible (Mobile Money via FedaPay, sur le compte de l'établissement)." }
            : { available: false, message: ONLINE_UNAVAILABLE_MESSAGE },
    };
}
