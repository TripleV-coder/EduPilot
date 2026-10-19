import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { getFeeBalance } from "@/lib/finance/online-payments";

/**
 * Lot S3, reprise d'un essai (revue S3) — la reprise d'une même demande dans
 * les 5 minutes réassociait l'essai en attente au fournisseur demandé et le
 * renvoyait : chez un autre fournisseur, la confirmation authentique du
 * premier était ensuite refusée par S3 ; chez le même, une seconde transaction
 * était créée pour la même dette. La route FedaPay dédiée réattribuait de
 * même un paiement déjà confié à MoMo. Seuls les appels HTTP aux fournisseurs
 * sont simulés (ils enregistrent qui est appelé).
 *
 * Depuis S7, un nouvel essai part sur le compte FedaPay de l'école ; MoMo direct
 * (compte global) n'encaisse plus. Les essais MoMo HISTORIQUES encore en
 * attente gardent la même protection : la reprise chez FedaPay est refusée.
 */
const { providerCalls } = vi.hoisted(() => ({ providerCalls: vi.fn() }));
// S7 : client FedaPay du compte de l'école (simulé, enregistre l'appel)
vi.mock("@/lib/payments/fedapay-account-client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/payments/fedapay-account-client")>()),
    createAccountCheckout: async (_credentials: unknown, params: { amount: number; reference: string; customer: { email: string } }) => {
        const r = (await providerCalls("FEDAPAY", params.amount, "XOF", params.customer.email, params.reference)) as { paymentUrl: string; transactionId: string };
        return { url: r.paymentUrl, token: "", transactionId: r.transactionId };
    },
}));

import { POST as initiate } from "@/app/api/payments/initiate/route";
import { POST as fedapayInitiate } from "@/app/api/payments/fedapay/initiate/route";
import { POST as momoWebhook } from "@/app/api/payments/momo/webhook/route";
import { INIT_UNCERTAIN_NOTE } from "@/lib/finance/providers/init-error";
import { ensureActiveSchoolAccount } from "./fixtures/payment-account";

const MOMO_SECRET = "integration-s3-retry-momo-secret";
let schoolId: string;
let studentId: string;
let accountantId: string;

const newFee = async () => (await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount: 50000 } })).id;
const start = (feeId: string, provider: "MOMO" | "FEDAPAY" | "MTN", amount = 20000) =>
    callRoute(initiate, { method: "POST", path: "/api/payments/initiate", body: { amount, feeId, studentId, provider, payerPhone: "0190000000" } });
const attempts = (feeId: string) => prisma.payment.findMany({ where: { feeId, studentId }, orderBy: { createdAt: "asc" } });
const calledProviders = () => providerCalls.mock.calls.map((c) => c[0]);
const balance = (feeId: string) => runAsSystem("test:s3-retry", () => prisma.$transaction((tx) => getFeeBalance(tx, studentId, feeId)));

/** Essai MoMo antérieur à S7 (compte global), tel qu'il reste en base. */
const historicalMomo = (feeId: string, extra: { status?: "PENDING" | "EXPIRED"; notes?: string; providerTransactionId?: string } = {}) =>
    prisma.payment.create({
        data: {
            studentId, feeId, amount: 20000, method: "MOBILE_MONEY_MTN", status: extra.status ?? "PENDING", provider: "MOMO",
            reference: `PAY-${uniqueCode("HIST")}`, providerTransactionId: extra.providerTransactionId ?? uniqueCode("momo-ref"),
            notes: extra.notes ?? null,
        },
    });

async function momoSuccess(reference: string) {
    const raw = JSON.stringify({ financialTransactionId: uniqueCode("MTN"), externalId: reference, amount: "20000", currency: "XOF", status: "SUCCESSFUL" });
    actAs(null);
    try {
        return await callRoute(momoWebhook, {
            method: "POST", path: "/api/payments/momo/webhook", rawBody: raw,
            headers: { "x-momo-signature": createHmac("sha256", MOMO_SECRET).update(raw).digest("hex") },
        });
    } finally {
        actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
    }
}

beforeAll(async () => {
    process.env.MOMO_WEBHOOK_SECRET = MOMO_SECRET;
    schoolId = (await createSchool("IT-S3R")).id;
    await ensureActiveSchoolAccount(schoolId);
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "S3R", role: "STUDENT", schoolId },
    });
    studentId = (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
    accountantId = (await prisma.user.create({
        data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "S3R", role: "ACCOUNTANT", schoolId },
    })).id;
});
afterAll(() => {
    delete process.env.MOMO_WEBHOOK_SECRET;
});
beforeEach(() => {
    actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
    providerCalls.mockReset();
    providerCalls.mockImplementation(async (type: string) => ({ paymentUrl: "", transactionId: uniqueCode(`${type}-ref`) }));
});

describe("Reprise d'un essai MoMo historique vers FedaPay", () => {
    it("essai MoMo en attente, reprise chez FedaPay : 409, FedaPay non appelé, essai, fournisseur, identifiant et solde inchangés", async () => {
        const feeId = await newFee();
        const before = await historicalMomo(feeId);
        const balanceBefore = await balance(feeId);

        const retry = await start(feeId, "FEDAPAY");

        expect(retry.status).toBe(409);
        expect(retry.body).toMatchObject({ code: "PAYMENT_PROVIDER_CONFLICT", paymentId: before.id });
        expect(calledProviders()).toEqual([]);
        const after = await attempts(feeId);
        expect(after).toHaveLength(1);
        expect([after[0].status, after[0].provider, after[0].providerTransactionId, after[0].reference, after[0].method, Number(after[0].amount)])
            .toEqual([before.status, "MOMO", before.providerTransactionId, before.reference, before.method, 20000]);
        expect(await balance(feeId)).toEqual(balanceBefore);
    });

    it("…et la confirmation authentique de MoMo, le fournisseur d'origine, est ensuite validée", async () => {
        const feeId = await newFee();
        const payment = await historicalMomo(feeId);
        await start(feeId, "FEDAPAY");

        expect((await momoSuccess(payment.reference!)).status).toBe(200);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
        expect([after.status, after.provider, after.providerTransactionId]).toEqual(["VERIFIED", "MOMO", payment.providerTransactionId]);
    });

    it("résultat incertain chez MoMo (réponse perdue) : la reprise chez FedaPay est refusée, rien n'est appelé", async () => {
        const feeId = await newFee();
        await historicalMomo(feeId, { notes: INIT_UNCERTAIN_NOTE, providerTransactionId: "momo-uuid-incertain" });

        const retry = await start(feeId, "FEDAPAY");

        expect(retry.status).toBe(409);
        expect(retry.body).toMatchObject({ code: "PAYMENT_INIT_UNCERTAIN" });
        expect(calledProviders()).toEqual([]);
        const [after] = await attempts(feeId);
        expect([after.status, after.provider, after.providerTransactionId]).toEqual(["PENDING", "MOMO", "momo-uuid-incertain"]);
    });

    it("refus prouvé avant envoi (essai EXPIRED) : la nouvelle tentative suit le parcours normal, nouvel essai chez FedaPay", async () => {
        const feeId = await newFee();
        const refused = await historicalMomo(feeId, { status: "EXPIRED" });

        const retry = await start(feeId, "FEDAPAY");

        expect(retry.status).toBe(200);
        const all = await attempts(feeId);
        const fresh = all.find((p) => p.id !== refused.id)!;
        expect([fresh.status, fresh.provider]).toEqual(["PENDING", "FEDAPAY"]);
        expect(fresh.reference).not.toBe(refused.reference);
        expect(calledProviders()).toEqual(["FEDAPAY"]);
    });

    it("nouvel essai MoMo direct : refusé (S7), aucun essai créé", async () => {
        const feeId = await newFee();
        expect((await start(feeId, "MOMO")).status).toBe(503);
        expect(await attempts(feeId)).toHaveLength(0);
        expect(calledProviders()).toEqual([]);
    });
});

describe("Reprise chez le même fournisseur", () => {
    it("pas de seconde demande de paiement chez le fournisseur : 409, un seul appel, identifiant conservé", async () => {
        const feeId = await newFee();
        expect((await start(feeId, "FEDAPAY")).status).toBe(200);
        const [before] = await attempts(feeId);

        const retry = await start(feeId, "MTN");

        expect(retry.status).toBe(409);
        expect(retry.body).toMatchObject({ code: "PAYMENT_ALREADY_STARTED", paymentId: before.id });
        expect(calledProviders()).toEqual(["FEDAPAY"]);
        const after = await attempts(feeId);
        expect(after).toHaveLength(1);
        expect(after[0].providerTransactionId).toBe(before.providerTransactionId);
    });
});

describe("Demandes concurrentes (PostgreSQL)", () => {
    it("deux demandes identiques simultanées : un seul essai, un seul appel au fournisseur", async () => {
        const feeId = await newFee();
        const results = await Promise.all([start(feeId, "FEDAPAY"), start(feeId, "MTN")]);

        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        const all = await attempts(feeId);
        expect(all).toHaveLength(1);
        expect(calledProviders()).toEqual(["FEDAPAY"]);
    });
});

describe("Route FedaPay dédiée", () => {
    it("paiement déjà confié à MoMo (historique) : 409, aucune transaction FedaPay, fournisseur et identifiant inchangés", async () => {
        const feeId = await newFee();
        const before = await historicalMomo(feeId);

        const res = await callRoute(fedapayInitiate, { method: "POST", path: "/api/payments/fedapay/initiate", body: { paymentId: before.id } });

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: "PAYMENT_PROVIDER_CONFLICT" });
        expect(calledProviders()).toEqual([]);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: before.id } });
        expect([after.provider, after.providerTransactionId, after.method, after.status]).toEqual(["MOMO", before.providerTransactionId, before.method, "PENDING"]);
    });

    it("paiement sans fournisseur : attribué une seule fois au compte de l'école ; le second lancement n'en crée pas d'autre", async () => {
        const feeId = await newFee();
        const payment = await prisma.payment.create({ data: { studentId, feeId, amount: 20000, method: "MOBILE_MONEY_MTN", status: "PENDING" } });
        providerCalls.mockResolvedValue({ paymentUrl: "https://sandbox.fedapay.com/checkout/x", transactionId: "4242" });
        const go = () => callRoute(fedapayInitiate, { method: "POST", path: "/api/payments/fedapay/initiate", body: { paymentId: payment.id } });

        expect((await go()).status).toBe(200);
        const second = await go();

        expect(second.status).toBe(409);
        expect(second.body).toMatchObject({ code: "PAYMENT_ALREADY_STARTED" });
        expect(calledProviders()).toEqual(["FEDAPAY"]);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
        expect([after.provider, after.providerTransactionId]).toEqual(["FEDAPAY", "4242"]);
        expect(after.paymentAccountId).not.toBeNull();
    });
});
