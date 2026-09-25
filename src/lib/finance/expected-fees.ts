import prisma from "@/lib/prisma";
import type { FinanceDateRange } from "@/lib/finance/helpers";

/**
 * Montant attendu des frais facturés SANS échéancier.
 *
 * Le tableau de bord finance ne comptait que les échéanciers (`PaymentPlan`) :
 * une école qui facture ses frais sans échéancier affichait 0 FCFA attendu et
 * 0 % de recouvrement alors que des millions étaient encaissés. Ici, ce qu'un
 * élève doit sur un frais sans échéancier découle du frais lui-même
 * (`Fee.amount`, restreint à un niveau par `Fee.classLevelCode`) moins ses
 * paiements validés — même règle que les avis de paiement (payment-notices.ts).
 */

const SETTLED_STATUSES = ["VERIFIED", "RECONCILED"] as const;

export type PlanlessExpected = {
  expected: number;
  pending: number;
  /** Solde échu (frais dont l'échéance est passée) par élève. */
  overdue: Map<string, { studentName: string; balance: number }>;
};

const EMPTY = (): PlanlessExpected => ({ expected: 0, pending: 0, overdue: new Map() });

export async function computePlanlessExpected(params: {
  schoolId: string;
  academicYearId?: string | null;
  periodRange?: FinanceDateRange | null;
  /** Couples `${feeId}:${studentId}` déjà couverts par un échéancier. */
  plannedKeys: Set<string>;
  /** Référence « échu » (défaut : maintenant). */
  now?: Date;
}): Promise<PlanlessExpected> {
  const { schoolId, academicYearId, periodRange, plannedKeys } = params;
  const now = params.now ?? new Date();

  const fees = await prisma.fee.findMany({
    where: {
      schoolId,
      isActive: true,
      deletedAt: null,
      ...(academicYearId ? { academicYearId } : {}),
      // Sur une période, un frais compte s'il y arrive à échéance (même règle
      // que les échéanciers sans versement dans la période).
      ...(periodRange
        ? { dueDate: { gte: periodRange.startDate ?? undefined, lte: periodRange.endDate ?? undefined } }
        : {}),
    },
    select: { id: true, amount: true, classLevelCode: true, academicYearId: true, dueDate: true },
  });
  if (fees.length === 0) return EMPTY();

  // Un frais sans année s'applique à l'année courante de l'établissement.
  let currentYearId: string | null = null;
  if (fees.some((f) => !f.academicYearId)) {
    const current = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    currentYearId = current?.id ?? null;
  }

  const yearIds = [
    ...new Set(fees.map((f) => f.academicYearId ?? currentYearId).filter((id): id is string => Boolean(id))),
  ];
  if (yearIds.length === 0) return EMPTY();

  const enrollments = await prisma.enrollment.findMany({
    where: {
      academicYearId: { in: yearIds },
      status: "ACTIVE",
      deletedAt: null,
      class: { schoolId, deletedAt: null },
      student: { deletedAt: null },
    },
    select: {
      studentId: true,
      academicYearId: true,
      class: { select: { classLevel: { select: { code: true } } } },
      student: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  // groupBy plutôt qu'un _count relationnel : payments est sous RLS.
  const settled = await prisma.payment.groupBy({
    by: ["feeId", "studentId"],
    where: {
      feeId: { in: fees.map((f) => f.id) },
      deletedAt: null,
      status: { in: [...SETTLED_STATUSES] },
    },
    _sum: { amount: true },
  });
  const paidBy = new Map<string, number>();
  for (const row of settled) {
    paidBy.set(`${row.feeId}:${row.studentId}`, Number(row._sum.amount ?? 0));
  }

  let expected = 0;
  let pending = 0;
  const overdue: PlanlessExpected["overdue"] = new Map();
  for (const fee of fees) {
    const yearId = fee.academicYearId ?? currentYearId;
    if (!yearId) continue;
    const due = Number(fee.amount);
    const isPastDue = fee.dueDate !== null && fee.dueDate <= now;
    const seen = new Set<string>();
    for (const enrollment of enrollments) {
      if (enrollment.academicYearId !== yearId) continue;
      if (fee.classLevelCode && enrollment.class.classLevel.code !== fee.classLevelCode) continue;
      // Un élève transféré en cours d'année a deux inscriptions : il ne doit qu'une fois.
      if (seen.has(enrollment.studentId)) continue;
      seen.add(enrollment.studentId);
      const key = `${fee.id}:${enrollment.studentId}`;
      if (plannedKeys.has(key)) continue;
      const remaining = Math.max(0, due - (paidBy.get(key) ?? 0));
      expected += due;
      pending += remaining;
      if (isPastDue && remaining > 0) {
        const { firstName, lastName } = enrollment.student.user;
        const current = overdue.get(enrollment.studentId) ?? {
          studentName: `${firstName} ${lastName}`,
          balance: 0,
        };
        current.balance += remaining;
        overdue.set(enrollment.studentId, current);
      }
    }
  }

  return { expected, pending, overdue };
}

/**
 * Recouvrement de l'année (accueil direction) : attendu = échéanciers + frais
 * sans échéancier, encaissé = paiements validés des frais de l'année.
 * `null` quand rien n'est attendu, pour ne pas afficher un taux inventé.
 */
export async function computeYearFeeRecovery(
  schoolId: string,
  academicYearId: string,
): Promise<{ expected: number; collected: number; rate: number } | null> {
  const feeScope = { schoolId, academicYearId };
  const [plans, collected] = await Promise.all([
    prisma.paymentPlan.findMany({
      where: { fee: feeScope, status: { not: "CANCELLED" } },
      select: { feeId: true, studentId: true, totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { fee: feeScope, deletedAt: null, status: { in: [...SETTLED_STATUSES] } },
      _sum: { amount: true },
    }),
  ]);
  const planless = await computePlanlessExpected({
    schoolId,
    academicYearId,
    plannedKeys: new Set(plans.map((plan) => `${plan.feeId}:${plan.studentId}`)),
  });
  const expected = plans.reduce((sum, plan) => sum + Number(plan.totalAmount), 0) + planless.expected;
  if (expected <= 0) return null;
  const collectedAmount = Number(collected._sum.amount ?? 0);
  return { expected, collected: collectedAmount, rate: Math.min(100, (collectedAmount / expected) * 100) };
}

export type StudentFeeDue = {
  studentId: string;
  feeId: string;
  feeName: string;
  /** Reste dû sur ce frais (montant du frais − paiements validés). */
  remaining: number;
  dueDate: Date | null;
};

/**
 * Ce que chaque élève doit encore sur les frais facturés SANS échéancier, pour
 * son inscription de l'année courante. Les frais sous échéancier restent lus
 * depuis leurs versements (`InstallmentPayment`) par les appelants.
 */
export async function computeStudentFeeDues(studentIds: string[]): Promise<StudentFeeDue[]> {
  if (studentIds.length === 0) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId: { in: studentIds },
      status: "ACTIVE",
      deletedAt: null,
      academicYear: { isCurrent: true },
      class: { deletedAt: null },
    },
    select: {
      studentId: true,
      academicYearId: true,
      class: { select: { schoolId: true, classLevel: { select: { code: true } } } },
    },
  });
  if (enrollments.length === 0) return [];

  const schoolIds = [...new Set(enrollments.map((e) => e.class.schoolId))];
  const yearIds = [...new Set(enrollments.map((e) => e.academicYearId))];
  const fees = await prisma.fee.findMany({
    where: {
      schoolId: { in: schoolIds },
      isActive: true,
      deletedAt: null,
      OR: [{ academicYearId: { in: yearIds } }, { academicYearId: null }],
    },
    select: {
      id: true,
      name: true,
      amount: true,
      classLevelCode: true,
      schoolId: true,
      academicYearId: true,
      dueDate: true,
    },
  });
  if (fees.length === 0) return [];

  const feeIds = fees.map((f) => f.id);
  const [plans, settled] = await Promise.all([
    prisma.paymentPlan.findMany({
      where: { studentId: { in: studentIds }, feeId: { in: feeIds }, status: { not: "CANCELLED" } },
      select: { feeId: true, studentId: true },
    }),
    prisma.payment.groupBy({
      by: ["feeId", "studentId"],
      where: {
        studentId: { in: studentIds },
        feeId: { in: feeIds },
        deletedAt: null,
        status: { in: [...SETTLED_STATUSES] },
      },
      _sum: { amount: true },
    }),
  ]);
  const planned = new Set(plans.map((plan) => `${plan.feeId}:${plan.studentId}`));
  const paidBy = new Map(settled.map((row) => [`${row.feeId}:${row.studentId}`, Number(row._sum.amount ?? 0)]));

  const dues: StudentFeeDue[] = [];
  const seen = new Set<string>();
  for (const enrollment of enrollments) {
    // Un élève transféré en cours d'année a deux inscriptions : il ne doit qu'une fois.
    if (seen.has(enrollment.studentId)) continue;
    seen.add(enrollment.studentId);
    for (const fee of fees) {
      if (fee.schoolId !== enrollment.class.schoolId) continue;
      if (fee.academicYearId && fee.academicYearId !== enrollment.academicYearId) continue;
      if (fee.classLevelCode && fee.classLevelCode !== enrollment.class.classLevel.code) continue;
      const key = `${fee.id}:${enrollment.studentId}`;
      if (planned.has(key)) continue;
      const remaining = Math.max(0, Number(fee.amount) - (paidBy.get(key) ?? 0));
      if (remaining <= 0) continue;
      dues.push({
        studentId: enrollment.studentId,
        feeId: fee.id,
        feeName: fee.name,
        remaining,
        dueDate: fee.dueDate,
      });
    }
  }
  return dues;
}
