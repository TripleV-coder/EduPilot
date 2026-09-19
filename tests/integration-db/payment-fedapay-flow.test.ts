import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 7 — parcours FedaPay complet contre une vraie base, en bac à sable :
 * initiation → webhook signé → VERIFIED, puis rejeu (idempotence), signature
 * forgée, et refus d'une configuration d'argent réel non autorisée (règle 11).
 *
 * Seul l'appel HTTP au fournisseur est simulé : la **signature du webhook est
 * vérifiée par le vrai code du SDK** (`Webhook.constructEvent`), les routes,
 * Prisma et l'état des paiements sont réels. Aucune clé de production n'est
 * nécessaire, et aucune ne peut être utilisée par mégarde.
 */
const { transactionCreate } = vi.hoisted(() => ({ transactionCreate: vi.fn() }));

vi.mock("fedapay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fedapay")>();
  return {
    ...actual,
    // Le réseau est coupé ; la vérification de signature (Webhook) reste réelle.
    FedaPay: { setApiKey: vi.fn(), setEnvironment: vi.fn() },
    Transaction: { create: transactionCreate },
  };
});

const { Webhook } = await import("fedapay");
const { POST: initiate } = await import("@/app/api/payments/fedapay/initiate/route");
const { POST: fedapayWebhook } = await import("@/app/api/payments/fedapay/webhook/route");

const WEBHOOK_SECRET = "integration-fedapay-webhook-secret";

let schoolId: string;
let studentId: string;
let accountantId: string;

async function newPendingPayment(): Promise<string> {
  const fee = await prisma.fee.create({
    data: { schoolId, name: `Scolarité ${uniqueCode("F")}`, amount: 50000 },
  });
  const payment = await prisma.payment.create({
    data: { studentId, feeId: fee.id, amount: 50000, method: "MOBILE_MONEY_MTN", status: "PENDING" },
  });
  return payment.id;
}

/** Initie le paiement ; renvoie la référence transmise à FedaPay. */
async function initiateFedaPay(paymentId: string): Promise<string> {
  transactionCreate.mockResolvedValueOnce({
    id: 4242,
    generateToken: async () => ({ token: "tok_test", url: "https://sandbox.fedapay.com/checkout/tok_test" }),
  });

  const res = await callRoute(initiate, {
    method: "POST",
    path: "/api/payments/fedapay/initiate",
    body: { paymentId },
  });

  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return (res.body as { reference: string }).reference;
}

/**
 * Le fournisseur n'a pas de session : le webhook est appelé anonymement, comme
 * en production — c'est aussi ce qui vérifie que la route déclare bien son
 * contexte système (audit M2).
 */
async function deliverWebhook(event: Record<string, unknown>, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(event);
  const header = Webhook.generateTestHeaderString({ payload: raw, secret });
  actAs(null);
  try {
    return await callRoute(fedapayWebhook, {
      method: "POST",
      path: "/api/payments/fedapay/webhook",
      rawBody: raw,
      headers: { "x-fedapay-signature": header },
    });
  } finally {
    actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
  }
}

function approvedEvent(reference: string) {
  return {
    name: "transaction.approved",
    entity: { id: 4242, status: "approved", merchant_reference: reference, amount: 50000 },
  };
}

beforeAll(async () => {
  process.env.FEDAPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_integration";
  process.env.FEDAPAY_ENVIRONMENT = "sandbox";

  const school = await createSchool("IT-FEDA");
  schoolId = school.id;

  const studentUser = await prisma.user.create({
    data: {
      email: `${uniqueCode("eleve")}@integration.test`,
      password: "non-utilise",
      firstName: "Koffi",
      lastName: "Test",
      role: "STUDENT",
      schoolId,
    },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: studentUser.id, matricule: uniqueCode("MAT"), schoolId },
  });
  studentId = student.id;

  // L'initiation lit l'email du payeur en base : le comptable doit exister.
  const accountant = await prisma.user.create({
    data: {
      email: `${uniqueCode("compta")}@integration.test`,
      password: "non-utilise",
      firstName: "Aline",
      lastName: "Compta",
      role: "ACCOUNTANT",
      schoolId,
    },
  });
  accountantId = accountant.id;
  actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
});

beforeEach(() => {
  delete process.env.PAYMENTS_LIVE_ENABLED;
  process.env.FEDAPAY_ENVIRONMENT = "sandbox";
  process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_integration";
  transactionCreate.mockClear();
});

describe("Lot 7 — FedaPay : initiation → webhook signé → VERIFIED", () => {
  it("rapproche le paiement confirmé par FedaPay", async () => {
    const paymentId = await newPendingPayment();
    const reference = await initiateFedaPay(paymentId);

    const hook = await deliverWebhook(approvedEvent(reference));

    expect(hook.status, JSON.stringify(hook.body)).toBe(200);
    expect((hook.body as { reconciled: number }).reconciled).toBe(1);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("VERIFIED");
    expect(payment.paidAt).not.toBeNull();
    expect(payment.reconciledAt).not.toBeNull();
  });

  it("un webhook rejoué ne modifie plus le paiement (idempotence)", async () => {
    const paymentId = await newPendingPayment();
    const reference = await initiateFedaPay(paymentId);
    await deliverWebhook(approvedEvent(reference));
    const first = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    const replay = await deliverWebhook(approvedEvent(reference));

    expect(replay.status).toBe(200);
    expect((replay.body as { reconciled: number }).reconciled).toBe(0);
    const after = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(after.paidAt?.getTime()).toBe(first.paidAt?.getTime());
    expect(after.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it("refuse une signature forgée sans toucher au paiement", async () => {
    const paymentId = await newPendingPayment();
    const reference = await initiateFedaPay(paymentId);

    const forged = await deliverWebhook(approvedEvent(reference), "mauvais-secret");

    expect(forged.status).toBe(401);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PENDING");
  });

  it("annule le paiement sur transaction.canceled", async () => {
    const paymentId = await newPendingPayment();
    const reference = await initiateFedaPay(paymentId);

    const hook = await deliverWebhook({
      name: "transaction.canceled",
      entity: { id: 4243, status: "canceled", merchant_reference: reference },
    });

    expect(hook.status).toBe(200);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("CANCELLED");
  });
});

describe("Lot 7 (règle 11) — aucune activation d'argent réel par inadvertance", () => {
  it("refuse l'initiation quand la configuration vise la production sans autorisation", async () => {
    const paymentId = await newPendingPayment();
    process.env.FEDAPAY_ENVIRONMENT = "live";
    process.env.FEDAPAY_SECRET_KEY = "sk_live_integration";

    const res = await callRoute(initiate, {
      method: "POST",
      path: "/api/payments/fedapay/initiate",
      body: { paymentId },
    });

    expect(res.status).toBe(503);
    expect((res.body as { code: string }).code).toBe("PAYMENTS_LIVE_DISABLED");
    // Rien n'a été envoyé au fournisseur, le paiement est intact.
    expect(transactionCreate).not.toHaveBeenCalled();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PENDING");
    expect(payment.reference).toBeNull();
  });
});
