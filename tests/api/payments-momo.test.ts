import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

vi.mock("@/lib/prisma", () => ({
  default: {
    payment: { updateMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/payments/momo/webhook/route";

const MOMO_SECRET = "momo_whsec_test";

function signedPost(
  rawBody: string,
  headers: Record<string, string> = {}
): ReturnType<typeof POST> {
  const sig = `sha256=${createHmac("sha256", MOMO_SECRET).update(rawBody).digest("hex")}`;
  return POST({
    text: () => Promise.resolve(rawBody),
    headers: new Headers({ "x-momo-signature": sig, ...headers }),
  } as unknown as Parameters<typeof POST>[0]);
}

function unsignedPost(rawBody: string): ReturnType<typeof POST> {
  return POST({
    text: () => Promise.resolve(rawBody),
    headers: new Headers(),
  } as unknown as Parameters<typeof POST>[0]);
}

function successfulEvent(overrides: Record<string, unknown> = {}) {
  return {
    financialTransactionId: "ftn_1",
    externalId: "EDU-pmt1",
    amount: "50000",
    currency: "XOF",
    status: "SUCCESSFUL",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MOMO_WEBHOOK_SECRET = MOMO_SECRET;
});
afterEach(() => {
  delete process.env.MOMO_WEBHOOK_SECRET;
});

describe("POST /api/payments/momo/webhook (requireAuth: false)", () => {
  it("retourne 503 sans MOMO_WEBHOOK_SECRET", async () => {
    delete process.env.MOMO_WEBHOOK_SECRET;
    const res = await unsignedPost(JSON.stringify(successfulEvent()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Integration non configurée");
  });

  it("retourne 401 sans signature", async () => {
    const res = await unsignedPost(JSON.stringify(successfulEvent()));
    expect(res.status).toBe(401);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("retourne 401 sur signature invalide", async () => {
    const raw = JSON.stringify(successfulEvent());
    const badSig = "sha256=" + "0".repeat(64);
    const res = await POST({
      text: () => Promise.resolve(raw),
      headers: new Headers({ "x-momo-signature": badSig }),
    } as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("rejette un payload invalide (400)", async () => {
    const res = await signedPost("{not-json");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Payload invalide");
  });

  it("rejette un événement hors schéma Zod (400)", async () => {
    const res = await signedPost(
      JSON.stringify({ financialTransactionId: "ftn_1", status: "UNKNOWN" })
    );
    expect(res.status).toBe(400);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("rapproche le paiement PENDING → VERIFIED sur SUCCESSFUL", async () => {
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await signedPost(JSON.stringify(successfulEvent()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    const arg = vi.mocked(prisma.payment.updateMany).mock.calls[0][0] as {
      where: { reference: string; status: string; method: { in: string[] } };
      data: { status: string; notes: string; reconciledAt: Date };
    };
    expect(arg.where.reference).toBe("EDU-pmt1");
    expect(arg.where.status).toBe("PENDING");
    expect(arg.where.method.in).toEqual(["MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV"]);
    expect(arg.data.status).toBe("VERIFIED");
    expect(arg.data.notes).toBe("MoMo txn ftn_1");
  });

  it("annule le paiement sur FAILED", async () => {
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 } as never);

    const res = await signedPost(
      JSON.stringify(successfulEvent({ status: "FAILED" }))
    );

    expect(res.status).toBe(200);
    const arg = vi.mocked(prisma.payment.updateMany).mock.calls[0][0] as {
      data: { status: string };
    };
    expect(arg.data.status).toBe("CANCELLED");
  });

  it("acquitte sans action sur PENDING", async () => {
    const res = await signedPost(
      JSON.stringify(successfulEvent({ status: "PENDING" }))
    );
    expect(res.status).toBe(200);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("retourne 500 quand le rapprochement échoue", async () => {
    vi.mocked(prisma.payment.updateMany).mockRejectedValue(new Error("db down"));

    const res = await signedPost(JSON.stringify(successfulEvent()));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur interne");
  });
});