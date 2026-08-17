import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/payments/fedapay", () => ({
  isFedaPayConfigured: vi.fn(),
  createFedaPayCheckout: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  strictLimiter: { limiter: null, fallback: { limit: 20, windowMs: 60000 }, name: "strict" },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { findUnique: vi.fn(), update: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { isFedaPayConfigured, createFedaPayCheckout } from "@/lib/payments/fedapay";
import { checkRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/payments/fedapay/initiate/route";

const paymentId = cuid("pmt1");

function paymentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: paymentId,
    amount: 50000,
    status: "PENDING",
    reference: "EDU-ref1",
    studentId: FIXTURES.studentA,
    student: { schoolId: FIXTURES.schoolA },
    fee: { name: "Scolarité T1" },
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FEDAPAY_SECRET_KEY = "sk_test";
  vi.mocked(isFedaPayConfigured).mockReturnValue(true);
  vi.mocked(checkRateLimit).mockResolvedValue({
    success: true,
    remaining: 19,
    reset: new Date(),
  });
  vi.mocked(createFedaPayCheckout).mockResolvedValue({
    url: "https://checkout.fedapay.sandbox/x",
    token: "tok_1",
    transactionId: "42",
  });
});
afterEach(() => {
  delete process.env.FEDAPAY_SECRET_KEY;
});

describe("POST /api/payments/fedapay/initiate", () => {
  function post(body: Record<string, unknown>) {
    return POST(makeRequest("http://localhost:3000/api/payments/fedapay/initiate", {
      method: "POST",
      body,
    }));
  }

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await post({ paymentId });
    expect(res.status).toBe(401);
  });

  it("retourne 503 si FedaPay n'est pas configuré", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(isFedaPayConfigured).mockReturnValue(false);
    const res = await post({ paymentId });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("FEDAPAY_NOT_CONFIGURED");
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it("retourne 429 en cas de rate limit", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      reset: new Date(),
    });
    const res = await post({ paymentId });
    expect(res.status).toBe(429);
  });

  it("rejette un paymentId invalide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    const res = await post({ paymentId: "bad-id" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données invalides");
  });

  it("retourne 404 si le paiement n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(null as never);
    const res = await post({ paymentId });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Paiement introuvable");
  });

  it("bloque une initiation cross-tenant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      paymentRecord({ student: { schoolId: FIXTURES.schoolB } })
    );
    const res = await post({ paymentId });
    expect(res.status).toBe(403);
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
  });

  it("refuse à un PARENT un paiement d'un enfant non lié (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentB }],
    } as never);
    const res = await post({ paymentId });
    expect(res.status).toBe(403);
    expect(createFedaPayCheckout).not.toHaveBeenCalled();
  });

  it("rejette un paiement non PENDING (409)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      paymentRecord({ status: "VERIFIED" })
    );
    const res = await post({ paymentId });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Ce paiement n'est pas en attente.");
  });

  it("exige un email de payeur (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Awa",
      lastName: "Dossou",
      email: null,
    } as never);
    const res = await post({ paymentId });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Email du payeur requis pour le paiement en ligne.");
  });

  it("initie le checkout FedaPay et met à jour la référence du paiement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Awa",
      lastName: "Dossou",
      email: "awa@school.bj",
    } as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({ id: paymentId } as never);

    const res = await post({ paymentId });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.fedapay.sandbox/x");
    expect(body.reference).toBe("EDU-ref1");
    expect(createFedaPayCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50000,
        reference: "EDU-ref1",
        customer: { firstname: "Awa", lastname: "Dossou", email: "awa@school.bj" },
      })
    );
    const updateArgs = vi.mocked(prisma.payment.update).mock.calls[0][0] as {
      data: { reference: string; method: string };
    };
    expect(updateArgs.data.method).toBe("MOBILE_MONEY_MTN");
  });

  it("retourne 502 quand FedaPay échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("ACCOUNTANT"));
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(paymentRecord());
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Awa",
      lastName: "Dossou",
      email: "awa@school.bj",
    } as never);
    vi.mocked(createFedaPayCheckout).mockRejectedValue(new Error("fedapay down"));

    const res = await post({ paymentId });

    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe(
      "Échec de l'initialisation du paiement. Réessayez."
    );
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});