import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    installmentPayment: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/notification.service", () => ({
  createBulkNotifications: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { createBulkNotifications } from "@/lib/services/notification.service";
import {
  daysBetween,
  computeReminderStage,
  reminderContent,
  runInstallmentReminders,
  REMINDER_LEAD_DAYS,
} from "@/lib/finance/reminders";

// Le calcul de jour est désormais normalisé en UTC → dates construites en UTC
// pour être déterministes quel que soit le fuseau du runner.
const NOW = new Date(Date.UTC(2026, 6, 5, 10, 0));

function d(offsetDays: number): Date {
  return new Date(Date.UTC(2026, 6, 5 + offsetDays)); // minuit UTC + offset
}

describe("daysBetween", () => {
  it("ignore l'heure et compte des jours calendaires (UTC)", () => {
    expect(daysBetween(new Date(Date.UTC(2026, 6, 5, 23, 0)), new Date(Date.UTC(2026, 6, 6, 1, 0)))).toBe(1);
    expect(daysBetween(new Date(Date.UTC(2026, 6, 5, 8, 0)), new Date(Date.UTC(2026, 6, 5, 20, 0)))).toBe(0);
    expect(daysBetween(new Date(Date.UTC(2026, 6, 5)), new Date(Date.UTC(2026, 6, 2)))).toBe(-3);
  });
});

describe("computeReminderStage", () => {
  it("null si déjà payé ou annulé", () => {
    expect(computeReminderStage({ status: "PAID", dueDate: d(-2), now: NOW })).toBeNull();
    expect(computeReminderStage({ status: "CANCELLED", dueDate: d(-2), now: NOW })).toBeNull();
  });

  it("null si l'échéance est trop lointaine (> leadDays)", () => {
    expect(computeReminderStage({ status: "PENDING", dueDate: d(REMINDER_LEAD_DAYS + 1), now: NOW })).toBeNull();
  });

  it("UPCOMING dans la fenêtre de rappel", () => {
    expect(computeReminderStage({ status: "PENDING", dueDate: d(REMINDER_LEAD_DAYS), now: NOW })).toBe("UPCOMING");
    expect(computeReminderStage({ status: "PENDING", dueDate: d(1), now: NOW })).toBe("UPCOMING");
  });

  it("DUE le jour de l'échéance", () => {
    expect(computeReminderStage({ status: "PENDING", dueDate: d(0), now: NOW })).toBe("DUE");
  });

  it("OVERDUE puis CRITICAL selon le retard", () => {
    expect(computeReminderStage({ status: "OVERDUE", dueDate: d(-1), now: NOW })).toBe("OVERDUE");
    expect(computeReminderStage({ status: "OVERDUE", dueDate: d(-30), now: NOW })).toBe("OVERDUE");
    expect(computeReminderStage({ status: "OVERDUE", dueDate: d(-31), now: NOW })).toBe("CRITICAL");
  });
});

describe("reminderContent", () => {
  it("produit un titre et un message contenant l'élève et le montant", () => {
    const { title, message } = reminderContent("OVERDUE", {
      studentName: "Awa Diallo",
      amount: 25000,
      dueDate: new Date("2026-07-01T00:00:00Z"),
    });
    expect(title).toBe("Paiement en retard");
    expect(message).toContain("Awa Diallo");
    expect(message).toMatch(/25\s?000/); // formaté fr-FR (espace insécable)
  });
});

describe("runInstallmentReminders", () => {
  const p = prisma as unknown as {
    installmentPayment: {
      updateMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    p.installmentPayment.updateMany.mockResolvedValue({ count: 3 });
    p.installmentPayment.update.mockResolvedValue({});
  });

  function makeInstallment(overrides: Record<string, unknown>) {
    return {
      id: "inst-1",
      status: "OVERDUE",
      amount: 25000,
      dueDate: d(-5),
      lastReminderStage: null,
      lastReminderAt: null,
      paymentPlan: {
        student: {
          user: { firstName: "Awa", lastName: "Diallo" },
          parentStudents: [{ parent: { user: { id: "parent-1" } } }],
        },
      },
      ...overrides,
    };
  }

  it("balaie les échues et notifie les parents au changement d'étape", async () => {
    p.installmentPayment.findMany.mockResolvedValue([makeInstallment({})]);

    const res = await runInstallmentReminders(NOW);

    expect(p.installmentPayment.updateMany).toHaveBeenCalledOnce();
    expect(createBulkNotifications).toHaveBeenCalledOnce();
    expect(createBulkNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["parent-1"], type: "PAYMENT" })
    );
    expect(p.installmentPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inst-1" }, data: expect.objectContaining({ lastReminderStage: "OVERDUE" }) })
    );
    expect(res.swept).toBe(3);
    expect(res.notified).toBe(1);
    expect(res.OVERDUE).toBe(1);
  });

  it("n'envoie PAS de doublon si l'étape a déjà été notifiée (idempotence)", async () => {
    p.installmentPayment.findMany.mockResolvedValue([
      makeInstallment({ lastReminderStage: "OVERDUE" }),
    ]);

    const res = await runInstallmentReminders(NOW);

    expect(createBulkNotifications).not.toHaveBeenCalled();
    expect(p.installmentPayment.update).not.toHaveBeenCalled();
    expect(res.notified).toBe(0);
  });

  it("ne marque PAS l'étape sans parent lié (relance préservée pour un parent lié plus tard)", async () => {
    p.installmentPayment.findMany.mockResolvedValue([
      makeInstallment({ paymentPlan: { student: { user: { firstName: "X", lastName: "Y" }, parentStudents: [] } } }),
    ]);

    const res = await runInstallmentReminders(NOW);

    expect(createBulkNotifications).not.toHaveBeenCalled();
    // Aucun marquage : l'échéance reste candidate tant qu'aucun parent n'existe.
    expect(p.installmentPayment.update).not.toHaveBeenCalled();
    expect(res.notified).toBe(0);
  });

  it("restaure l'étape précédente si l'envoi de la notification échoue", async () => {
    p.installmentPayment.findMany.mockResolvedValue([
      makeInstallment({ lastReminderStage: "DUE", lastReminderAt: d(-1) }),
    ]);
    (createBulkNotifications as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("smtp down"));

    const res = await runInstallmentReminders(NOW);

    // 1er update = marque OVERDUE (optimiste), 2e update = restaure DUE + horodatage après échec.
    expect(p.installmentPayment.update).toHaveBeenCalledTimes(2);
    expect(p.installmentPayment.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ lastReminderStage: "OVERDUE" }) })
    );
    expect(p.installmentPayment.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: { lastReminderStage: "DUE", lastReminderAt: d(-1) } })
    );
    expect(res.notified).toBe(0);
    expect(res.OVERDUE).toBe(0);
  });
});
