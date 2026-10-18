import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/finance/providers/momo", () => ({ isMomoConfigured: vi.fn() }));
vi.mock("@/lib/payments/fedapay", () => ({ isFedaPayConfigured: vi.fn() }));
vi.mock("@/lib/finance/factory", () => ({
  PaymentProviderFactory: { getProvider: vi.fn() },
}));
// Verrou et solde : sémantique testée sur une vraie base (integration-db/online-payments)
vi.mock("@/lib/finance/online-payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/finance/online-payments")>()),
  lockStudentFee: vi.fn(),
  getFeeBalance: vi.fn(),
}));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    studentProfile: { findUnique: vi.fn() },
    fee: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    payment: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg)
      ? Promise.all(arg)
      : (arg as (tx: unknown) => Promise<unknown>)(prismaMock)
  );
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { PaymentProviderFactory } from "@/lib/finance/factory";
import { isMomoConfigured } from "@/lib/finance/providers/momo";
import { isFedaPayConfigured } from "@/lib/payments/fedapay";
import { getFeeBalance, lockStudentFee } from "@/lib/finance/online-payments";
import { POST } from "@/app/api/payments/initiate/route";
import { ProviderInitError } from "@/lib/finance/providers/init-error";

/** Rien encore payé par défaut : reste à payer = montant du frais. */
function balance(overrides: Record<string, number> = {}) {
  const b = { billed: 100000, settled: 0, reserved: 0, ...overrides };
  const remaining = Math.max(0, b.billed - b.settled);
  return { ...b, remaining, available: Math.max(0, remaining - b.reserved) };
}

const providerMock = {
  name: "MOMO",
  initiatePayment: vi.fn(),
  verifyPayment: vi.fn(),
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    amount: 50000,
    feeId: FIXTURES.feeA,
    studentId: FIXTURES.studentA,
    provider: "MTN",
    ...overrides,
  };
}

function mockTenant() {
  vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
    id: FIXTURES.studentA,
    schoolId: FIXTURES.schoolA,
    userId: "cuser1",
  } as never);
  vi.mocked(prisma.fee.findUnique).mockResolvedValue({
    id: FIXTURES.feeA,
    schoolId: FIXTURES.schoolA,
    amount: 100000,
  } as never);
}

function pendingPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: FIXTURES.studentA === overrides.studentId ? FIXTURES.studentA : "cpay1",
    amount: 50000,
    status: "PENDING",
    reference: "PAY-123-ABC",
    method: "MOBILE_MONEY_MTN",
    createdAt: new Date(),
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MOMO_SUBSCRIPTION_KEY = "sk_test";
  process.env.MOMO_API_USER = "user_test";
  process.env.MOMO_API_KEY = "key_test";
  process.env.FEDAPAY_SECRET_KEY = "sk_fedapay_test";
  vi.mocked(isMomoConfigured).mockReturnValue(true);
  vi.mocked(isFedaPayConfigured).mockReturnValue(true);
  vi.mocked(PaymentProviderFactory.getProvider).mockReturnValue(providerMock as never);
  vi.mocked(getFeeBalance).mockResolvedValue(balance());
  vi.mocked(prisma.payment.findFirst).mockResolvedValue(null as never);
  vi.mocked(providerMock.initiatePayment).mockResolvedValue({
    paymentUrl: "https://pay.example/x",
    transactionId: "TXN-1",
  });
  vi.mocked(prisma.payment.update).mockResolvedValue({
    id: "cpay1",
    reference: "TXN-1",
  } as never);
});
afterEach(() => {
  delete process.env.MOMO_SUBSCRIPTION_KEY;
  delete process.env.MOMO_API_USER;
  delete process.env.MOMO_API_KEY;
  delete process.env.FEDAPAY_SECRET_KEY;
});

describe("POST /api/payments/initiate", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));
    expect(res.status).toBe(401);
  });

  it("sans passerelle Mobile Money configurée : 503 explicite, aucun paiement créé (recette : 500)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(isMomoConfigured).mockReturnValue(false);
    vi.mocked(isFedaPayConfigured).mockReturnValue(false);
    mockTenant();
    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe("PAYMENT_GATEWAY_NOT_CONFIGURED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse un rôle non autorisé (TEACHER)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));
    expect(res.status).toBe(403);
  });

  it("rejette un body invalide avec 400 + détails Zod", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: { amount: 50000, feeId: FIXTURES.feeA, studentId: FIXTURES.studentA },
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.details).toBeDefined();
  });

  it("retourne 404 si l'étudiant n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      id: FIXTURES.feeA,
      schoolId: FIXTURES.schoolA,
      amount: 100000,
    } as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Élève introuvable");
  });

  it("retourne 404 si le frais n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
      userId: "cuser1",
    } as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue(null as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Frais introuvables");
  });

  it("bloque une initiation cross-tenant (étudiant d'une autre école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentB,
      schoolId: FIXTURES.schoolB,
      userId: "cuser2",
    } as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      id: FIXTURES.feeB,
      schoolId: FIXTURES.schoolB,
      amount: 100000,
    } as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody({ studentId: FIXTURES.studentB, feeId: FIXTURES.feeB }),
    }));

    expect(res.status).toBe(403);
    expect(providerMock.initiatePayment).not.toHaveBeenCalled();
  });

  it("refuse à un PARENT le paiement d'un enfant non lié (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    mockTenant();
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentB }],
    } as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(403);
    expect(providerMock.initiatePayment).not.toHaveBeenCalled();
  });

  it("refuse à un STUDENT de payer pour un autre compte (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
      schoolId: FIXTURES.schoolA,
      userId: "cother-user",
    } as never);
    vi.mocked(prisma.fee.findUnique).mockResolvedValue({
      id: FIXTURES.feeA,
      schoolId: FIXTURES.schoolA,
      amount: 100000,
    } as never);

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(403);
    expect(providerMock.initiatePayment).not.toHaveBeenCalled();
  });

  it("rejette un montant supérieur au montant du frais (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody({ amount: 200000 }),
    }));

    expect(res.status).toBe(400);
    expect(providerMock.initiatePayment).not.toHaveBeenCalled();
  });

  it("initie un paiement MoMo direct (MOMO) et met à jour la référence", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.create).mockResolvedValue(pendingPayment());

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody({ payerPhone: "0190000000" }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.paymentUrl).toBe("https://pay.example/x");
    expect(body.transactionId).toBe("TXN-1");
    expect(PaymentProviderFactory.getProvider).toHaveBeenCalledWith("MOMO");
    const createArgs = vi.mocked(prisma.payment.create).mock.calls[0][0] as {
      data: { status: string; method: string; amount: number };
    };
    expect(createArgs.data.status).toBe("PENDING");
    expect(createArgs.data.method).toBe("MOBILE_MONEY_MTN");
    expect(createArgs.data).toMatchObject({ provider: "MOMO" });
    expect(lockStudentFee).toHaveBeenCalledWith(prisma, FIXTURES.studentA, FIXTURES.feeA);
    // Audit N7 : la référence n'est jamais remplacée par l'identifiant du
    // fournisseur (les webhooks rapprochent par NOTRE référence) ; cet
    // identifiant est rangé à part, pour la réconciliation à 24 h.
    expect(prisma.payment.update).toHaveBeenCalledTimes(1);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "cpay1" },
      data: { providerTransactionId: "TXN-1" },
    });
    expect(providerMock.initiatePayment).toHaveBeenCalledWith(
      50000,
      "XOF",
      "accountant@school.bj",
      "PAY-123-ABC",
      expect.objectContaining({ phone: "0190000000", network: "MTN" })
    );
  });

  it("retombe sur FedaPay quand MoMo direct n'est pas configuré", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(isMomoConfigured).mockReturnValue(false);
    mockTenant();
    vi.mocked(prisma.payment.create).mockResolvedValue(pendingPayment());

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(200);
    expect(PaymentProviderFactory.getProvider).toHaveBeenCalledWith("FEDAPAY");
  });

  // S3 : un essai déjà confié à un fournisseur n'est ni modifié ni renvoyé.
  // Avant, la reprise rappelait le fournisseur (seconde transaction pour la
  // même dette) et pouvait réassocier l'essai à un autre fournisseur.
  it("essai déjà lancé chez le même fournisseur : 409, aucun second appel, rien de modifié", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(
      pendingPayment({ id: "cpay-existing", reference: "PAY-OLD", provider: "MOMO", notes: null })
    );

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "PAYMENT_ALREADY_STARTED", paymentId: "cpay-existing" });
    expect(vi.mocked(prisma.payment.create)).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.payment.update)).not.toHaveBeenCalled();
    expect(providerMock.initiatePayment).not.toHaveBeenCalled();
  });

  it("essai lancé chez un autre fournisseur : 409, jamais réassocié, autre fournisseur non appelé", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(
      pendingPayment({ id: "cpay-existing", method: "MOBILE_MONEY_MTN", reference: "PAY-OLD", provider: "FEDAPAY", notes: null })
    );

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "PAYMENT_PROVIDER_CONFLICT", paymentId: "cpay-existing" });
    expect(vi.mocked(prisma.payment.update)).not.toHaveBeenCalled();
    expect(vi.mocked(prisma.payment.create)).not.toHaveBeenCalled();
    expect(providerMock.initiatePayment).not.toHaveBeenCalled();
  });

  it("la reprise ne cherche que des essais en ligne (jamais un paiement manuel en attente)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.create).mockResolvedValue(pendingPayment());

    await POST(makeRequest("http://localhost:3000/api/payments/initiate", { method: "POST", body: validBody() }));

    const where = (vi.mocked(prisma.payment.findFirst).mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ status: "PENDING", provider: { not: null } });
  });

  it("refus avéré du fournisseur : 500 et l'essai cesse de réserver (EXPIRED)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.create).mockResolvedValue(pendingPayment());
    vi.mocked(providerMock.initiatePayment).mockRejectedValue(new ProviderInitError("refusé (400)", "REFUSED"));

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Payment initiation failed");
    // Aucune transaction créée : l'essai ne réserve plus le montant
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: "cpay1", status: "PENDING" },
      data: expect.objectContaining({ status: "EXPIRED" }),
    });
  });

  it("erreur sans preuve d'absence de transaction : 502, l'essai reste PENDING et réservé (lot 3b)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.create).mockResolvedValue(pendingPayment());
    vi.mocked(providerMock.initiatePayment).mockRejectedValue(new Error("provider down"));

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("PAYMENT_INIT_UNCERTAIN");
    const marked = vi.mocked(prisma.payment.updateMany).mock.calls[0]?.[0] as { where: unknown; data: Record<string, unknown> };
    expect(marked.where).toEqual({ id: "cpay1", status: "PENDING" });
    expect(marked.data).not.toHaveProperty("status");
  });

  it("compte les paiements déjà encaissés : au-delà du reste à payer, 400", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(getFeeBalance).mockResolvedValue(balance({ settled: 70000 }));

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody({ amount: 40000 }),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.remaining).toBe(30000);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it("un essai en cours réserve son montant : 409 explicite avec le montant payable", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    mockTenant();
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }],
    } as never);
    vi.mocked(getFeeBalance).mockResolvedValue(balance({ reserved: 80000 }));

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody({ amount: 50000 }),
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toMatchObject({ code: "PAYMENT_IN_PROGRESS", reserved: 80000, available: 20000 });
    expect(providerMock.initiatePayment).not.toHaveBeenCalled();
  });

  it("refuse une devise autre que le franc CFA (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody({ currency: "EUR" }),
    }));
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});