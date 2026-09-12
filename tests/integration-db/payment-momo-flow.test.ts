import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import prisma from "@/lib/prisma";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * N7 — parcours Mobile Money complet contre une vraie base :
 * initiation → webhook MoMo signé → VERIFIED, puis idempotence.
 *
 * Avant correctif, /api/payments/initiate remplaçait `reference` (notre
 * « PAY-… ») par l'identifiant renvoyé par le fournisseur, alors que le
 * webhook rapproche par `externalId` = notre référence : le paiement restait
 * PENDING alors que l'argent était encaissé. Seul l'appel HTTP au fournisseur
 * est simulé (service externe) ; routes, Prisma et signature sont réels.
 */
const { initiatePayment } = vi.hoisted(() => ({ initiatePayment: vi.fn() }));

vi.mock("@/lib/finance/factory", () => ({
  PaymentProviderFactory: { getProvider: () => ({ initiatePayment }) },
}));

import { POST as initiate } from "@/app/api/payments/initiate/route";
import { POST as momoWebhook } from "@/app/api/payments/momo/webhook/route";

const WEBHOOK_SECRET = "integration-momo-webhook-secret";

let schoolId: string;
let studentId: string;

async function newFee(): Promise<string> {
  const fee = await prisma.fee.create({ data: { schoolId, name: `Scolarité ${uniqueCode("F")}`, amount: 50000 } });
  return fee.id;
}

/** Initie un paiement MoMo ; renvoie l'id du paiement et la référence transmise au fournisseur. */
async function initiateMomo(feeId: string): Promise<{ paymentId: string; externalId: string }> {
  initiatePayment.mockResolvedValueOnce({ paymentUrl: "", transactionId: "7f3c2a10-uuid-renvoye-par-momo" });
  const res = await callRoute(initiate, {
    method: "POST",
    path: "/api/payments/initiate",
    body: { amount: 50000, feeId, studentId, provider: "MOMO", payerPhone: "0190000000" },
  });
  expect(res.status).toBe(200);
  const externalId = initiatePayment.mock.calls.at(-1)?.[3] as string;
  return { paymentId: (res.body as { paymentId: string }).paymentId, externalId };
}

async function deliverWebhook(event: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(event);
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  return callRoute(momoWebhook, {
    method: "POST",
    path: "/api/payments/momo/webhook",
    rawBody: raw,
    headers: { "x-momo-signature": signature },
  });
}

function successEvent(externalId: string) {
  return { financialTransactionId: "9876543210", externalId, amount: "50000", currency: "XOF", status: "SUCCESSFUL" };
}

beforeAll(async () => {
  process.env.MOMO_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const school = await createSchool("IT-N7");
  schoolId = school.id;
  const user = await prisma.user.create({
    data: {
      email: `${uniqueCode("eleve")}@integration.test`,
      password: "non-utilise",
      firstName: "Awa",
      lastName: "Test",
      role: "STUDENT",
      schoolId,
    },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId },
  });
  studentId = student.id;
  actAs(sessionFor("ACCOUNTANT", schoolId));
});

describe("N7 — paiement Mobile Money : initiation → webhook signé → VERIFIED", () => {
  it("rapproche le paiement confirmé par MoMo", async () => {
    const { paymentId, externalId } = await initiateMomo(await newFee());

    const hook = await deliverWebhook(successEvent(externalId));

    expect(hook.status).toBe(200);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("VERIFIED");
    expect(payment.reference).toBe(externalId);
    expect(payment.paidAt).not.toBeNull();
  });

  it("un webhook rejoué ne modifie plus le paiement (idempotence)", async () => {
    const { paymentId, externalId } = await initiateMomo(await newFee());
    await deliverWebhook(successEvent(externalId));
    const first = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    const replay = await deliverWebhook(successEvent(externalId));

    expect(replay.status).toBe(200);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.status).toBe("VERIFIED");
    expect(after.paidAt?.getTime()).toBe(first.paidAt?.getTime());
    expect(after.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it("refuse un webhook à la signature invalide sans toucher au paiement", async () => {
    const { paymentId, externalId } = await initiateMomo(await newFee());

    const forged = await deliverWebhook(successEvent(externalId), "mauvais-secret");

    expect(forged.status).toBe(401);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PENDING");
  });
});
