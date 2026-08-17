import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { cuid } from "./test-helpers";

vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/payments/webhook/route";

const FW_SECRET = "fw_secret_test";
const PSK_SECRET = "psk_secret_test";
const paymentId = cuid("pmt1");

function rawRequest(rawBody: string, headers: Record<string, string> = {}) {
  return {
    text: () => Promise.resolve(rawBody),
    headers: new Headers(headers),
  } as unknown as Parameters<typeof POST>[0];
}

function flutterwave(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", FW_SECRET).update(raw).digest("hex");
  return rawRequest(raw, { "verif-hash": sig, "x-payment-provider": "FLUTTERWAVE" });
}

function paystack(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha512", PSK_SECRET).update(raw).digest("hex");
  return rawRequest(raw, { "x-paystack-signature": sig, "x-payment-provider": "PAYSTACK" });
}

function pendingPayment(overrides: Record<string, unknown> = {}) {
  return { id: paymentId, amount: 50000, status: "PENDING", ...overrides } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FLUTTERWAVE_WEBHOOK_SECRET = FW_SECRET;
  process.env.PAYSTACK_SECRET_KEY = PSK_SECRET;
});
afterEach(() => {
  delete process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  delete process.env.PAYSTACK_SECRET_KEY;
});

describe("POST /api/payments/webhook (requireAuth: false)", () => {
  it("refuse un webhook sans header de signature (401)", async () => {
    const res = await POST(rawRequest('{"id":"t1","status":"successful"}'));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it("refuse une signature invalide (401)", async () => {
    const res = await POST(
      rawRequest('{"id":"t1","status":"successful"}', { "verif-hash": "deadbeef" })
    );
    expect(res.status).toBe(401);
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it("refuse quand FLUTTERWAVE_WEBHOOK_SECRET n'est pas configuré (401)", async () => {
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    const res = await POST(flutterwave({ id: "t1", status: "successful" }));
    expect(res.status).toBe(401);
  });

  it("rejette un JSON invalide (400)", async () => {
    const raw = "{not-json";
    const sig = createHmac("sha256", FW_SECRET).update(raw).digest("hex");
    const res = await POST(rawRequest(raw, { "verif-hash": sig }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid JSON payload");
  });

  it("acquitte sans action quand aucun identifiant de transaction", async () => {
    const res = await POST(flutterwave({ status: "successful" }));
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it("acquitte un webhook pour une transaction inconnue", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null as never);
    const res = await POST(flutterwave({ id: "txn_unknown", status: "successful" }));
    expect(res.status).toBe(200);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("est idempotent pour un paiement déjà VERIFIED", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(
      pendingPayment({ status: "VERIFIED" })
    );
    const res = await POST(flutterwave({ id: "txn1", status: "successful", amount: 50000 }));
    expect(res.status).toBe(200);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it("passe le paiement à VERIFIED sur status successful", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(pendingPayment());
    vi.mocked(prisma.payment.update).mockResolvedValue({} as never);

    const res = await POST(flutterwave({ id: "txn1", status: "successful", amount: 50000 }));

    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
    const arg = vi.mocked(prisma.payment.update).mock.calls[0][0] as {
      where: { id: string };
      data: { status: string; paidAt: Date };
    };
    expect(arg.where.id).toBe(paymentId);
    expect(arg.data.status).toBe("VERIFIED");
    expect(arg.data.paidAt).toBeInstanceOf(Date);
  });

  it("annule le paiement sur status failed", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(pendingPayment());
    vi.mocked(prisma.payment.update).mockResolvedValue({} as never);

    const res = await POST(flutterwave({ id: "txn1", status: "failed" }));

    expect(res.status).toBe(200);
    const arg = vi.mocked(prisma.payment.update).mock.calls[0][0] as {
      data: { status: string };
    };
    expect(arg.data.status).toBe("CANCELLED");
  });

  it("annule un paiement en cas de tentative de fraude (montant inférieur au DB)", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(pendingPayment());
    vi.mocked(prisma.payment.update).mockResolvedValue({} as never);

    const res = await POST(flutterwave({ id: "txn1", status: "successful", amount: 100 }));

    expect(res.status).toBe(200);
    const arg = vi.mocked(prisma.payment.update).mock.calls[0][0] as {
      data: { status: string };
    };
    expect(arg.data.status).toBe("CANCELLED");
  });

  it("accepte une signature Paystack (HMAC-SHA512)", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(pendingPayment());
    vi.mocked(prisma.payment.update).mockResolvedValue({} as never);

    const res = await POST(
      paystack({ transaction_id: "txn2", status: "successful", amount: 50000 })
    );

    expect(res.status).toBe(200);
    expect(prisma.payment.update).toHaveBeenCalled();
  });

  it("retourne 500 quand le traitement échoue", async () => {
    vi.mocked(prisma.payment.findFirst).mockRejectedValue(new Error("db down"));

    const res = await POST(flutterwave({ id: "txn1", status: "successful" }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Webhook processing failed");
  });
});