import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    academicYear: { findFirst: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import {
  isWithinDateRange,
  getEffectivePaymentDate,
  buildPaymentDateWhere,
  isUnpaidInstallment,
  summarizePaymentPlans,
  resolveFinanceDateRange,
  resolvePreviousFinanceDateRange,
  syncPaymentPlanLedger,
} from "@/lib/finance/helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isWithinDateRange / getEffectivePaymentDate / isUnpaidInstallment", () => {
  it("borne correctement les dates", () => {
    const range = { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") };
    expect(isWithinDateRange(new Date("2026-01-15"), range)).toBe(true);
    expect(isWithinDateRange(new Date("2025-12-31"), range)).toBe(false);
    expect(isWithinDateRange(new Date("2026-02-01"), range)).toBe(false);
    expect(isWithinDateRange(new Date("2026-02-01"), null)).toBe(true);
  });

  it("privilégie paidAt et retombe sur createdAt", () => {
    const paidAt = new Date("2026-01-10");
    const createdAt = new Date("2026-01-05");
    expect(getEffectivePaymentDate({ amount: 1, paidAt, createdAt })).toBe(paidAt);
    expect(getEffectivePaymentDate({ amount: 1, paidAt: null, createdAt })).toBe(createdAt);
  });

  it("considère PAID et CANCELLED comme soldées", () => {
    expect(isUnpaidInstallment("PENDING")).toBe(true);
    expect(isUnpaidInstallment("OVERDUE")).toBe(true);
    expect(isUnpaidInstallment("PAID")).toBe(false);
    expect(isUnpaidInstallment("CANCELLED")).toBe(false);
  });
});

describe("buildPaymentDateWhere", () => {
  it("retourne un filtre vide sans plage", () => {
    expect(buildPaymentDateWhere()).toEqual({});
    expect(buildPaymentDateWhere(null)).toEqual({});
  });

  it("couvre paidAt OU createdAt (paiements non encore datés)", () => {
    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-01-31");
    expect(buildPaymentDateWhere({ startDate, endDate })).toEqual({
      OR: [
        { paidAt: { gte: startDate, lte: endDate } },
        { paidAt: null, createdAt: { gte: startDate, lte: endDate } },
      ],
    });
  });
});

describe("summarizePaymentPlans", () => {
  const plan = (overrides: Record<string, unknown> = {}) => ({
    totalAmount: 100000,
    paidAmount: 40000,
    fee: { dueDate: new Date("2026-01-15") },
    installmentPayments: [] as Array<{
      id: string;
      amount: number;
      dueDate: Date;
      status: string;
    }>,
    ...overrides,
  });

  it("sans plage : attendu = total, en attente = total - payé", () => {
    const { totalExpected, totalPending } = summarizePaymentPlans([plan()]);
    expect(totalExpected).toBe(100000);
    expect(totalPending).toBe(60000);
  });

  it("avec plage : seules les échéances de la plage comptent", () => {
    const range = { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") };
    const { totalExpected, totalPending } = summarizePaymentPlans(
      [
        plan({
          installmentPayments: [
            { id: "i1", amount: 25000, dueDate: new Date("2026-01-10"), status: "PAID" },
            { id: "i2", amount: 25000, dueDate: new Date("2026-01-20"), status: "PENDING" },
            { id: "i3", amount: 25000, dueDate: new Date("2026-02-10"), status: "PENDING" },
          ],
        }),
      ],
      range
    );
    // i1 + i2 dans la plage ; seule i2 reste due
    expect(totalExpected).toBe(50000);
    expect(totalPending).toBe(25000);
  });

  it("avec plage et sans échéancier : retombe sur la dueDate du frais", () => {
    const range = { startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") };
    const inRange = summarizePaymentPlans([plan()], range);
    expect(inRange.totalExpected).toBe(100000);

    const outOfRange = summarizePaymentPlans(
      [plan({ fee: { dueDate: new Date("2026-03-01") } })],
      range
    );
    expect(outOfRange.totalExpected).toBe(0);
    expect(outOfRange.totalPending).toBe(0);
  });
});

describe("resolveFinanceDateRange", () => {
  it("priorise les dates explicites", async () => {
    const range = await resolveFinanceDateRange("school1", "month", "2026-01-01", "2026-01-31");
    expect(range.startDate).toEqual(new Date("2026-01-01"));
    expect(range.endDate).toEqual(new Date("2026-01-31"));
  });

  it("calcule le mois courant", async () => {
    const range = await resolveFinanceDateRange("school1", "month");
    const now = new Date();
    expect(range.startDate).toEqual(new Date(now.getFullYear(), now.getMonth(), 1));
    expect(range.endDate?.getMonth()).toBe(now.getMonth());
  });

  it("résout l'année académique courante depuis la DB", async () => {
    const startDate = new Date("2025-09-01");
    const endDate = new Date("2026-06-30");
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ startDate, endDate } as any);

    const range = await resolveFinanceDateRange("school1", "academic");

    expect(range).toEqual({ startDate, endDate });
    expect(vi.mocked(prisma.academicYear.findFirst).mock.calls[0][0]).toMatchObject({
      where: { schoolId: "school1", isCurrent: true },
    });
  });

  it("retourne une plage vide sans période", async () => {
    expect(await resolveFinanceDateRange("school1")).toEqual({});
  });
});

describe("resolvePreviousFinanceDateRange", () => {
  it("retourne le mois précédent", async () => {
    const current = {
      startDate: new Date(2026, 5, 1),
      endDate: new Date(2026, 5, 30, 23, 59, 59, 999),
    };
    const previous = await resolvePreviousFinanceDateRange("school1", "month", current);
    expect(previous.startDate).toEqual(new Date(2026, 4, 1));
    expect(previous.endDate?.getMonth()).toBe(4);
  });

  it("décale d'une durée équivalente pour une plage custom", async () => {
    const current = {
      startDate: new Date("2026-01-11T00:00:00Z"),
      endDate: new Date("2026-01-20T23:59:59Z"),
    };
    const previous = await resolvePreviousFinanceDateRange("school1", null, current);
    expect(previous.endDate!.getTime()).toBe(current.startDate.getTime() - 1);
    expect(previous.endDate!.getTime() - previous.startDate!.getTime()).toBe(
      current.endDate.getTime() - current.startDate.getTime()
    );
  });

  it("retourne vide si la plage courante est incomplète", async () => {
    expect(await resolvePreviousFinanceDateRange("school1", "month", {})).toEqual({});
  });
});

describe("syncPaymentPlanLedger — moteur d'allocation paiements → échéances", () => {
  function makeDb(options: {
    plan: Record<string, unknown> | null;
    payments?: Array<{ amount: number; paidAt: Date | null; createdAt: Date }>;
    refreshedInstallments?: Array<Record<string, unknown>>;
  }) {
    return {
      paymentPlan: {
        findFirst: vi.fn().mockResolvedValue(options.plan),
        update: vi.fn().mockImplementation(async (args: any) => ({ id: "plan1", ...args.data })),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue(options.payments ?? []),
      },
      installmentPayment: {
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue(options.refreshedInstallments ?? []),
      },
       
    } as any;
  }

  const pastDue = new Date(Date.now() - 10 * 24 * 3600 * 1000);
  const futureDue = new Date(Date.now() + 10 * 24 * 3600 * 1000);

  it("retourne null sans plan actif", async () => {
    const db = makeDb({ plan: null });
    expect(await syncPaymentPlanLedger(db, "student1", "fee1")).toBeNull();
    expect(db.payment.findMany).not.toHaveBeenCalled();
  });

  it("alloue les paiements dans l'ordre chronologique et marque PAID/OVERDUE/PENDING", async () => {
    const installments = [
      { id: "i1", amount: 30000, dueDate: pastDue, status: "PENDING" },
      { id: "i2", amount: 30000, dueDate: pastDue, status: "PENDING" },
      { id: "i3", amount: 30000, dueDate: futureDue, status: "PENDING" },
    ];
    const paidAt = new Date("2026-01-10");
    const db = makeDb({
      plan: {
        id: "plan1",
        totalAmount: 90000,
        paidAmount: 0,
        fee: { dueDate: futureDue },
        installmentPayments: installments,
      },
      // 45 000 payés : i1 couverte, i2 à moitié → OVERDUE, i3 PENDING
      payments: [{ amount: 45000, paidAt, createdAt: paidAt }],
      refreshedInstallments: [
        { id: "i1", amount: 30000, dueDate: pastDue, paidAt, status: "PAID" },
        { id: "i2", amount: 30000, dueDate: pastDue, paidAt: null, status: "OVERDUE" },
        { id: "i3", amount: 30000, dueDate: futureDue, paidAt: null, status: "PENDING" },
      ],
    });

    const result = await syncPaymentPlanLedger(db, "student1", "fee1");

    const updates = db.installmentPayment.update.mock.calls.map((call: any) => ({
      id: call[0].where.id,
      ...call[0].data,
    }));
    expect(updates).toEqual([
      { id: "i1", status: "PAID", paidAt },
      { id: "i2", status: "OVERDUE", paidAt: null },
      { id: "i3", status: "PENDING", paidAt: null },
    ]);

    // Une échéance en retard → plan OVERDUE, cumul = 45 000
    expect(db.paymentPlan.update.mock.calls[0][0].data).toMatchObject({
      paidAmount: 45000,
      status: "OVERDUE",
    });
    expect(result).not.toBeNull();
  });

  it("ignore les échéances CANCELLED et solde le plan quand tout est payé", async () => {
    const paidAt = new Date("2026-01-10");
    const db = makeDb({
      plan: {
        id: "plan1",
        totalAmount: 60000,
        paidAmount: 0,
        fee: { dueDate: null },
        installmentPayments: [
          { id: "i1", amount: 30000, dueDate: pastDue, status: "CANCELLED" },
          { id: "i2", amount: 30000, dueDate: pastDue, status: "PENDING" },
          { id: "i3", amount: 30000, dueDate: futureDue, status: "PENDING" },
        ],
      },
      payments: [{ amount: 60000, paidAt, createdAt: paidAt }],
      refreshedInstallments: [
        { id: "i1", amount: 30000, dueDate: pastDue, paidAt: null, status: "CANCELLED" },
        { id: "i2", amount: 30000, dueDate: pastDue, paidAt, status: "PAID" },
        { id: "i3", amount: 30000, dueDate: futureDue, paidAt, status: "PAID" },
      ],
    });

    await syncPaymentPlanLedger(db, "student1", "fee1");

    // L'échéance annulée n'est jamais mise à jour
    const updatedIds = db.installmentPayment.update.mock.calls.map(
      (call: any) => call[0].where.id
    );
    expect(updatedIds).toEqual(["i2", "i3"]);

    expect(db.paymentPlan.update.mock.calls[0][0].data).toMatchObject({
      paidAmount: 60000,
      status: "COMPLETED",
    });
  });

  it("répartit un même paiement sur plusieurs échéances (allocation partielle)", async () => {
    const paidAt = new Date("2026-01-10");
    const db = makeDb({
      plan: {
        id: "plan1",
        totalAmount: 60000,
        paidAmount: 0,
        fee: { dueDate: futureDue },
        installmentPayments: [
          { id: "i1", amount: 20000, dueDate: futureDue, status: "PENDING" },
          { id: "i2", amount: 20000, dueDate: futureDue, status: "PENDING" },
          { id: "i3", amount: 20000, dueDate: futureDue, status: "PENDING" },
        ],
      },
      // 50 000 : i1 et i2 couvertes, i3 partielle → PENDING (pas en retard)
      payments: [{ amount: 50000, paidAt, createdAt: paidAt }],
      refreshedInstallments: [
        { id: "i1", amount: 20000, dueDate: futureDue, paidAt, status: "PAID" },
        { id: "i2", amount: 20000, dueDate: futureDue, paidAt, status: "PAID" },
        { id: "i3", amount: 20000, dueDate: futureDue, paidAt: null, status: "PENDING" },
      ],
    });

    await syncPaymentPlanLedger(db, "student1", "fee1");

    const updates = db.installmentPayment.update.mock.calls.map((call: any) => ({
      id: call[0].where.id,
      status: call[0].data.status,
    }));
    expect(updates).toEqual([
      { id: "i1", status: "PAID" },
      { id: "i2", status: "PAID" },
      { id: "i3", status: "PENDING" },
    ]);

    expect(db.paymentPlan.update.mock.calls[0][0].data).toMatchObject({
      paidAmount: 50000,
      status: "ACTIVE",
    });
  });

  it("passe le plan en OVERDUE si la dueDate du frais est dépassée sans solde complet", async () => {
    const paidAt = new Date("2026-01-10");
    const db = makeDb({
      plan: {
        id: "plan1",
        totalAmount: 100000,
        paidAmount: 0,
        // Pas d'échéancier : seul le frais porte la date limite (dépassée)
        fee: { dueDate: pastDue },
        installmentPayments: [],
      },
      payments: [{ amount: 30000, paidAt, createdAt: paidAt }],
      refreshedInstallments: [],
    });

    await syncPaymentPlanLedger(db, "student1", "fee1");

    expect(db.paymentPlan.update.mock.calls[0][0].data).toMatchObject({
      paidAmount: 30000,
      status: "OVERDUE",
    });
  });
});
