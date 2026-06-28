import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { payment: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/payments/fedapay", () => ({
  verifyFedaPayEvent: vi.fn(),
}));

import prisma from "@/lib/prisma";
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

  it("rapproche le paiement PENDING → VERIFIED sur transaction.approved", async () => {
    vi.mocked(verifyFedaPayEvent).mockReturnValue({
      name: "transaction.approved",
      entity: { id: 4242, merchant_reference: "EDU-pmt1" },
    });
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await post();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.reconciled).toBe(1);
    const arg = vi.mocked(prisma.payment.updateMany).mock.calls[0][0] as {
      where: { reference: string; status: string };
      data: { status: string };
    };
    expect(arg.where.reference).toBe("EDU-pmt1");
    expect(arg.where.status).toBe("PENDING");
    expect(arg.data.status).toBe("VERIFIED");
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
  });
});
