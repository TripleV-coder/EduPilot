import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";
import type { PaymentPlan, InstallmentPayment, StudentProfile, Fee, Payment, Scholarship } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
// Verrou élève/frais et solde relu (lot 3b) : logique réelle prouvée contre
// PostgreSQL (payment-collection-guard) ; ici solde ouvert.
vi.mock("@/lib/finance/online-payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/finance/online-payments")>()),
  lockStudentFee: vi.fn(async () => {}),
  getFeeBalance: vi.fn(async () => ({ billed: 1_000_000, settled: 0, reserved: 0, remaining: 1_000_000, available: 1_000_000 })),
}));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    paymentPlan: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    installmentPayment: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    fee: { findFirst: vi.fn() },
    scholarship: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    notification: { create: vi.fn(), createMany: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prismaMock)
  );
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { getFeeBalance } from "@/lib/finance/online-payments";
import { GET, POST } from "@/app/api/payment-plans/route";
import { POST as POST_PAY } from "@/app/api/payment-plans/[id]/installments/[installmentId]/pay/route";

const planId = cuid("plan1");
const installmentId = cuid("inst1");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/payment-plans", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(makeRequest("http://localhost:3000/api/payment-plans"));
    expect(response.status).toBe(401);
  });

  it("restreint un STUDENT à ses propres plans", async () => {
    const session = makeSession("STUDENT");
    vi.mocked(auth).mockResolvedValue(session);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as unknown as StudentProfile);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as unknown as PaymentPlan[]);

    const response = await GET(makeRequest("http://localhost:3000/api/payment-plans"));

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0].where).toMatchObject({
      studentId: FIXTURES.studentA,
    });
  });

  it("restreint un SCHOOL_ADMIN à son école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as unknown as PaymentPlan[]);

    const response = await GET(makeRequest("http://localhost:3000/api/payment-plans"));

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0].where).toMatchObject({
      student: { schoolId: FIXTURES.schoolA },
    });
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));

    const response = await GET(makeRequest("http://localhost:3000/api/payment-plans"));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/payment-plans", () => {
  const validBody = {
    studentId: FIXTURES.studentA,
    feeId: FIXTURES.feeA,
    installments: 4,
    startDate: "2026-09-01T00:00:00.000Z",
  };

  function mockStudentAndFee(feeAmount = 120000) {
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
      user: { id: cuid("userstudenta"), firstName: "Awa", lastName: "Dossou" },
    } as unknown as StudentProfile);
    vi.mocked(prisma.fee.findFirst).mockResolvedValue({
      id: FIXTURES.feeA,
      schoolId: FIXTURES.schoolA,
      name: "Scolarité",
      amount: feeAmount,
    } as unknown as Fee);
  }

  it("refuse un PARENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("rejette un body invalide (400 Zod) — 13 échéances", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", {
        method: "POST",
        body: { ...validBody, installments: 13 },
      })
    );
    expect(response.status).toBe(400);
  });

  it("bloque la création cross-tenant (élève d'une autre école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
      id: FIXTURES.studentB,
      schoolId: FIXTURES.schoolB,
      user: { id: cuid("userstudentb"), firstName: "X", lastName: "Y" },
    } as unknown as StudentProfile);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", {
        method: "POST",
        body: { ...validBody, studentId: FIXTURES.studentB },
      })
    );

    expect(response.status).toBe(403);
    expect(prisma.paymentPlan.create).not.toHaveBeenCalled();
  });

  it("refuse au SUPER_ADMIN un plan associant l'élève d'une école aux frais d'une autre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    mockStudentAndFee();
    vi.mocked(prisma.fee.findFirst).mockResolvedValue({
      id: cuid("feeb"),
      schoolId: FIXTURES.schoolB,
      name: "Scolarité B",
      amount: 120000,
    } as unknown as Fee);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", { method: "POST", body: { ...validBody, feeId: cuid("feeb") } })
    );

    expect(response.status).toBe(403);
    expect(prisma.paymentPlan.create).not.toHaveBeenCalled();
  });

  it("refuse un second plan non annulé pour ces frais (409, lot 3d)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockStudentAndFee();
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([] as unknown as Scholarship[]);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({ id: planId } as unknown as PaymentPlan);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", { method: "POST", body: validBody })
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("Un plan de paiement est déjà en vigueur pour ces frais.");
    expect(prisma.paymentPlan.create).not.toHaveBeenCalled();
  });

  it("crée le plan : 4 échéances mensuelles égales, bourse déduite, notifications émises", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockStudentAndFee(120000);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);
    // Bourse active de 25% → total dû = 90 000, soit 22 500 par échéance
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([
      { percentage: 25, amount: null },
    ] as unknown as Scholarship[]);
    vi.mocked(prisma.paymentPlan.create).mockImplementation(async (args: Prisma.PaymentPlanCreateArgs) => ({
      id: planId,
      ...args.data,
      installmentPayments: args.data.installmentPayments.create,
      student: {
        user: { id: cuid("userstudenta"), firstName: "Awa", lastName: "Dossou" },
        parentStudents: [{ parent: { user: { id: cuid("userparenta") } } }],
      },
      fee: { id: FIXTURES.feeA, name: "Scolarité" },
    }) as unknown as PaymentPlan);
    // Plan relu après le recalcul (lot 3d) : celui qui vient d'être créé
    vi.mocked(prisma.paymentPlan.findUniqueOrThrow).mockImplementation((async () =>
      vi.mocked(prisma.paymentPlan.create).mock.results[0].value) as never);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", { method: "POST", body: validBody })
    );
    const body = await response.json();

    expect(response.status).toBe(201);

    const createArgs = vi.mocked(prisma.paymentPlan.create).mock.calls[0][0];
    expect(createArgs.data.totalAmount).toBe(90000);
    expect(createArgs.data.status).toBe("ACTIVE");

    const installments = createArgs.data.installmentPayments.create;
    expect(installments).toHaveLength(4);
    for (const installment of installments) {
      expect(installment.amount).toBe(22500);
      expect(installment.status).toBe("PENDING");
    }
    // Échéances mensuelles à partir de la date de départ
    expect(new Date(installments[0].dueDate).getMonth()).toBe(8); // septembre
    expect(new Date(installments[3].dueDate).getMonth()).toBe(11); // décembre

    // Cohérence du total : somme des échéances = total dû
    const sum = installments.reduce((acc: number, i: { amount: number }) => acc + i.amount, 0);
    expect(sum).toBe(body.totalAmount);

    // Audit + notifications élève et parents
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it("répartit 100 000 FCFA en 3 échéances entières qui tombent juste, sans déborder du 31 janvier", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockStudentAndFee(100000);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([] as unknown as Scholarship[]);
    vi.mocked(prisma.paymentPlan.create).mockImplementation(async (args: Prisma.PaymentPlanCreateArgs) => ({
      id: planId,
      ...args.data,
      installmentPayments: args.data.installmentPayments.create,
      student: { user: { id: cuid("userstudenta"), firstName: "Awa", lastName: "Dossou" }, parentStudents: [] },
      fee: { id: FIXTURES.feeA, name: "Scolarité" },
    }) as unknown as PaymentPlan);
    vi.mocked(prisma.paymentPlan.findUniqueOrThrow).mockImplementation((async () =>
      vi.mocked(prisma.paymentPlan.create).mock.results[0].value) as never);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", {
        method: "POST",
        body: { ...validBody, installments: 3, startDate: "2026-01-31T12:00:00.000Z" },
      })
    );
    expect(response.status).toBe(201);
    const createArgs = vi.mocked(prisma.paymentPlan.create).mock.calls[0][0];
    const installments = createArgs.data.installmentPayments.create as Array<{ amount: number; dueDate: Date }>;
    // Avant : 3 × 33 333,33 = 99 999,99 → plan jamais soldé (0,01 FCFA de reste)
    expect(installments.map((i) => i.amount)).toEqual([33334, 33333, 33333]);
    expect(installments.reduce((a, i) => a + i.amount, 0)).toBe(100000);
    // 31 janvier + 1 mois = 28 février (pas 3 mars)
    expect(new Date(installments[1].dueDate).getMonth()).toBe(1);
    expect(new Date(installments[1].dueDate).getDate()).toBe(28);
  });
});

describe("POST /api/payment-plans/[id]/installments/[installmentId]/pay", () => {
  const routeParams = { params: Promise.resolve({ id: planId, installmentId }) };

  function installmentRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: installmentId,
      paymentPlanId: planId,
      amount: 30000,
      status: "PENDING",
      dueDate: new Date("2026-09-01"),
      paymentPlan: {
        id: planId,
        studentId: FIXTURES.studentA,
        feeId: FIXTURES.feeA,
        status: "ACTIVE",
        totalAmount: 120000,
        paidAmount: 60000,
        installments: 4,
        student: {
          schoolId: FIXTURES.schoolA,
          user: { id: cuid("userstudenta"), firstName: "Awa", lastName: "Dossou" },
          parentStudents: [],
        },
        fee: { id: FIXTURES.feeA, dueDate: null },
      },
      ...overrides,
    };
  }

  /**
   * installmentPayment.findUnique est appelé deux fois : par le guard tenant
   * (select imbriqué schoolId) puis par la route (include complet).
   */
  function mockInstallmentLookups(record: ReturnType<typeof installmentRecord> | null) {
    vi.mocked(prisma.installmentPayment.findUnique).mockImplementation(async (args: Prisma.InstallmentPaymentFindUniqueArgs) => {
      if (args?.select) {
        if (!record) return null;
        // Relecture sous verrou (lot 3b) : statut de l'échéance et du plan
        if ((args.select as { status?: boolean }).status) {
          return {
            status: record.status,
            paymentPlan: {
              status: record.paymentPlan.status,
              paidAmount: record.paymentPlan.paidAmount,
              totalAmount: record.paymentPlan.totalAmount,
            },
          } as unknown as InstallmentPayment;
        }
        return {
          paymentPlan: {
            student: { schoolId: record.paymentPlan.student.schoolId },
          },
        } as unknown as InstallmentPayment;
      }
      return record as unknown as InstallmentPayment;
    });
  }

  it("refuse un PARENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));

    const response = await POST_PAY(
      makeRequest("http://localhost:3000/api/payment-plans/x/installments/y/pay", {
        method: "POST",
        body: { method: "CASH" },
      }),
      routeParams
    );
    expect(response.status).toBe(403);
  });

  it("retourne 404 si la mensualité est introuvable (ou hors tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockInstallmentLookups(null);

    const response = await POST_PAY(
      makeRequest("http://localhost:3000/api/payment-plans/x/installments/y/pay", {
        method: "POST",
        body: { method: "CASH" },
      }),
      routeParams
    );
    expect(response.status).toBe(404);
  });

  it("bloque l'accès cross-tenant à une mensualité d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const record = installmentRecord();
    record.paymentPlan.student.schoolId = FIXTURES.schoolB;
    mockInstallmentLookups(record);

    const response = await POST_PAY(
      makeRequest("http://localhost:3000/api/payment-plans/x/installments/y/pay", {
        method: "POST",
        body: { method: "CASH" },
      }),
      routeParams
    );

    expect(response.status).toBe(403);
    expect(prisma.installmentPayment.update).not.toHaveBeenCalled();
  });

  it("rejette une mensualité déjà payée (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockInstallmentLookups(installmentRecord({ status: "PAID" }));

    const response = await POST_PAY(
      makeRequest("http://localhost:3000/api/payment-plans/x/installments/y/pay", {
        method: "POST",
        body: { method: "CASH" },
      }),
      routeParams
    );
    expect(response.status).toBe(400);
  });

  it("rejette si la mensualité n'appartient pas au plan de l'URL (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockInstallmentLookups(installmentRecord({ paymentPlanId: cuid("autreplan") }));

    const response = await POST_PAY(
      makeRequest("http://localhost:3000/api/payment-plans/x/installments/y/pay", {
        method: "POST",
        body: { method: "CASH" },
      }),
      routeParams
    );
    expect(response.status).toBe(400);
  });

  it("encaisse la mensualité la plus ancienne non soldée pour son reste ; état final issu du recalcul (lot 3c)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockInstallmentLookups(installmentRecord());
    // Solde relu sous verrou : 60 000 déjà encaissés sur 4 × 30 000
    vi.mocked(getFeeBalance).mockResolvedValueOnce({ billed: 120000, settled: 60000, reserved: 0, remaining: 60000, available: 60000 });
    const at = (m: number) => new Date(Date.UTC(2026, m, 1));
    // Plan en vigueur (règle commune, lot 3d), lu sous verrou par findFirst
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValueOnce({
      id: planId,
      status: "ACTIVE",
      installmentPayments: [
        { id: cuid("echeance1"), amount: 30000, dueDate: at(6), status: "PAID" },
        { id: cuid("echeance2"), amount: 30000, dueDate: at(7), status: "PAID" },
        { id: installmentId, amount: 30000, dueDate: at(8), status: "PENDING" },
        { id: cuid("echeance4"), amount: 30000, dueDate: at(9), status: "PENDING" },
      ],
    } as unknown as PaymentPlan);
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: cuid("pay1") } as unknown as Payment);
    // syncPaymentPlanLedger (réel) : plan toujours actif après ce versement (90 000 / 120 000)
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: planId,
      totalAmount: 120000,
      paidAmount: 60000,
      student: { schoolId: FIXTURES.schoolA }, fee: { dueDate: null, schoolId: FIXTURES.schoolA },
      installmentPayments: [],
    } as unknown as PaymentPlan);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { amount: 60000, paidAt: new Date("2026-08-01"), createdAt: new Date("2026-08-01") },
      { amount: 30000, paidAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01") },
    ] as unknown as Payment[]);
    vi.mocked(prisma.installmentPayment.findMany).mockResolvedValue([] as unknown as InstallmentPayment[]);
    vi.mocked(prisma.paymentPlan.update).mockResolvedValue({
      id: planId,
      status: "ACTIVE",
      installmentPayments: [{ id: installmentId, status: "PAID" }],
    } as unknown as PaymentPlan);

    const response = await POST_PAY(
      makeRequest("http://localhost:3000/api/payment-plans/x/installments/y/pay", {
        method: "POST",
        body: { method: "CASH", reference: "RECU-42" },
      }),
      routeParams
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isFullyPaid).toBe(false);
    // État final (après recalcul) renvoyé
    expect(body.installment).toMatchObject({ id: installmentId, status: "PAID" });
    // Le reste de l'échéance est encaissé, numérotée à sa place dans l'échéancier
    expect(vi.mocked(prisma.payment.create).mock.calls[0][0].data).toMatchObject({
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      amount: 30000,
      method: "CASH",
      reference: "RECU-42",
      status: "VERIFIED",
      notes: " - Mensualité 3/4",
    });
    // Plus aucune écriture manuelle avant le recalcul : seul syncPaymentPlanLedger
    // écrit le total payé (90 000 = somme des paiements)
    expect(vi.mocked(prisma.paymentPlan.update).mock.calls).toHaveLength(1);
    expect(vi.mocked(prisma.paymentPlan.update).mock.calls[0][0].data).toMatchObject({ paidAmount: 90000, status: "ACTIVE" });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});
