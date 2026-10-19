import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import prisma from "./owner-db";
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
// La route refuse (503) un rail non configuré ; le fournisseur est simulé ci-dessus.
vi.mock("@/lib/finance/providers/momo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/finance/providers/momo")>()),
  isMomoConfigured: () => true,
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

/**
 * Essai MoMo HISTORIQUE (antérieur à S7 : compte global, sans compte d'école).
 * Les nouveaux essais MoMo direct sont refusés aux écoles ; le webhook MoMo
 * global ne sert plus qu'à rapprocher ces essais-là.
 */
async function initiateMomo(feeId: string): Promise<{ paymentId: string; externalId: string }> {
  const externalId = `PAY-${uniqueCode("HIST")}`;
  const payment = await prisma.payment.create({
    data: {
      studentId, feeId, amount: 50000, method: "MOBILE_MONEY_MTN", status: "PENDING",
      provider: "MOMO", reference: externalId, providerTransactionId: "7f3c2a10-uuid-renvoye-par-momo",
    },
  });
  return { paymentId: payment.id, externalId };
}

/**
 * Le fournisseur n'a pas de session : le webhook est appelé anonymement, comme
 * en production. Avec la session du comptable (état antérieur de ce test), le
 * contexte d'établissement de la session masquait l'absence de contexte
 * système déclaré par la route (audit M2).
 */
async function deliverWebhook(event: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(event);
  const signature = createHmac("sha256", secret).update(raw).digest("hex");
  actAs(null);
  try {
    return await callRoute(momoWebhook, {
      method: "POST",
      path: "/api/payments/momo/webhook",
      rawBody: raw,
      headers: { "x-momo-signature": signature },
    });
  } finally {
    actAs(sessionFor("ACCOUNTANT", schoolId));
  }
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

describe("S7 — MoMo direct n'encaisse plus pour une école (compte global)", () => {
  it("nouvelle initiation MoMo : 503, aucun essai créé, fournisseur non appelé", async () => {
    const feeId = await newFee();
    const res = await callRoute(initiate, {
      method: "POST",
      path: "/api/payments/initiate",
      body: { amount: 50000, feeId, studentId, provider: "MOMO", payerPhone: "0190000000" },
    });
    expect(res.status).toBe(503);
    expect((res.body as { code: string }).code).toBe("ONLINE_PAYMENT_UNAVAILABLE");
    expect(await prisma.payment.count({ where: { feeId } })).toBe(0);
    expect(initiatePayment).not.toHaveBeenCalled();
  });
});

describe("N7 — essai MoMo historique : webhook signé → VERIFIED", () => {
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
