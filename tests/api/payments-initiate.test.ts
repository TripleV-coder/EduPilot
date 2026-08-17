import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/finance/providers/momo", () => ({ isMomoConfigured: vi.fn() }));
vi.mock("@/lib/payments/fedapay", () => ({ isFedaPayConfigured: vi.fn() }));
vi.mock("@/lib/finance/factory", () => ({
  PaymentProviderFactory: { getProvider: vi.fn() },
}));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    studentProfile: { findUnique: vi.fn() },
    fee: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    payment: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
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
import { POST } from "@/app/api/payments/initiate/route";

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
    expect((await res.json()).error).toBe("Student not found");
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
    expect((await res.json()).error).toBe("Fee not found");
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
    const updateArgs = vi.mocked(prisma.payment.update).mock.calls[0][0] as {
      data: { reference: string };
    };
    expect(updateArgs.data.reference).toBe("TXN-1");
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

  it("réutilise un paiement PENDING récent (idempotence)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(
      pendingPayment({ id: "cpay-existing", reference: "PAY-OLD" })
    );

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.payment.create)).not.toHaveBeenCalled();
    expect(providerMock.initiatePayment).toHaveBeenCalledWith(
      50000,
      "XOF",
      expect.any(String),
      "PAY-OLD",
      expect.any(Object)
    );
  });

  it("met à jour la méthode d'un paiement PENDING existant quand le rail change", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(
      pendingPayment({ id: "cpay-existing", method: "MOBILE_MONEY_MOOV", reference: "PAY-OLD" })
    );
    vi.mocked(prisma.payment.update).mockResolvedValue(
      pendingPayment({ id: "cpay-existing", method: "MOBILE_MONEY_MTN", reference: "PAY-OLD" })
    );

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.payment.update).mock.calls[0][0] as {
      data: { method: string };
    };
    expect(updateArgs.data.method).toBe("MOBILE_MONEY_MTN");
    expect(vi.mocked(prisma.payment.create)).not.toHaveBeenCalled();
  });

  it("retourne 500 quand le provider échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    mockTenant();
    vi.mocked(prisma.payment.create).mockResolvedValue(pendingPayment());
    vi.mocked(providerMock.initiatePayment).mockRejectedValue(new Error("provider down"));

    const res = await POST(makeRequest("http://localhost:3000/api/payments/initiate", {
      method: "POST",
      body: validBody(),
    }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Payment initiation failed");
  });
});