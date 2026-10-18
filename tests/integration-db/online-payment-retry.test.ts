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
 */
const { providerCalls, fedapayCheckout } = vi.hoisted(() => ({ providerCalls: vi.fn(), fedapayCheckout: vi.fn() }));
vi.mock("@/lib/finance/factory", () => ({
    PaymentProviderFactory: {
        getProvider: (type: string) => ({ initiatePayment: (...args: unknown[]) => providerCalls(type, ...args) }),
    },
}));
vi.mock("@/lib/finance/providers/momo", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/finance/providers/momo")>()),
    isMomoConfigured: () => true,
}));
vi.mock("@/lib/payments/fedapay", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/payments/fedapay")>()),
    isFedaPayConfigured: () => true,
    createFedaPayCheckout: fedapayCheckout,
}));

import { POST as initiate } from "@/app/api/payments/initiate/route";
import { POST as fedapayInitiate } from "@/app/api/payments/fedapay/initiate/route";
import { POST as momoWebhook } from "@/app/api/payments/momo/webhook/route";
import { ProviderInitError } from "@/lib/finance/providers/init-error";

const MOMO_SECRET = "integration-s3-retry-momo-secret";
let schoolId: string;
let studentId: string;
let accountantId: string;

const newFee = async () => (await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount: 50000 } })).id;
const start = (feeId: string, provider: "MOMO" | "FEDAPAY", amount = 20000) =>
    callRoute(initiate, { method: "POST", path: "/api/payments/initiate", body: { amount, feeId, studentId, provider, payerPhone: "0190000000" } });
const attempts = (feeId: string) => prisma.payment.findMany({ where: { feeId, studentId }, orderBy: { createdAt: "asc" } });
const calledProviders = () => providerCalls.mock.calls.map((c) => c[0]);
const balance = (feeId: string) => runAsSystem("test:s3-retry", () => prisma.$transaction((tx) => getFeeBalance(tx, studentId, feeId)));
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
    process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_integration_retry";
    process.env.FEDAPAY_ENVIRONMENT = "sandbox";
    schoolId = (await createSchool("IT-S3R")).id;
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
    delete process.env.FEDAPAY_SECRET_KEY;
    delete process.env.FEDAPAY_ENVIRONMENT;
});
beforeEach(() => {
    actAs(sessionFor("ACCOUNTANT", schoolId, accountantId));
    providerCalls.mockReset();
    providerCalls.mockImplementation(async (type: string) => ({ paymentUrl: "", transactionId: uniqueCode(`${type}-ref`) }));
    fedapayCheckout.mockReset();
});

describe("Reprise vers un autre fournisseur", () => {
    it("essai envoyé chez MoMo, reprise chez FedaPay : 409, FedaPay non appelé, essai, fournisseur, identifiant et solde inchangés", async () => {
        const feeId = await newFee();
        expect((await start(feeId, "MOMO")).status).toBe(200);
        const [before] = await attempts(feeId);
        const balanceBefore = await balance(feeId);

        const retry = await start(feeId, "FEDAPAY");

        expect(retry.status).toBe(409);
        expect(retry.body).toMatchObject({ code: "PAYMENT_PROVIDER_CONFLICT", paymentId: before.id });
        expect(calledProviders()).toEqual(["MOMO"]);
        const after = await attempts(feeId);
        expect(after).toHaveLength(1);
        expect([after[0].status, after[0].provider, after[0].providerTransactionId, after[0].reference, after[0].method, Number(after[0].amount)])
            .toEqual([before.status, "MOMO", before.providerTransactionId, before.reference, before.method, 20000]);
        expect(await balance(feeId)).toEqual(balanceBefore);
    });

    it("…et la confirmation authentique de MoMo, le fournisseur d'origine, est ensuite validée", async () => {
        const feeId = await newFee();
        await start(feeId, "MOMO");
        await start(feeId, "FEDAPAY");
        const [payment] = await attempts(feeId);

        expect((await momoSuccess(payment.reference!)).status).toBe(200);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
        expect([after.status, after.provider, after.providerTransactionId]).toEqual(["VERIFIED", "MOMO", payment.providerTransactionId]);
    });

    it("résultat incertain chez MoMo (réponse perdue) : la reprise chez FedaPay est refusée, rien n'est appelé", async () => {
        const feeId = await newFee();
        providerCalls.mockRejectedValueOnce(new ProviderInitError("réponse perdue", "UNKNOWN", "momo-uuid-incertain"));
        expect((await start(feeId, "MOMO")).status).toBe(502);

        const retry = await start(feeId, "FEDAPAY");

        expect(retry.status).toBe(409);
        expect(retry.body).toMatchObject({ code: "PAYMENT_INIT_UNCERTAIN" });
        expect(calledProviders()).toEqual(["MOMO"]);
        const [after] = await attempts(feeId);
        expect([after.status, after.provider, after.providerTransactionId]).toEqual(["PENDING", "MOMO", "momo-uuid-incertain"]);
    });

    it("refus prouvé avant envoi (essai EXPIRED) : la nouvelle tentative suit le parcours normal, nouvel essai chez FedaPay", async () => {
        const feeId = await newFee();
        providerCalls.mockRejectedValueOnce(new ProviderInitError("jeton refusé, jamais envoyé", "REFUSED"));
        await start(feeId, "MOMO");

        const retry = await start(feeId, "FEDAPAY");

        expect(retry.status).toBe(200);
        const [refused, fresh] = await attempts(feeId);
        expect([refused.status, refused.provider]).toEqual(["EXPIRED", "MOMO"]);
        expect([fresh.status, fresh.provider]).toEqual(["PENDING", "FEDAPAY"]);
        expect(fresh.reference).not.toBe(refused.reference);
        expect(calledProviders()).toEqual(["MOMO", "FEDAPAY"]);
    });
});

describe("Reprise chez le même fournisseur", () => {
    it("pas de seconde demande de paiement chez le fournisseur : 409, un seul appel, identifiant conservé", async () => {
        const feeId = await newFee();
        expect((await start(feeId, "MOMO")).status).toBe(200);
        const [before] = await attempts(feeId);

        const retry = await start(feeId, "MOMO");

        expect(retry.status).toBe(409);
        expect(retry.body).toMatchObject({ code: "PAYMENT_ALREADY_STARTED", paymentId: before.id });
        expect(calledProviders()).toEqual(["MOMO"]);
        const after = await attempts(feeId);
        expect(after).toHaveLength(1);
        expect(after[0].providerTransactionId).toBe(before.providerTransactionId);
    });
});

describe("Demandes concurrentes (PostgreSQL)", () => {
    it("MoMo et FedaPay en même temps : un seul essai, un seul fournisseur appelé, jamais réassocié", async () => {
        const feeId = await newFee();
        const results = await Promise.all([start(feeId, "MOMO"), start(feeId, "FEDAPAY")]);

        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        const refused = results.find((r) => r.status === 409)!;
        expect(refused.body).toMatchObject({ code: "PAYMENT_PROVIDER_CONFLICT" });
        const all = await attempts(feeId);
        expect(all).toHaveLength(1);
        expect(calledProviders()).toEqual([all[0].provider]);
    });
});

describe("Route FedaPay dédiée", () => {
    it("paiement déjà confié à MoMo : 409, aucune transaction FedaPay, fournisseur et identifiant inchangés", async () => {
        const feeId = await newFee();
        await start(feeId, "MOMO");
        const [before] = await attempts(feeId);

        const res = await callRoute(fedapayInitiate, { method: "POST", path: "/api/payments/fedapay/initiate", body: { paymentId: before.id } });

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: "PAYMENT_PROVIDER_CONFLICT" });
        expect(fedapayCheckout).not.toHaveBeenCalled();
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: before.id } });
        expect([after.provider, after.providerTransactionId, after.method, after.status]).toEqual(["MOMO", before.providerTransactionId, before.method, "PENDING"]);
    });

    it("paiement sans fournisseur : attribué une seule fois ; le second lancement n'en crée pas d'autre", async () => {
        const feeId = await newFee();
        const payment = await prisma.payment.create({ data: { studentId, feeId, amount: 20000, method: "MOBILE_MONEY_MTN", status: "PENDING" } });
        fedapayCheckout.mockResolvedValue({ url: "https://sandbox.fedapay.com/checkout/x", token: "t", transactionId: "4242" });
        const go = () => callRoute(fedapayInitiate, { method: "POST", path: "/api/payments/fedapay/initiate", body: { paymentId: payment.id } });

        expect((await go()).status).toBe(200);
        const second = await go();

        expect(second.status).toBe(409);
        expect(second.body).toMatchObject({ code: "PAYMENT_ALREADY_STARTED" });
        expect(fedapayCheckout).toHaveBeenCalledTimes(1);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
        expect([after.provider, after.providerTransactionId]).toEqual(["FEDAPAY", "4242"]);
    });
});
