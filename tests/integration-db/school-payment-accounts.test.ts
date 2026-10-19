import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Clé maîtresse SYNTHÉTIQUE des comptes marchands, lue au chargement des modules
vi.hoisted(() => {
    process.env.PAYMENT_SECRETS_KEY = "ab".repeat(32);
    delete process.env.PAYMENTS_LIVE_ENABLED;
});

import { Webhook } from "fedapay";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as initiate } from "@/app/api/payments/initiate/route";
import { POST as accountWebhook } from "@/app/api/payments/fedapay/webhook/[accountId]/route";
import { POST as globalWebhook } from "@/app/api/payments/fedapay/webhook/route";
import { GET as listAccounts, POST as createAccount } from "@/app/api/schools/[id]/payment-accounts/route";
import { POST as accountAction } from "@/app/api/schools/[id]/payment-accounts/[accountId]/route";
import { GET as onlineStatus } from "@/app/api/payments/online-status/route";
import { reconcileStalePayments } from "@/lib/finance/online-payments";
import { verifyOnSchoolAccount } from "@/lib/payments/school-accounts";
import { runAsSystem } from "@/lib/db/db-context";

/**
 * S7 (ADR-0011) — comptes marchands indépendants par école, sur un vrai
 * PostgreSQL. Deux écoles avec chacune SON compte FedaPay (clés synthétiques),
 * une école sans compte. Le fournisseur est simulé (`fetch`) : on vérifie quelle
 * clé part à chaque appel. Aucun paiement réel.
 */
interface SchoolFixture {
    schoolId: string;
    adminId: string;
    parentId: string;
    studentId: string;
    feeId: string;
    secretKey: string;
    webhookSecret: string;
    accountId?: string;
}
const fx = {} as Record<"A" | "B" | "C", SchoolFixture>;

const as = (role: UserRole, schoolId: string, userId: string): Session => sessionFor(role, schoolId, userId);
const admin = (k: "A" | "B" | "C") => as("SCHOOL_ADMIN", fx[k].schoolId, fx[k].adminId);
const parent = (k: "A" | "B" | "C") => as("PARENT", fx[k].schoolId, fx[k].parentId);
const text = (v: unknown) => JSON.stringify(v);

// ── Fournisseur simulé : enregistre la clé utilisée à chaque appel ──
const calls: Array<{ url: string; auth: string | null; body: unknown }> = [];
let txSeq = 1000;
const txAmount = new Map<string, number>();
let fedapayStatus: Record<string, string> = {};
const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get("authorization");
    calls.push({ url, auth, body: init?.body ? JSON.parse(String(init.body)) : null });
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/transactions") && init?.method === "POST") {
        const id = ++txSeq;
        txAmount.set(String(id), (JSON.parse(String(init.body)) as { amount: number }).amount);
        return ok({ "v1/transaction": { id, status: "pending" } });
    }
    if (url.includes("/token")) return ok({ token: "tok", url: "https://checkout.fedapay.test/pay" });
    if (url.includes("/transactions?per_page=1")) return ok({ "v1/transactions": [] });
    const id = url.split("/transactions/")[1];
    return ok({ "v1/transaction": { id: Number(id), status: fedapayStatus[id] ?? "pending", amount: txAmount.get(id) ?? null } });
});

async function schoolFixture(label: string): Promise<SchoolFixture> {
    const school = await createSchool(`S7-${label}`);
    const user = (role: UserRole, who: string) =>
        prisma.user.create({ data: { email: `${uniqueCode(`s7-${label}-${who}`)}@integration.test`.toLowerCase(), password: "x", firstName: who, lastName: label, role, schoolId: school.id } });
    const adminUser = await user("SCHOOL_ADMIN", "admin");
    const studentUser = await user("STUDENT", "eleve");
    const parentUser = await user("PARENT", "parent");
    const student = await prisma.studentProfile.create({ data: { userId: studentUser.id, schoolId: school.id, matricule: uniqueCode("S7") } });
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parentUser.id, updatedAt: new Date() } });
    await prisma.parentStudent.create({ data: { parentId: parentProfile.id, studentId: student.id, relationship: "PARENT" } });
    const fee = await prisma.fee.create({ data: { schoolId: school.id, name: `Scolarité ${label}`, amount: 500000 } });
    return {
        schoolId: school.id, adminId: adminUser.id, parentId: parentUser.id, studentId: student.id, feeId: fee.id,
        secretKey: `sk_sandbox_ecole_${label}_${uniqueCode("cle")}`,
        webhookSecret: `wh_ecole_${label}_${uniqueCode("secret")}`,
    };
}

/** Création → test → activation par l'administrateur de l'école, via les vraies routes. */
async function configureAccount(k: "A" | "B") {
    actAs(admin(k));
    const created = await callRoute(createAccount, {
        method: "POST", path: `/api/schools/${fx[k].schoolId}/payment-accounts`, params: { id: fx[k].schoolId },
        body: { environment: "SANDBOX", secretKey: fx[k].secretKey, webhookSecret: fx[k].webhookSecret },
    });
    expect(created.status).toBe(201);
    const accountId = (created.body as { data: { id: string } }).data.id;
    for (const action of ["verify", "activate"]) {
        const res = await callRoute(accountAction, {
            method: "POST", path: `/api/schools/${fx[k].schoolId}/payment-accounts/${accountId}`,
            params: { id: fx[k].schoolId, accountId }, body: { action },
        });
        expect(res.status, action).toBe(200);
    }
    fx[k].accountId = accountId;
}

// Montant distinct à chaque essai : la même demande répétée dans les 5 minutes
// est volontairement refusée (garde anti-doublon S3, 409)
let amountSeq = 5000;
async function initiateFor(k: "A" | "B" | "C", provider = "MTN", amount = ++amountSeq) {
    actAs(parent(k));
    return callRoute(initiate, { method: "POST", path: "/api/payments/initiate", body: { amount, feeId: fx[k].feeId, studentId: fx[k].studentId, provider } });
}

function signed(payload: object, secret: string) {
    const raw = JSON.stringify(payload);
    return { raw, header: Webhook.generateTestHeaderString({ payload: raw, secret }) };
}
async function sendWebhook(accountId: string, payload: object, secret: string) {
    const { raw, header } = signed(payload, secret);
    return callRoute(accountWebhook, {
        method: "POST", path: `/api/payments/fedapay/webhook/${accountId}`, params: { accountId },
        rawBody: raw, headers: { "x-fedapay-signature": header },
    });
}
const approved = (payment: { reference: string | null; providerTransactionId: string | null; amount: unknown }, amount = Number(payment.amount)) => ({
    name: "transaction.approved",
    entity: { id: Number(payment.providerTransactionId), merchant_reference: payment.reference, amount, currency: { iso: "XOF" } },
});

beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    fx.A = await schoolFixture("A");
    fx.B = await schoolFixture("B");
    fx.C = await schoolFixture("C");
    await configureAccount("A");
    await configureAccount("B");
});
afterAll(() => {
    vi.unstubAllGlobals();
});
beforeEach(() => {
    calls.length = 0;
});

describe("Initiation : le compte de l'école du frais, jamais un autre", () => {
    it("parent de A : transaction créée avec la clé de A, paiement lié au compte de A", async () => {
        const res = await initiateFor("A");
        expect(res.status).toBe(200);
        const creation = calls.find((c) => c.url.endsWith("/transactions"))!;
        expect(creation.url).toBe("https://sandbox-api.fedapay.com/v1/transactions");
        expect(calls.every((c) => c.auth === `Bearer ${fx.A.secretKey}`)).toBe(true);
        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: (res.body as { paymentId: string }).paymentId } });
        expect(payment.paymentAccountId).toBe(fx.A.accountId);
        expect(payment.provider).toBe("FEDAPAY");
        expect(creation.body).toMatchObject({ merchant_reference: payment.reference, currency: { iso: "XOF" } });
    });

    it("parent de B : clé de B, compte de B — aucune clé de A", async () => {
        const res = await initiateFor("B");
        expect(res.status).toBe(200);
        expect(calls.length).toBeGreaterThan(0);
        expect(calls.every((c) => c.auth === `Bearer ${fx.B.secretKey}`)).toBe(true);
        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: (res.body as { paymentId: string }).paymentId } });
        expect(payment.paymentAccountId).toBe(fx.B.accountId);
    });

    it("école C sans compte : 503 ONLINE_PAYMENT_UNAVAILABLE, message économat, aucun paiement, aucun appel au fournisseur", async () => {
        const before = await prisma.payment.count({ where: { studentId: fx.C.studentId } });
        const res = await initiateFor("C");
        expect(res.status).toBe(503);
        expect(res.body).toMatchObject({ code: "ONLINE_PAYMENT_UNAVAILABLE" });
        expect(text(res.body)).toContain("économat");
        expect(calls).toHaveLength(0);
        expect(await prisma.payment.count({ where: { studentId: fx.C.studentId } })).toBe(before);
    });

    it("fournisseurs sans compte par école (MoMo direct, Flutterwave, Paystack) : refusés, aucune écriture", async () => {
        const before = await prisma.payment.count({ where: { studentId: fx.A.studentId } });
        for (const provider of ["MOMO", "FLUTTERWAVE", "PAYSTACK"]) {
            const res = await initiateFor("A", provider);
            expect(res.status, provider).toBe(503);
        }
        expect(calls).toHaveLength(0);
        expect(await prisma.payment.count({ where: { studentId: fx.A.studentId } })).toBe(before);
    });

    it("chiffré de A recopié dans un compte de C : illisible, paiement en ligne indisponible pour C", async () => {
        const a = await prisma.schoolPaymentAccount.findUniqueOrThrow({ where: { id: fx.A.accountId! } });
        const copy = await prisma.schoolPaymentAccount.create({
            data: {
                schoolId: fx.C.schoolId, environment: "SANDBOX", status: "ACTIVE", secretKeyCiphertext: a.secretKeyCiphertext,
                webhookSecretCiphertext: a.webhookSecretCiphertext, encryptionKeyVersion: 1, secretKeyLast4: "XXXX",
            },
        });
        const res = await initiateFor("C");
        expect(res.status).toBe(503);
        expect(calls).toHaveLength(0);
        await prisma.schoolPaymentAccount.update({ where: { id: copy.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    });

    it("compte LIVE actif alors que l'argent réel n'est pas autorisé : jamais utilisé", async () => {
        const liveSchool = await schoolFixture("L");
        await prisma.schoolPaymentAccount.create({
            data: { schoolId: liveSchool.schoolId, environment: "LIVE", status: "ACTIVE", secretKeyCiphertext: "v1:00", webhookSecretCiphertext: "v1:00", encryptionKeyVersion: 1, secretKeyLast4: "LIVE" },
        });
        actAs(as("PARENT", liveSchool.schoolId, liveSchool.parentId));
        const res = await callRoute(initiate, { method: "POST", path: "/api/payments/initiate", body: { amount: 5000, feeId: liveSchool.feeId, studentId: liveSchool.studentId, provider: "MTN" } });
        expect(res.status).toBe(503);
        expect(calls).toHaveLength(0);
    });
});

describe("Webhooks par compte", () => {
    async function pendingPayment(k: "A" | "B") {
        const res = await initiateFor(k);
        expect(res.status).toBe(200);
        return prisma.payment.findUniqueOrThrow({ where: { id: (res.body as { paymentId: string }).paymentId } });
    }

    it("compte A, secret de A, paiement de A : confirmé ; rejoué : déjà traité", async () => {
        const p = await pendingPayment("A");
        const res = await sendWebhook(fx.A.accountId!, approved(p), fx.A.webhookSecret);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ outcome: "CONFIRMED" });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("VERIFIED");
        const replay = await sendWebhook(fx.A.accountId!, approved(p), fx.A.webhookSecret);
        expect(replay.body).toMatchObject({ outcome: "ALREADY_PROCESSED" });
    });

    it("adresse de A signée avec le secret de B : 401, rien ne change", async () => {
        const p = await pendingPayment("A");
        const res = await sendWebhook(fx.A.accountId!, approved(p), fx.B.webhookSecret);
        expect(res.status).toBe(401);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    });

    it("compte A authentique visant un paiement de B : refusé, B inchangé (ni validé ni annulé)", async () => {
        const pb = await pendingPayment("B");
        const confirm = await sendWebhook(fx.A.accountId!, approved(pb), fx.A.webhookSecret);
        expect(confirm.status).toBe(200);
        expect(confirm.body).toMatchObject({ outcome: "REJECTED" });
        const cancel = await sendWebhook(fx.A.accountId!, { name: "transaction.canceled", entity: { id: 1, merchant_reference: pb.reference } }, fx.A.webhookSecret);
        expect(cancel.body).toMatchObject({ cancelled: 0 });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: pb.id } })).status).toBe("PENDING");
    });

    it("ancienne route globale : ne valide pas un paiement lié au compte d'une école", async () => {
        const p = await pendingPayment("A");
        process.env.FEDAPAY_WEBHOOK_SECRET = "wh_global_synthetique";
        try {
            const { raw, header } = signed(approved(p), "wh_global_synthetique");
            const res = await callRoute(globalWebhook, { method: "POST", path: "/api/payments/fedapay/webhook", rawBody: raw, headers: { "x-fedapay-signature": header } });
            expect(res.body).toMatchObject({ outcome: "REJECTED" });
        } finally {
            delete process.env.FEDAPAY_WEBHOOK_SECRET;
        }
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PENDING");
    });

    it("montant différent : non validé (à rapprocher)", async () => {
        const p = await pendingPayment("A");
        const res = await sendWebhook(fx.A.accountId!, approved(p, Number(p.amount) - 1000), fx.A.webhookSecret);
        expect(res.body).toMatchObject({ outcome: "MISMATCH" });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).not.toBe("VERIFIED");
    });

    it("deux confirmations simultanées : une seule validation", async () => {
        const p = await pendingPayment("A");
        const [r1, r2] = await Promise.all([
            sendWebhook(fx.A.accountId!, approved(p), fx.A.webhookSecret),
            sendWebhook(fx.A.accountId!, approved(p), fx.A.webhookSecret),
        ]);
        const outcomes = [r1.body, r2.body].map((b) => (b as { outcome: string }).outcome).sort();
        expect(outcomes).toEqual(["ALREADY_PROCESSED", "CONFIRMED"]);
    });

    it("compte inconnu : 404", async () => {
        const res = await sendWebhook("compte-inexistant", { name: "transaction.approved", entity: {} }, "x");
        expect(res.status).toBe(404);
    });
});

describe("Garde-fous en base", () => {
    it("paiement lié au compte d'une autre école que celle du frais : refusé", async () => {
        await expect(prisma.payment.create({
            data: { studentId: fx.A.studentId, feeId: fx.A.feeId, amount: 100, method: "MOBILE_MONEY_MTN", paymentAccountId: fx.B.accountId, reference: uniqueCode("R") },
        })).rejects.toThrow(/compte marchand doit appartenir/);
    });

    it("lien paiement → compte non modifiable une fois posé", async () => {
        const p = await prisma.payment.findFirstOrThrow({ where: { paymentAccountId: fx.A.accountId } });
        await expect(prisma.payment.update({ where: { id: p.id }, data: { paymentAccountId: null } })).rejects.toThrow(/n'est pas modifiable/);
    });

    it("compte : école non modifiable ; deux comptes actifs refusés ; révoqué non réactivable", async () => {
        await expect(prisma.schoolPaymentAccount.update({ where: { id: fx.A.accountId! }, data: { schoolId: fx.B.schoolId } })).rejects.toThrow(/non modifiables/);
        const extra = await prisma.schoolPaymentAccount.create({
            data: { schoolId: fx.A.schoolId, environment: "SANDBOX", status: "INACTIVE", secretKeyCiphertext: "v1:0", webhookSecretCiphertext: "v1:0", encryptionKeyVersion: 1, secretKeyLast4: "0000" },
        });
        await expect(prisma.schoolPaymentAccount.update({ where: { id: extra.id }, data: { status: "ACTIVE" } })).rejects.toThrow(/Unique constraint/i);
        await prisma.schoolPaymentAccount.update({ where: { id: extra.id }, data: { status: "REVOKED" } });
        await expect(prisma.schoolPaymentAccount.update({ where: { id: extra.id }, data: { status: "INACTIVE" } })).rejects.toThrow(/révoqué/);
    });
});

describe("Administration des comptes", () => {
    it("administrateur de B : ni lecture ni création pour A", async () => {
        actAs(admin("B"));
        expect((await callRoute(listAccounts, { path: `/api/schools/${fx.A.schoolId}/payment-accounts`, params: { id: fx.A.schoolId } })).status).toBe(403);
        const before = await prisma.schoolPaymentAccount.count({ where: { schoolId: fx.A.schoolId } });
        const res = await callRoute(createAccount, {
            method: "POST", path: `/api/schools/${fx.A.schoolId}/payment-accounts`, params: { id: fx.A.schoolId },
            body: { environment: "SANDBOX", secretKey: "sk_sandbox_intrus_0000000", webhookSecret: "wh_intrus_000000000" },
        });
        expect(res.status).toBe(403);
        expect(await prisma.schoolPaymentAccount.count({ where: { schoolId: fx.A.schoolId } })).toBe(before);
    });

    it("lecture : vue masquée, aucun secret dans la réponse", async () => {
        actAs(admin("A"));
        const res = await callRoute(listAccounts, { path: `/api/schools/${fx.A.schoolId}/payment-accounts`, params: { id: fx.A.schoolId } });
        expect(res.status).toBe(200);
        expect(text(res.body)).not.toContain(fx.A.secretKey);
        expect(text(res.body)).not.toContain(fx.A.webhookSecret);
        expect(text(res.body)).not.toContain("Ciphertext");
        expect(text(res.body)).toContain(fx.A.secretKey.slice(-4));
    });

    it("direction : lecture permise, écriture refusée", async () => {
        const director = await prisma.user.create({ data: { email: `${uniqueCode("s7-dir")}@integration.test`, password: "x", firstName: "D", lastName: "A", role: "DIRECTOR", schoolId: fx.A.schoolId } });
        actAs(as("DIRECTOR", fx.A.schoolId, director.id));
        expect((await callRoute(listAccounts, { path: `/api/schools/${fx.A.schoolId}/payment-accounts`, params: { id: fx.A.schoolId } })).status).toBe(200);
        const res = await callRoute(accountAction, {
            method: "POST", path: `/api/schools/${fx.A.schoolId}/payment-accounts/${fx.A.accountId}`,
            params: { id: fx.A.schoolId, accountId: fx.A.accountId! }, body: { action: "revoke" },
        });
        expect(res.status).toBe(403);
        expect((await prisma.schoolPaymentAccount.findUniqueOrThrow({ where: { id: fx.A.accountId! } })).status).toBe("ACTIVE");
    });

    it("clé d'un autre environnement que celui déclaré : 400, rien d'enregistré", async () => {
        actAs(admin("A"));
        const before = await prisma.schoolPaymentAccount.count({ where: { schoolId: fx.A.schoolId } });
        const res = await callRoute(createAccount, {
            method: "POST", path: `/api/schools/${fx.A.schoolId}/payment-accounts`, params: { id: fx.A.schoolId },
            body: { environment: "SANDBOX", secretKey: "sk_live_mauvais_environnement", webhookSecret: "wh_synthetique_000000" },
        });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: "KEY_ENVIRONMENT_MISMATCH" });
        expect(await prisma.schoolPaymentAccount.count({ where: { schoolId: fx.A.schoolId } })).toBe(before);
    });

    it("activation sans test préalable : 409", async () => {
        actAs(admin("A"));
        const created = await callRoute(createAccount, {
            method: "POST", path: `/api/schools/${fx.A.schoolId}/payment-accounts`, params: { id: fx.A.schoolId },
            body: { environment: "SANDBOX", secretKey: `sk_sandbox_${uniqueCode("non_teste")}`, webhookSecret: "wh_synthetique_000000" },
        });
        const accountId = (created.body as { data: { id: string } }).data.id;
        const res = await callRoute(accountAction, {
            method: "POST", path: `/api/schools/${fx.A.schoolId}/payment-accounts/${accountId}`, params: { id: fx.A.schoolId, accountId }, body: { action: "activate" },
        });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: "ACCOUNT_NOT_VERIFIED" });
    });

    it("rotation : nouveau compte testé puis activé, l'ancien révoqué ; ses paiements restent rapprochables avec l'ancienne clé", async () => {
        const oldAccountId = fx.B.accountId!;
        const oldPayment = await prisma.payment.findFirstOrThrow({ where: { paymentAccountId: oldAccountId } });
        const previousKey = fx.B.secretKey;
        fx.B.secretKey = `sk_sandbox_ecole_B_${uniqueCode("rotation")}`;
        await configureAccount("B");
        expect(fx.B.accountId).not.toBe(oldAccountId);
        expect((await prisma.schoolPaymentAccount.findUniqueOrThrow({ where: { id: oldAccountId } })).status).toBe("REVOKED");
        calls.length = 0;
        expect((await initiateFor("B")).status).toBe(200);
        expect(calls.every((c) => c.auth === `Bearer ${fx.B.secretKey}`)).toBe(true);
        calls.length = 0;
        // Comme la maintenance quotidienne : contexte système déclaré
        await runAsSystem("test:reconcile", () => verifyOnSchoolAccount(oldAccountId, oldPayment.providerTransactionId!));
        expect(calls[0].auth).toBe(`Bearer ${previousKey}`);
    });

    it("journal d'audit des actions, sans secret", async () => {
        const rows = await prisma.auditLog.findMany({ where: { entity: "SchoolPaymentAccount", schoolId: fx.A.schoolId } });
        expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["PAYMENT_ACCOUNT_CREATED", "PAYMENT_ACCOUNT_VERIFIED", "PAYMENT_ACCOUNT_ACTIVATED"]));
        expect(text(rows)).not.toContain(fx.A.secretKey);
        expect(text(rows)).not.toContain(fx.A.webhookSecret);
    });
});

describe("Rapprochement et disponibilité", () => {
    it("paiement en attente de plus de 24 h : interrogé avec la clé de SON école, puis validé", async () => {
        const res = await initiateFor("A");
        const p = await prisma.payment.update({
            where: { id: (res.body as { paymentId: string }).paymentId },
            data: { createdAt: new Date(Date.now() - 25 * 3600 * 1000) },
        });
        fedapayStatus = { [p.providerTransactionId!]: "approved" };
        calls.length = 0;
        // Comme la maintenance quotidienne (runAsSystem("cron:daily-maintenance"))
        const report = await runAsSystem("test:reconcile", () => reconcileStalePayments(
            (_provider, transactionId, paymentAccountId) => verifyOnSchoolAccount(paymentAccountId!, transactionId),
            new Date(), 500,
        ));
        expect(report.confirmed).toBeGreaterThanOrEqual(1);
        const checked = calls.filter((c) => c.url.endsWith(`/transactions/${p.providerTransactionId}`));
        expect(checked.map((c) => c.auth)).toEqual([`Bearer ${fx.A.secretKey}`]);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("VERIFIED");
    });

    it("disponibilité vue par le parent : A oui, C non (pas de repli global)", async () => {
        actAs(parent("A"));
        expect((await callRoute(onlineStatus, { path: "/api/payments/online-status" })).body).toMatchObject({ available: true });
        actAs(parent("C"));
        const c = await callRoute(onlineStatus, { path: "/api/payments/online-status" });
        expect(c.body).toMatchObject({ available: false });
        expect(text(c.body)).toContain("économat");
    });
});
