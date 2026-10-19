import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { payment: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/payments/fedapay", () => ({
  verifyFedaPayEvent: vi.fn(),
}));

vi.mock("@/lib/finance/online-payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/finance/online-payments")>()),
  // Règles de confirmation testées sur une vraie base (integration-db/online-payments)
  confirmOnlinePayment: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { confirmOnlinePayment } from "@/lib/finance/online-payments";
import { verifyFedaPayEvent } from "@/lib/payments/fedapay";
import { POST } from "@/app/api/payments/fedapay/webhook/route";

function post(sig: string | null = "t=1,s=abc") {
  const headers = new Headers();
  if (sig !== null) headers.set("x-fedapay-signature", sig);
  return POST({
    text: () => Promise.resolve("{}"),
    headers,
  } as unknown as Parameters<typeof POST>[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FEDAPAY_WEBHOOK_SECRET = "whsec_test";
});
afterEach(() => {
  delete process.env.FEDAPAY_WEBHOOK_SECRET;
});

describe("POST /api/payments/fedapay/webhook", () => {
  it("retourne 503 sans FEDAPAY_WEBHOOK_SECRET", async () => {
    delete process.env.FEDAPAY_WEBHOOK_SECRET;
    expect((await post()).status).toBe(503);
  });

  it("retourne 401 si la signature est invalide", async () => {
    vi.mocked(verifyFedaPayEvent).mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    expect((await post()).status).toBe(401);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("transaction.approved : transmet montant et devise au contrôle de confirmation", async () => {
    vi.mocked(verifyFedaPayEvent).mockReturnValue({
      name: "transaction.approved",
      entity: { id: 4242, merchant_reference: "EDU-pmt1", amount: 50000, currency: { iso: "XOF" } },
    });
    vi.mocked(confirmOnlinePayment).mockResolvedValue({ outcome: "CONFIRMED", paymentId: "p1", overpaid: 0 });

    const res = await post();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.outcome).toBe("CONFIRMED");
    expect(confirmOnlinePayment).toHaveBeenCalledWith({
      reference: "EDU-pmt1",
      provider: "FEDAPAY",
      receivedAmount: 50000,
      receivedCurrency: "XOF",
      providerTransactionId: "4242",
      // Route globale : paiements historiques sans compte d'école seulement (S7)
      paymentAccountId: null,
      source: "FedaPay txn 4242",
    });
  });

  it("transaction.approved sans montant : transmis comme inconnu (jamais validé d'office)", async () => {
    vi.mocked(verifyFedaPayEvent).mockReturnValue({
      name: "transaction.approved",
      entity: { id: 9, merchant_reference: "EDU-pmt1" },
    });
    vi.mocked(confirmOnlinePayment).mockResolvedValue({ outcome: "MISMATCH", paymentId: "p1", reason: "x" });

    const res = await post();
    expect((await res.json()).outcome).toBe("MISMATCH");
    expect(vi.mocked(confirmOnlinePayment).mock.calls[0][0].receivedAmount).toBeNull();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("annule le paiement sur transaction.canceled", async () => {
    vi.mocked(verifyFedaPayEvent).mockReturnValue({
      name: "transaction.canceled",
      entity: { id: 7, merchant_reference: "EDU-pmt2" },
    });
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await post();
    expect((await res.json()).cancelled).toBe(1);
    expect(vi.mocked(prisma.payment.updateMany).mock.calls[0][0].data.status).toBe("CANCELLED");
  });

  it("acquitte sans action si pas de merchant_reference", async () => {
    vi.mocked(verifyFedaPayEvent).mockReturnValue({
      name: "transaction.approved",
      entity: { id: 1 },
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(confirmOnlinePayment).not.toHaveBeenCalled();
  });
});
