import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { cuid } from "./test-helpers";

vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/finance/online-payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/finance/online-payments")>()),
  // Règles de confirmation testées sur une vraie base (integration-db/online-payments)
  confirmOnlinePayment: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { confirmOnlinePayment } from "@/lib/finance/online-payments";
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
    expect((await res.json()).error).toBe("Non authentifié");
    expect(confirmOnlinePayment).not.toHaveBeenCalled();
  });

  it("refuse une signature invalide (401)", async () => {
    const res = await POST(
      rawRequest('{"id":"t1","status":"successful"}', { "verif-hash": "deadbeef" })
    );
    expect(res.status).toBe(401);
    expect(confirmOnlinePayment).not.toHaveBeenCalled();
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
    expect(confirmOnlinePayment).not.toHaveBeenCalled();
  });

  it("Flutterwave charge.completed : référence tx_ref, montant et devise transmis au contrôle", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({ outcome: "CONFIRMED", paymentId, overpaid: 0 });

    const res = await POST(flutterwave({
      event: "charge.completed",
      data: { id: 285959875, tx_ref: "PAY-1-ABC", amount: 50000, currency: "XOF", status: "successful" },
    }));

    expect(res.status).toBe(200);
    expect(confirmOnlinePayment).toHaveBeenCalledWith({
      reference: "PAY-1-ABC",
      provider: "FLUTTERWAVE",
      receivedAmount: 50000,
      receivedCurrency: "XOF",
      providerTransactionId: "285959875",
      source: "webhook FLUTTERWAVE",
    });
  });

  it("Paystack charge.success : montant ramené des centièmes en FCFA", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({ outcome: "CONFIRMED", paymentId, overpaid: 0 });

    const res = await POST(paystack({
      event: "charge.success",
      data: { id: 4099260516, reference: "PAY-2-DEF", amount: 5000000, currency: "XOF", status: "success" },
    }));

    expect(res.status).toBe(200);
    expect(confirmOnlinePayment).toHaveBeenCalledWith(expect.objectContaining({
      reference: "PAY-2-DEF",
      provider: "PAYSTACK",
      receivedAmount: 50000,
      receivedCurrency: "XOF",
    }));
  });

  it("le fournisseur vient de la signature, pas de l'en-tête déclaratif", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({ outcome: "CONFIRMED", paymentId, overpaid: 0 });
    const raw = JSON.stringify({ data: { reference: "PAY-3", amount: 100, currency: "XOF", status: "success" } });
    const sig = createHmac("sha512", PSK_SECRET).update(raw).digest("hex");

    await POST(rawRequest(raw, { "x-paystack-signature": sig, "x-payment-provider": "FLUTTERWAVE" }));

    expect(vi.mocked(confirmOnlinePayment).mock.calls[0][0]).toMatchObject({ provider: "PAYSTACK", receivedAmount: 1 });
  });

  it("annule l'essai sur status failed (en attente ou expiré seulement)", async () => {
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await POST(flutterwave({ data: { tx_ref: "PAY-1-ABC", status: "failed" } }));

    expect(res.status).toBe(200);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { reference: "PAY-1-ABC", status: { in: ["PENDING", "EXPIRED"] } },
      data: { status: "CANCELLED" },
    });
    expect(confirmOnlinePayment).not.toHaveBeenCalled();
  });

  it("accepte encore l'ancien format à la racine (id, status, amount)", async () => {
    vi.mocked(confirmOnlinePayment).mockResolvedValue({ outcome: "MISMATCH", paymentId, reason: "montant" });

    const res = await POST(flutterwave({ id: "txn1", status: "successful", amount: 100 }));

    expect(res.status).toBe(200);
    expect(vi.mocked(confirmOnlinePayment).mock.calls[0][0]).toMatchObject({ reference: "txn1", receivedAmount: 100, receivedCurrency: null });
  });

  it("retourne 500 quand le traitement échoue", async () => {
    vi.mocked(confirmOnlinePayment).mockRejectedValue(new Error("db down"));

    const res = await POST(flutterwave({ id: "txn1", status: "successful" }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Webhook processing failed");
  });
});
