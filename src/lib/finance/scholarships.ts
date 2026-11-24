/**
 * Bourses et réductions : SOURCE UNIQUE du montant dû après bourse
 * (audit FIN-01 du 2026-11-24, docs/EDUPILOT_FINANCIAL_RELIABILITY.md §3).
 *
 * Avant : les bourses n'étaient lues qu'à la création d'un échéancier. Sans
 * échéancier, elles étaient ignorées ; accordées ou retirées ensuite, rien
 * n'était recalculé ; un montant fixe était déduit de CHAQUE échéancier.
 *
 * Règles :
 * 1. Frais visés — décision de l'école, bourse par bourse : la liste `feeIds`
 *    de la bourse ; vide = tous les frais OBLIGATOIRES de l'élève.
 * 2. Une bourse est due pour l'ANNÉE : elle s'applique au montant annuel entier
 *    du frais si sa période [début ; fin] recoupe l'année scolaire de
 *    l'inscription en cours, quelle que soit la date d'octroi (pas de prorata).
 *    Une bourse inactive (`isActive = false`) ne s'applique plus.
 * 3. Pourcentage : arrondi au franc, frais par frais. Montant fixe : UNE
 *    enveloppe répartie sur les frais visés (échéance la plus proche d'abord),
 *    jamais déduite deux fois. La remise totale d'un frais ne dépasse jamais
 *    son montant.
 * 4. Échéancier existant : son total suit la bourse. Une baisse est retirée des
 *    échéances en partant de la DERNIÈRE (les versements s'imputent de la plus
 *    ancienne à la plus récente : une échéance déjà couverte n'est touchée
 *    qu'en dernier recours) ; une échéance ramenée à 0 est annulée. Une hausse
 *    (bourse retirée) s'ajoute à la dernière échéance.
 * 5. Si la famille a déjà versé plus que le nouveau dû : TROP-PERÇU À
 *    REMBOURSER. Il est signalé à la direction et à la comptabilité, jamais
 *    effacé ; le remboursement lui-même passe par l'extourne tracée
 *    (`refunds.ts`) quand l'argent est rendu.
 */
import type { Prisma } from "@prisma/client";
import { lockStudentFee } from "@/lib/finance/online-payments";
import { CURRENT_PLAN_ORDER, syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { roundFcfa } from "@/lib/finance/money";

type Db = Prisma.TransactionClient;
type Num = number | string | { toString(): string };

export interface ScholarshipRule {
    id: string;
    amount: Num;
    percentage: number | null;
    isActive: boolean;
    startDate: Date;
    endDate: Date | null;
    feeIds: string[];
}

export interface DiscountableFee {
    id: string;
    amount: Num;
    isRequired: boolean;
    dueDate: Date | null;
}

export interface YearWindow {
    startDate: Date;
    endDate: Date;
}

/** Règle 2 : la bourse est active et sa période recoupe l'année scolaire. */
export function scholarshipCoversYear(rule: ScholarshipRule, year: YearWindow): boolean {
    if (!rule.isActive) return false;
    if (rule.startDate > year.endDate) return false;
    return rule.endDate === null || rule.endDate >= year.startDate;
}

function byDueDate(a: DiscountableFee, b: DiscountableFee): number {
    const da = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const db = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    return da - db || a.id.localeCompare(b.id);
}

/**
 * Remise (FCFA entiers) par frais pour UN élève : règles 1 à 3. `fees` doit
 * être l'ensemble des frais de l'élève pour l'année, pour que l'enveloppe d'un
 * montant fixe soit répartie de la même façon partout.
 */
export function computeScholarshipDiscounts(
    fees: readonly DiscountableFee[],
    rules: readonly ScholarshipRule[],
    year: YearWindow,
): Map<string, number> {
    const amountOf = new Map(fees.map((fee) => [fee.id, roundFcfa(Number(fee.amount))]));
    const discount = new Map<string, number>(fees.map((fee) => [fee.id, 0]));
    const room = (feeId: string) => (amountOf.get(feeId) ?? 0) - (discount.get(feeId) ?? 0);
    const active = rules.filter((rule) => scholarshipCoversYear(rule, year));
    const targetsOf = (rule: ScholarshipRule) =>
        [...fees]
            .filter((fee) => (rule.feeIds.length > 0 ? rule.feeIds.includes(fee.id) : fee.isRequired))
            .sort(byDueDate);

    // Pourcentages d'abord (proportionnels au montant du frais), puis enveloppes fixes
    for (const rule of active) {
        if (!rule.percentage) continue;
        for (const fee of targetsOf(rule)) {
            const part = roundFcfa(((amountOf.get(fee.id) ?? 0) * rule.percentage) / 100);
            discount.set(fee.id, (discount.get(fee.id) ?? 0) + Math.min(part, room(fee.id)));
        }
    }
    for (const rule of active) {
        if (rule.percentage) continue;
        let envelope = roundFcfa(Number(rule.amount));
        for (const fee of targetsOf(rule)) {
            if (envelope <= 0) break;
            const taken = Math.min(envelope, room(fee.id));
            discount.set(fee.id, (discount.get(fee.id) ?? 0) + taken);
            envelope -= taken;
        }
    }
    return discount;
}

export interface InstallmentLine {
    id: string;
    amount: Num;
    dueDate: Date;
    status: string;
}

/**
 * Règle 4 : nouveaux montants d'échéances pour atteindre `newTotal`. Retourne
 * uniquement les échéances modifiées ; `cancel` = ramenée à 0.
 */
export function redistributeInstallments(
    installments: readonly InstallmentLine[],
    newTotal: number,
): Array<{ id: string; amount: number; cancel: boolean }> {
    const live = installments
        .filter((line) => line.status !== "CANCELLED")
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime() || a.id.localeCompare(b.id));
    if (live.length === 0) return [];
    const before = live.map((line) => roundFcfa(Number(line.amount)));
    const after = [...before];
    let delta = roundFcfa(newTotal) - before.reduce((sum, value) => sum + value, 0);
    if (delta > 0) {
        after[after.length - 1] += delta;
    } else {
        for (let i = after.length - 1; i >= 0 && delta < 0; i--) {
            const taken = Math.min(after[i], -delta);
            after[i] -= taken;
            delta += taken;
        }
    }
    return live
        .map((line, index) => ({ id: line.id, amount: after[index], cancel: after[index] === 0, changed: after[index] !== before[index] }))
        .filter((line) => line.changed)
        .map(({ id, amount, cancel }) => ({ id, amount, cancel }));
}

/** Année et frais de l'inscription en cours : même sélection que `computeStudentBalances`. */
async function currentYearContext(db: Db, studentId: string) {
    const enrollment = await db.enrollment.findFirst({
        where: { studentId, status: "ACTIVE", deletedAt: null, academicYear: { isCurrent: true }, class: { deletedAt: null } },
        orderBy: { enrolledAt: "desc" },
        select: {
            academicYear: { select: { id: true, startDate: true, endDate: true } },
            class: { select: { schoolId: true, classLevel: { select: { code: true } } } },
        },
    });
    if (!enrollment) return null;
    const fees = await db.fee.findMany({
        where: {
            schoolId: enrollment.class.schoolId,
            isActive: true,
            deletedAt: null,
            OR: [{ academicYearId: enrollment.academicYear.id }, { academicYearId: null }],
            AND: [{ OR: [{ classLevelCode: null }, { classLevelCode: enrollment.class.classLevel.code }] }],
        },
        select: { id: true, amount: true, isRequired: true, dueDate: true },
    });
    return { year: enrollment.academicYear, fees };
}

/** Remises par frais d'un élève (Map vide s'il n'a aucune bourse active). */
export async function loadScholarshipDiscounts(db: Db, studentId: string): Promise<Map<string, number>> {
    const rules = await db.scholarship.findMany({
        where: { studentId, isActive: true },
        select: { id: true, amount: true, percentage: true, isActive: true, startDate: true, endDate: true, feeIds: true },
    });
    if (rules.length === 0) return new Map();
    const context = await currentYearContext(db, studentId);
    if (!context) return new Map();
    return computeScholarshipDiscounts(context.fees, rules, context.year);
}

/** Version groupée (statistiques, avis) : seuls les élèves boursiers coûtent des requêtes. */
export async function loadScholarshipDiscountsFor(
    db: Db,
    studentIds: readonly string[],
): Promise<Map<string, Map<string, number>>> {
    const result = new Map<string, Map<string, number>>();
    if (studentIds.length === 0) return result;
    const holders = await db.scholarship.findMany({
        where: { studentId: { in: [...studentIds] }, isActive: true },
        select: { studentId: true },
        distinct: ["studentId"],
    });
    for (const { studentId } of holders) {
        result.set(studentId, await loadScholarshipDiscounts(db, studentId));
    }
    return result;
}

export interface PlanAdjustment {
    planId: string;
    feeId: string;
    previousTotal: number;
    newTotal: number;
    /** Règle 5 : versé net au-delà du nouveau dû (0 sinon). */
    overpaid: number;
}

/**
 * Règles 4 et 5 : aligne chaque échéancier en vigueur de l'élève sur le dû
 * après bourses. À appeler dans la transaction qui crée, modifie ou supprime
 * une bourse ; verrou élève/frais pris pour chaque échéancier modifié.
 */
export async function syncScholarshipPlans(tx: Db, studentId: string): Promise<PlanAdjustment[]> {
    const plans = await tx.paymentPlan.findMany({
        where: { studentId, status: { not: "CANCELLED" } },
        orderBy: CURRENT_PLAN_ORDER,
        select: { id: true, feeId: true, totalAmount: true, fee: { select: { amount: true } } },
    });
    if (plans.length === 0) return [];
    const discounts = await loadScholarshipDiscounts(tx, studentId);
    const seenFees = new Set<string>();
    const adjustments: PlanAdjustment[] = [];

    for (const plan of plans) {
        // Un seul échéancier en vigueur par frais (le plus récent, lot 3d)
        if (seenFees.has(plan.feeId)) continue;
        seenFees.add(plan.feeId);
        const newTotal = Math.max(0, roundFcfa(Number(plan.fee.amount)) - (discounts.get(plan.feeId) ?? 0));
        const previousTotal = roundFcfa(Number(plan.totalAmount));
        if (newTotal === previousTotal) continue;

        await lockStudentFee(tx, studentId, plan.feeId);
        const installments = await tx.installmentPayment.findMany({
            where: { paymentPlanId: plan.id },
            select: { id: true, amount: true, dueDate: true, status: true },
        });
        for (const change of redistributeInstallments(installments, newTotal)) {
            await tx.installmentPayment.update({
                where: { id: change.id },
                data: change.cancel ? { amount: 0, status: "CANCELLED" } : { amount: change.amount },
            });
        }
        await tx.paymentPlan.update({ where: { id: plan.id }, data: { totalAmount: newTotal } });
        await syncPaymentPlanLedger(tx, studentId, plan.feeId);

        const settled = await tx.payment.aggregate({
            where: { studentId, feeId: plan.feeId, deletedAt: null, status: { in: ["VERIFIED", "RECONCILED"] } },
            _sum: { amount: true },
        });
        const overpaid = Math.max(0, roundFcfa(Number(settled._sum.amount ?? 0)) - newTotal);
        adjustments.push({ planId: plan.id, feeId: plan.feeId, previousTotal, newTotal, overpaid });
    }
    return adjustments;
}

/** Message de la règle 5 (trop-perçu), adressé à la direction et à la comptabilité. */
export function overpaymentMessage(studentName: string, adjustment: PlanAdjustment): string {
    const f = (value: number) => `${value.toLocaleString("fr-FR")} F`;
    return (
        `Bourse modifiée pour ${studentName} : le dû passe de ${f(adjustment.previousTotal)} à ${f(adjustment.newTotal)}, ` +
        `mais la famille a déjà versé ${f(adjustment.newTotal + adjustment.overpaid)}. ` +
        `Trop-perçu à rembourser : ${f(adjustment.overpaid)} (Finance › paiement › Rembourser).`
    );
}

/** Champ `feeIds` : uniquement des frais (non supprimés) de l'école de l'élève. */
export async function invalidScholarshipFeeIds(db: Db, schoolId: string, feeIds: readonly string[]): Promise<boolean> {
    const unique = [...new Set(feeIds)];
    if (unique.length === 0) return false;
    const found = await db.fee.count({ where: { id: { in: unique }, schoolId, deletedAt: null } });
    return found !== unique.length;
}
