import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, any> = {
    paymentPlan: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    installmentPayment: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), findMany: vi.fn() },
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
    vi.mocked(auth).mockResolvedValue(session as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as any);

    const response = await GET(makeRequest("http://localhost:3000/api/payment-plans"));

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0].where).toMatchObject({
      studentId: FIXTURES.studentA,
    });
  });

  it("restreint un SCHOOL_ADMIN à son école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    vi.mocked(prisma.paymentPlan.findMany).mockResolvedValue([] as any);

    const response = await GET(makeRequest("http://localhost:3000/api/payment-plans"));

    expect(response.status).toBe(200);
    expect(vi.mocked(prisma.paymentPlan.findMany).mock.calls[0][0].where).toMatchObject({
      student: { schoolId: FIXTURES.schoolA },
    });
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);

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
    } as any);
    vi.mocked(prisma.fee.findFirst).mockResolvedValue({
      id: FIXTURES.feeA,
      schoolId: FIXTURES.schoolA,
      name: "Scolarité",
      amount: feeAmount,
    } as any);
  }

  it("refuse un PARENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("rejette un body invalide (400 Zod) — 13 échéances", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", {
        method: "POST",
        body: { ...validBody, installments: 13 },
      })
    );
    expect(response.status).toBe(400);
  });

  it("bloque la création cross-tenant (élève d'une autre école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
      id: FIXTURES.studentB,
      schoolId: FIXTURES.schoolB,
      user: { id: cuid("userstudentb"), firstName: "X", lastName: "Y" },
    } as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", {
        method: "POST",
        body: { ...validBody, studentId: FIXTURES.studentB },
      })
    );

    expect(response.status).toBe(403);
    expect(prisma.paymentPlan.create).not.toHaveBeenCalled();
  });

  it("refuse un doublon de plan actif (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    mockStudentAndFee();
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({ id: planId } as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", { method: "POST", body: validBody })
    );

    expect(response.status).toBe(400);
    expect(prisma.paymentPlan.create).not.toHaveBeenCalled();
  });

  it("crée le plan : 4 échéances mensuelles égales, bourse déduite, notifications émises", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    mockStudentAndFee(120000);
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue(null);
    // Bourse active de 25% → total dû = 90 000, soit 22 500 par échéance
    vi.mocked(prisma.scholarship.findMany).mockResolvedValue([
      { percentage: 25, amount: null },
    ] as any);
    vi.mocked(prisma.paymentPlan.create).mockImplementation(async (args: any) => ({
      id: planId,
      ...args.data,
      installmentPayments: args.data.installmentPayments.create,
      student: {
        user: { id: cuid("userstudenta"), firstName: "Awa", lastName: "Dossou" },
        parentStudents: [{ parent: { user: { id: cuid("userparenta") } } }],
      },
      fee: { id: FIXTURES.feeA, name: "Scolarité" },
    }) as any);

    const response = await POST(
      makeRequest("http://localhost:3000/api/payment-plans", { method: "POST", body: validBody })
    );
    const body = await response.json();

    expect(response.status).toBe(201);

    const createArgs = vi.mocked(prisma.paymentPlan.create).mock.calls[0][0] as any;
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
    const sum = installments.reduce((acc: number, i: any) => acc + i.amount, 0);
    expect(sum).toBe(body.totalAmount);

    // Audit + notifications élève et parents
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalled();
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
    vi.mocked(prisma.installmentPayment.findUnique).mockImplementation(async (args: any) => {
      if (args?.select) {
        if (!record) return null;
        return {
          paymentPlan: {
            student: { schoolId: (record.paymentPlan as any).student.schoolId },
          },
        } as any;
      }
      return record as any;
    });
  }

  it("refuse un PARENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT") as any);

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
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
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
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    const record = installmentRecord();
    (record.paymentPlan as any).student.schoolId = FIXTURES.schoolB;
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
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
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
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
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

  it("encaisse la mensualité : statut PAID, montant cumulé, payment créé, notification", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT") as any);
    mockInstallmentLookups(installmentRecord());
    vi.mocked(prisma.installmentPayment.update).mockResolvedValue({
      id: installmentId,
      status: "PAID",
    } as any);
    vi.mocked(prisma.paymentPlan.update).mockResolvedValue({
      id: planId,
      status: "ACTIVE",
      installments: 4,
      installmentPayments: [{ status: "PAID" }],
    } as any);
    vi.mocked(prisma.payment.create).mockResolvedValue({ id: cuid("pay1") } as any);
    // syncPaymentPlanLedger : plan toujours actif après ce versement (90 000 / 120 000)
    vi.mocked(prisma.paymentPlan.findFirst).mockResolvedValue({
      id: planId,
      totalAmount: 120000,
      paidAmount: 60000,
      fee: { dueDate: null },
      installmentPayments: [],
    } as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { amount: 60000, paidAt: new Date("2026-08-01"), createdAt: new Date("2026-08-01") },
      { amount: 30000, paidAt: new Date("2026-09-01"), createdAt: new Date("2026-09-01") },
    ] as any);
    vi.mocked(prisma.installmentPayment.findMany).mockResolvedValue([] as any);

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

    // La mensualité passe à PAID
    expect(vi.mocked(prisma.installmentPayment.update).mock.calls[0][0]).toMatchObject({
      where: { id: installmentId },
      data: { status: "PAID" },
    });
    // Le cumul payé est mis à jour : 60 000 + 30 000
    expect(vi.mocked(prisma.paymentPlan.update).mock.calls[0][0].data).toMatchObject({
      paidAmount: 90000,
      status: "ACTIVE",
    });
    // Une trace Payment VERIFIED est créée pour la mensualité
    expect(vi.mocked(prisma.payment.create).mock.calls[0][0].data).toMatchObject({
      studentId: FIXTURES.studentA,
      feeId: FIXTURES.feeA,
      amount: 30000,
      method: "CASH",
      reference: "RECU-42",
      status: "VERIFIED",
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});
