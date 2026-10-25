import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "fedapay";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { enrollInCurrentYear } from "./fixtures/enrollment";
import { activeSchoolAccount } from "./fixtures/payment-account";
import { GET as myChildren } from "@/app/api/finance/my-children/route";
import { GET as childFinance } from "@/app/api/finance/my-children/[studentId]/route";
import { POST as initiate } from "@/app/api/payments/initiate/route";
import { GET as paymentStatus } from "@/app/api/payments/status/route";
import { GET as invoice } from "@/app/api/payments/[id]/invoice/route";
import { POST as accountWebhook } from "@/app/api/payments/fedapay/webhook/[accountId]/route";
import { POST as dedicatedInitiate } from "@/app/api/payments/fedapay/initiate/route";

/**
 * Parcours de paiement parent (2026-10-19) — de la situation d'un enfant à la
 * confirmation, sur une vraie base PostgreSQL (verrous, RLS, déclencheurs).
 *
 * Seul FedaPay est simulé, au niveau HTTP : chaque appel enregistre la clé
 * utilisée. Aucun paiement réel.
 */

// ── FedaPay simulé ──
const calls: Array<{ url: string; auth: string | null; amount?: number; callbackUrl?: string }> = [];
let txSeq = 5000;
let failNext: "network" | "http-url" | null = null;
const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get("authorization");
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/transactions") && init?.method === "POST") {
        const sent = JSON.parse(String(init.body)) as { amount: number; callback_url: string };
        calls.push({ url, auth, amount: sent.amount, callbackUrl: sent.callback_url });
        if (failNext === "network") {
            failNext = null;
            throw new TypeError("fetch failed");
        }
        return ok({ "v1/transaction": { id: ++txSeq, status: "pending" } });
    }
    if (url.includes("/token")) {
        if (failNext === "http-url") {
            failNext = null;
            return ok({ token: "tok", url: "http://process.fedapay.com/pay" });
        }
        return ok({ token: "tok", url: "https://process.fedapay.com/pay" });
    }
    return ok({});
});

type Child = { studentId: string; schoolId: string };
const as = (role: UserRole, active: string, accessible: string[], userId: string): Session => {
    const base = sessionFor(role, active, userId);
    return { ...base, user: { ...base.user, accessibleSchoolIds: accessible } };
};

let A: string, B: string, C: string, D: string;
let accountA: { id: string; webhookSecret: string }, accountB: { id: string; webhookSecret: string };
let parentP: string, parentQ: string, accountantB: string;
let a1: Child, a2: Child, b1: Child, c1: Child, d1: Child, q1: Child;
const fees: Record<string, string> = {};
let levelA = "";

const asP = () => actAs(as("PARENT", A, [A, B, C, D], parentP));
const asQ = () => actAs(as("PARENT", A, [A], parentQ));
const start = (studentId: string, feeId: string, extra: Record<string, unknown> = {}) =>
    callRoute(initiate, { method: "POST", path: "/api/payments/initiate", body: { studentId, feeId, provider: "FEDAPAY", ...extra } });
const detail = (studentId: string) => callRoute(childFinance, { path: `/api/finance/my-children/${studentId}`, params: { studentId } });
type FeeBody = {
    feeId: string; billed: number; settled: number; reserved: number; remaining: number; available: number;
    installments: Array<{ payable: boolean; outstanding: number; covered: number }> | null;
    options: { nextInstallment: { amount: number } | null; fullBalance: number | null; maxAmount: number; blockedByPending: boolean };
};
const feeOf = async (studentId: string, feeId: string) => {
    const res = await detail(studentId);
    return (res.body as { fees: FeeBody[] }).fees.find((f) => f.feeId === feeId);
};
const attempts = (studentId: string, feeId: string) => prisma.payment.findMany({ where: { studentId, feeId }, orderBy: { createdAt: "asc" } });
const keyOf = (accountId: string) => `Bearer sk_sandbox_test_${accountId.slice(0, 8)}`;

async function webhook(accountId: string, secret: string, payload: object) {
    const raw = JSON.stringify(payload);
    actAs(null);
    try {
        return await callRoute(accountWebhook, {
            method: "POST", path: `/api/payments/fedapay/webhook/${accountId}`, params: { accountId },
            rawBody: raw, headers: { "x-fedapay-signature": Webhook.generateTestHeaderString({ payload: raw, secret }) },
        });
    } finally {
        asP();
    }
}
const event = (name: string, p: { reference: string | null; providerTransactionId: string | null; amount: unknown }) => ({
    name, entity: { id: Number(p.providerTransactionId), merchant_reference: p.reference, amount: Number(p.amount), currency: { iso: "XOF" } },
});

async function child(schoolId: string, parentProfileId: string, enroll = true): Promise<Child> {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: uniqueCode("E"), lastName: "Parcours", role: "STUDENT", schoolId },
    });
    const sp = await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } });
    await prisma.parentStudent.create({ data: { parentId: parentProfileId, studentId: sp.id, relationship: "PARENT" } });
    if (enroll) await enrollInCurrentYear(sp.id, schoolId, schoolId === A ? levelA : undefined);
    return { studentId: sp.id, schoolId };
}
async function parent(schoolId: string) {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("parent")}@integration.test`, password: "x", firstName: "Parent", lastName: "Parcours", role: "PARENT", schoolId },
    });
    return { userId: user.id, profileId: (await prisma.parentProfile.create({ data: { userId: user.id } })).id };
}
const fee = (schoolId: string, name: string, amount: number, extra: Record<string, unknown> = {}) =>
    prisma.fee.create({ data: { schoolId, name, amount, ...extra } }).then((f) => f.id);

beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    [A, B, C, D] = [(await createSchool("PJ-A")).id, (await createSchool("PJ-B")).id, (await createSchool("PJ-C")).id, (await createSchool("PJ-D")).id];
    levelA = uniqueCode("CM1");
    accountA = await activeSchoolAccount(A);
    accountB = await activeSchoolAccount(B);
    // D : compte révoqué seulement ; C : aucun compte
    const revoked = await activeSchoolAccount(D);
    await prisma.schoolPaymentAccount.update({ where: { id: revoked.id }, data: { status: "REVOKED", revokedAt: new Date() } });

    const P = await parent(A);
    const Q = await parent(A);
    parentP = P.userId;
    parentQ = Q.userId;
    a1 = await child(A, P.profileId);
    a2 = await child(A, P.profileId);
    b1 = await child(B, P.profileId);
    c1 = await child(C, P.profileId);
    d1 = await child(D, P.profileId);
    q1 = await child(A, Q.profileId);
    accountantB = (await prisma.user.create({
        data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "B", role: "ACCOUNTANT", schoolId: B },
    })).id;

    fees.scolarite = await fee(A, "Scolarité", 100000);
    fees.tranches = await fee(A, "Cantine", 90000);
    fees.optionnel = await fee(A, "Sortie", 20000, { isRequired: false });
    fees.autreNiveau = await fee(A, "Frais 6e", 40000, { classLevelCode: uniqueCode("6E") });
    fees.niveau = await fee(A, "Frais du niveau", 30000, { classLevelCode: levelA });
    fees.b = await fee(B, "Scolarité B", 50000);
    fees.c = await fee(C, "Scolarité C", 50000);
    fees.d = await fee(D, "Scolarité D", 50000);
    // Échéancier de a1 sur la cantine : 3 × 30 000
    await prisma.paymentPlan.create({
        data: {
            studentId: a1.studentId, feeId: fees.tranches, totalAmount: 90000, installments: 3,
            installmentPayments: {
                create: [
                    { amount: 30000, dueDate: new Date("2026-10-01") },
                    { amount: 30000, dueDate: new Date("2026-11-01") },
                    { amount: 30000, dueDate: new Date("2026-12-01") },
                ],
            },
        },
    });
});
afterAll(() => {
    vi.unstubAllGlobals();
});
beforeEach(() => {
    calls.length = 0;
    failNext = null;
    asP();
});

describe("A. Enfants et situations séparées", () => {
    it("chaque enfant avec SON école et SON reste ; aucun enfant d'une autre famille", async () => {
        const res = await callRoute(myChildren, { path: "/api/finance/my-children" });
        expect(res.status).toBe(200);
        const list = (res.body as { children: Array<{ studentId: string; schoolId: string; remaining: number }> }).children;
        expect(list.map((c) => c.studentId).sort()).toEqual([a1, a2, b1, c1, d1].map((c) => c.studentId).sort());
        expect(list.find((c) => c.studentId === b1.studentId)).toMatchObject({ schoolId: B, remaining: 50000 });
        // a2 : scolarité + cantine + frais du niveau (ni facultatif non souscrit, ni autre niveau)
        expect(list.find((c) => c.studentId === a2.studentId)).toMatchObject({ schoolId: A, remaining: 220000 });
        expect(list.some((c) => c.studentId === q1.studentId)).toBe(false);
    });

    it("détail d'un enfant : frais applicables seulement, chiffres du serveur, paiement en ligne de son école", async () => {
        const res = await detail(a2.studentId);
        expect(res.status).toBe(200);
        const body = res.body as { child: { schoolId: string }; fees: FeeBody[]; online: { available: boolean }; totals: { billed: number } };
        expect(body.child.schoolId).toBe(A);
        expect(body.fees.map((f) => f.feeId).sort()).toEqual([fees.scolarite, fees.tranches, fees.niveau].sort());
        expect(body.totals.billed).toBe(220000);
        expect(body.online.available).toBe(true);
        expect(JSON.stringify(body)).not.toMatch(/sk_sandbox|Ciphertext|webhookSecret/);
    });

    it("enfant d'une autre famille (même école) : 404 sans rien révéler", async () => {
        const res = await detail(q1.studentId);
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body)).not.toContain("Scolarité");
    });

    it("école sans compte (C) ou au compte révoqué (D) : paiement en ligne affiché indisponible", async () => {
        expect(((await detail(c1.studentId)).body as { online: { available: boolean } }).online.available).toBe(false);
        expect(((await detail(d1.studentId)).body as { online: { available: boolean } }).online.available).toBe(false);
    });
});

describe("B. Disponibilité : jamais de repli", () => {
    it.each([["sans compte", () => c1, () => fees.c], ["compte révoqué", () => d1, () => fees.d]])(
        "%s : 503, aucun essai, aucun appel au fournisseur",
        async (_label, kid, feeId) => {
            const res = await start(kid().studentId, feeId(), { amount: 10000 });
            expect(res.status).toBe(503);
            expect(res.body).toMatchObject({ code: "ONLINE_PAYMENT_UNAVAILABLE" });
            expect(await attempts(kid().studentId, feeId())).toHaveLength(0);
            expect(calls).toHaveLength(0);
        },
    );
});

describe("C. Montants", () => {
    it.each([[0], [-500], [1500.5]])("montant %s : 400, aucun essai", async (amount) => {
        const res = await start(a2.studentId, fees.niveau, { amount });
        expect(res.status).toBe(400);
        expect(await attempts(a2.studentId, fees.niveau)).toHaveLength(0);
    });

    it("au-delà du disponible : 400, aucun essai, aucun appel", async () => {
        const res = await start(a2.studentId, fees.niveau, { amount: 30001 });
        expect(res.status).toBe(400);
        expect(await attempts(a2.studentId, fees.niveau)).toHaveLength(0);
        expect(calls).toHaveLength(0);
    });

    it("deux paiements libres simultanés dépassant le reste : un seul réservé, sur le compte de B", async () => {
        const results = await Promise.all([start(b1.studentId, fees.b, { amount: 30000 }), start(b1.studentId, fees.b, { amount: 35000 })]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(await attempts(b1.studentId, fees.b)).toHaveLength(1);
        expect(calls).toHaveLength(1);
        expect(calls[0].auth).toBe(keyOf(accountB.id));
    });
});

describe("D. Échéances et solde", () => {
    it("10 000 déjà payés : la 1re échéance reste due (20 000), seule payable ; les suivantes non", async () => {
        await prisma.payment.create({
            data: { studentId: a1.studentId, feeId: fees.tranches, amount: 10000, method: "CASH", status: "VERIFIED", paidAt: new Date() },
        });
        const f = (await feeOf(a1.studentId, fees.tranches))!;
        expect(f.installments!.map((i) => [i.covered, i.outstanding, i.payable])).toEqual([[10000, 20000, true], [0, 30000, false], [0, 30000, false]]);
        expect(f.options.nextInstallment).toMatchObject({ amount: 20000 });
    });

    it("payer la prochaine échéance : le serveur demande 20 000 (montant de la requête ignoré), sur le compte de A", async () => {
        const res = await start(a1.studentId, fees.tranches, { mode: "NEXT_INSTALLMENT", amount: 1 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ amount: 20000, paymentUrl: "https://process.fedapay.com/pay" });
        expect(calls).toEqual([expect.objectContaining({ amount: 20000, auth: keyOf(accountA.id) })]);
        const created = (await attempts(a1.studentId, fees.tranches)).find((p) => p.status === "PENDING")!;
        expect([Number(created.amount), created.paymentAccountId, created.provider]).toEqual([20000, accountA.id, "FEDAPAY"]);
    });

    it("essai en attente : échéance et solde bloqués (409), montant libre seulement jusqu'au disponible", async () => {
        const f = (await feeOf(a1.studentId, fees.tranches))!;
        expect(f.options).toMatchObject({ nextInstallment: null, fullBalance: null, blockedByPending: true, maxAmount: 60000 });
        expect(f.installments!.every((i) => !i.payable)).toBe(true);
        for (const mode of ["NEXT_INSTALLMENT", "FULL_BALANCE"]) {
            const res = await start(a1.studentId, fees.tranches, { mode });
            expect(res.status).toBe(409);
            expect(res.body).toMatchObject({ code: "PAYMENT_IN_PROGRESS" });
        }
        expect(calls).toHaveLength(0);
    });

    it("frais sans échéancier : pas de tranches inventées ; « prochaine échéance » refusée", async () => {
        const f = (await feeOf(a2.studentId, fees.scolarite))!;
        expect(f.installments).toBeNull();
        expect(f.options.nextInstallment).toBeNull();
        const res = await start(a2.studentId, fees.scolarite, { mode: "NEXT_INSTALLMENT" });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: "NO_INSTALLMENT_DUE" });
        expect(await attempts(a2.studentId, fees.scolarite)).toHaveLength(0);
    });

    it("tout le solde : disponible calculé au moment de l'essai ; après confirmation, plus rien à régler", async () => {
        await prisma.payment.create({
            data: { studentId: a2.studentId, feeId: fees.niveau, amount: 12000, method: "CASH", status: "VERIFIED", paidAt: new Date() },
        });
        const res = await start(a2.studentId, fees.niveau, { mode: "FULL_BALANCE" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ amount: 18000 });
        const pending = (await attempts(a2.studentId, fees.niveau)).find((p) => p.status === "PENDING")!;
        expect((await webhook(accountA.id, accountA.webhookSecret, event("transaction.approved", pending))).body).toMatchObject({ outcome: "CONFIRMED" });
        const again = await start(a2.studentId, fees.niveau, { mode: "FULL_BALANCE" });
        expect(again.status).toBe(409);
        expect(again.body).toMatchObject({ code: "NOTHING_DUE" });
        expect(await feeOf(a2.studentId, fees.niveau)).toMatchObject({ settled: 30000, remaining: 0, available: 0 });
    });
});

describe("E. Initiation : identifiants envoyés vérifiés en base", () => {
    it("frais d'un autre niveau, facultatif non souscrit : 409 FEE_NOT_APPLICABLE, aucune écriture, aucun appel", async () => {
        for (const feeId of [fees.autreNiveau, fees.optionnel]) {
            const res = await start(a2.studentId, feeId, { amount: 1000 });
            expect(res.status).toBe(409);
            expect(res.body).toMatchObject({ code: "FEE_NOT_APPLICABLE" });
            expect(await attempts(a2.studentId, feeId)).toHaveLength(0);
        }
        expect(calls).toHaveLength(0);
    });

    it("élève non inscrit cette année : aucun frais payable par la famille", async () => {
        const P = await prisma.parentProfile.findFirstOrThrow({ where: { userId: parentP } });
        const notEnrolled = await child(A, P.id, false);
        const res = await start(notEnrolled.studentId, fees.scolarite, { amount: 1000 });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: "FEE_NOT_APPLICABLE" });
    });

    it("frais de B pour l'enfant de A : 403 ; enfant d'une autre famille : 403 ; aucune écriture", async () => {
        expect((await start(a2.studentId, fees.b, { amount: 1000 })).status).toBe(403);
        expect((await start(q1.studentId, fees.scolarite, { amount: 1000 })).status).toBe(403);
        expect(await attempts(a2.studentId, fees.b)).toHaveLength(0);
        expect(await attempts(q1.studentId, fees.scolarite)).toHaveLength(0);
        expect(calls).toHaveLength(0);
    });

    it("double clic (même montant) : un seul essai, un seul appel, le second 409", async () => {
        const first = await start(a2.studentId, fees.scolarite, { amount: 25000 });
        const second = await start(a2.studentId, fees.scolarite, { amount: 25000 });
        expect(first.status).toBe(200);
        expect(second.status).toBe(409);
        expect(second.body).toMatchObject({ code: "PAYMENT_ALREADY_STARTED" });
        expect(calls).toHaveLength(1);
        expect((await attempts(a2.studentId, fees.scolarite)).filter((p) => p.status === "PENDING")).toHaveLength(1);
    });

    it("panne réseau à la création : résultat incertain (502), montant réservé, solde non relançable", async () => {
        failNext = "network";
        const res = await start(b1.studentId, fees.b, { amount: 5000 });
        expect(res.status).toBe(502);
        expect(res.body).toMatchObject({ code: "PAYMENT_INIT_UNCERTAIN" });
        const uncertain = (await attempts(b1.studentId, fees.b)).find((p) => Number(p.amount) === 5000)!;
        expect(uncertain.status).toBe("PENDING");
        const status = await callRoute(paymentStatus, { path: `/api/payments/status?ref=${encodeURIComponent(uncertain.reference!)}` });
        expect(status.body).toMatchObject({ status: "UNDER_REVIEW" });
        expect((await start(b1.studentId, fees.b, { mode: "FULL_BALANCE" })).body).toMatchObject({ code: "PAYMENT_IN_PROGRESS" });
    });

    it("lien de paiement non https : jamais renvoyé au navigateur, essai conservé en vérification", async () => {
        failNext = "http-url";
        const res = await start(b1.studentId, fees.b, { amount: 4000 });
        expect(res.status).toBe(502);
        expect(JSON.stringify(res.body)).not.toContain("http://");
        const kept = (await attempts(b1.studentId, fees.b)).find((p) => Number(p.amount) === 4000)!;
        expect([kept.status, kept.providerTransactionId]).toEqual(["PENDING", String(txSeq)]);
    });
});

describe("F–G. Retour, statut et reçus", () => {
    let payment: { id: string; reference: string | null; providerTransactionId: string | null; amount: unknown };

    beforeAll(async () => {
        asP();
        const res = await start(a2.studentId, fees.tranches, { amount: 15000 });
        expect(res.status).toBe(200);
        payment = (await attempts(a2.studentId, fees.tranches)).find((p) => p.status === "PENDING")!;
    });
    const status = (ref: string, extra = "") => callRoute(paymentStatus, { path: `/api/payments/status?ref=${encodeURIComponent(ref)}${extra}` });
    const receipt = (id: string) => callRoute(invoice, { path: `/api/payments/${id}/invoice`, params: { id } });

    it("retour « success » sans confirmation serveur : toujours en attente, pas de reçu", async () => {
        expect((await status(payment.reference!, "&status=success")).body).toMatchObject({ status: "PENDING" });
        const r = await receipt(payment.id);
        expect(r.status).toBe(409);
        expect(r.body).toMatchObject({ code: "RECEIPT_NOT_AVAILABLE" });
        const history = ((await detail(a2.studentId)).body as { payments: Array<{ id: string; status: string; receiptAvailable: boolean }> }).payments;
        expect(history.find((p) => p.id === payment.id)).toMatchObject({ status: "PENDING", receiptAvailable: false });
    });

    it("référence d'un autre parent : 404, rien révélé ; reçu : 403", async () => {
        asQ();
        const res = await status(payment.reference!);
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body)).not.toContain("Cantine");
        expect((await receipt(payment.id)).status).toBe(403);
    });

    it("compte de B authentique visant ce paiement de A : refusé, rien ne change", async () => {
        const res = await webhook(accountB.id, accountB.webhookSecret, event("transaction.approved", payment));
        expect(res.body).toMatchObject({ outcome: "REJECTED" });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    });

    it("confirmation signée du compte de A : confirmé partout, solde relu, reçu disponible ; consultations répétées stables", async () => {
        const res = await webhook(accountA.id, accountA.webhookSecret, event("transaction.approved", payment));
        expect(res.body).toMatchObject({ outcome: "CONFIRMED" });
        for (let i = 0; i < 3; i++) expect((await status(payment.reference!)).body).toMatchObject({ status: "CONFIRMED" });
        expect(await feeOf(a2.studentId, fees.tranches)).toMatchObject({ settled: 15000, reserved: 0, remaining: 75000 });
        const r = await receipt(payment.id);
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ success: true });
    });

    it("comptable d'une autre école : reçu introuvable (la RLS masque le paiement de A)", async () => {
        actAs(as("ACCOUNTANT", B, [B], accountantB));
        const r = await receipt(payment.id);
        expect(r.status).toBe(404);
        expect(JSON.stringify(r.body)).not.toContain("pdf");
    });

    it("annulation réelle (webhook signé) : non abouti, réservation libérée, pas de reçu", async () => {
        const res = await start(a2.studentId, fees.tranches, { amount: 7000 });
        expect(res.status).toBe(200);
        const p = (await attempts(a2.studentId, fees.tranches)).find((x) => x.status === "PENDING")!;
        expect((await webhook(accountA.id, accountA.webhookSecret, event("transaction.declined", p))).body).toMatchObject({ cancelled: 1 });
        expect((await status(p.reference!)).body).toMatchObject({ status: "FAILED" });
        expect((await receipt(p.id)).status).toBe(409);
        expect(await feeOf(a2.studentId, fees.tranches)).toMatchObject({ reserved: 0, available: 75000 });
    });
});

describe("H. Revue contradictoire (2026-10-19)", () => {
    let P: { id: string };
    beforeAll(async () => {
        P = await prisma.parentProfile.findFirstOrThrow({ where: { userId: parentP } });
    });
    const withPlan = async () => {
        const kid = await child(A, P.id);
        await prisma.paymentPlan.create({
            data: {
                studentId: kid.studentId, feeId: fees.tranches, totalAmount: 90000, installments: 3,
                installmentPayments: { create: [30000, 30000, 30000].map((amount, i) => ({ amount, dueDate: new Date(2026, 9 + i, 1) })) },
            },
        });
        return kid;
    };
    const status = (ref: string) => callRoute(paymentStatus, { path: `/api/payments/status?ref=${encodeURIComponent(ref)}` });

    it("échéance et montant libre simultanés sur tout le reste : un seul engagé, total réservé ≤ reste", async () => {
        const kid = await withPlan();
        const results = await Promise.all([
            start(kid.studentId, fees.tranches, { mode: "NEXT_INSTALLMENT" }),
            start(kid.studentId, fees.tranches, { amount: 90000 }),
        ]);
        expect(results.filter((r) => r.status === 200)).toHaveLength(1);
        const reserved = (await attempts(kid.studentId, fees.tranches)).filter((p) => p.status === "PENDING").reduce((sum, p) => sum + Number(p.amount), 0);
        expect(reserved).toBeLessThanOrEqual(90000);
        expect(calls).toHaveLength(1);
    });

    it("une transaction externe ne confirme jamais un autre paiement que le sien", async () => {
        const kid = await withPlan();
        await start(kid.studentId, fees.tranches, { amount: 10000 });
        await start(kid.studentId, fees.tranches, { amount: 11000 });
        const [x, y] = (await attempts(kid.studentId, fees.tranches)).filter((p) => p.status === "PENDING");
        const crossed = { ...event("transaction.approved", y), entity: { ...event("transaction.approved", y).entity, id: Number(x.providerTransactionId) } };
        expect((await webhook(accountA.id, accountA.webhookSecret, crossed)).body).toMatchObject({ outcome: "REJECTED" });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: y.id } })).status).toBe("PENDING");
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: x.id } })).status).toBe("PENDING");
    });

    it("confirmation rejouée : comptée une fois ; annulation tardive après confirmation : sans effet", async () => {
        const kid = await withPlan();
        await start(kid.studentId, fees.tranches, { amount: 12000 });
        const [p] = (await attempts(kid.studentId, fees.tranches)).filter((x) => x.status === "PENDING");
        expect((await webhook(accountA.id, accountA.webhookSecret, event("transaction.approved", p))).body).toMatchObject({ outcome: "CONFIRMED" });
        expect((await webhook(accountA.id, accountA.webhookSecret, event("transaction.approved", p))).body).toMatchObject({ outcome: "ALREADY_PROCESSED" });
        expect((await webhook(accountA.id, accountA.webhookSecret, event("transaction.declined", p))).body).toMatchObject({ cancelled: 0 });
        expect(await feeOf(kid.studentId, fees.tranches)).toMatchObject({ settled: 12000, reserved: 0 });
        expect((await status(p.reference!)).body).toMatchObject({ status: "CONFIRMED" });
    });

    it("montant confirmé différent : rien n'est validé, le parent voit « en vérification » (pas « en attente »)", async () => {
        const kid = await withPlan();
        await start(kid.studentId, fees.tranches, { amount: 13000 });
        const [p] = (await attempts(kid.studentId, fees.tranches)).filter((x) => x.status === "PENDING");
        const partial = { ...event("transaction.approved", p), entity: { ...event("transaction.approved", p).entity, amount: 1000 } };
        expect((await webhook(accountA.id, accountA.webhookSecret, partial)).body).toMatchObject({ outcome: "MISMATCH" });
        expect((await status(p.reference!)).body).toMatchObject({ status: "UNDER_REVIEW" });
        expect(await feeOf(kid.studentId, fees.tranches)).toMatchObject({ settled: 0, reserved: 13000 });
    });

    it("frais facultatif avec seulement un paiement annulé : non souscrit, non payable", async () => {
        const kid = await child(A, P.id);
        await prisma.payment.create({ data: { studentId: kid.studentId, feeId: fees.optionnel, amount: 5000, method: "CASH", status: "CANCELLED" } });
        expect(((await detail(kid.studentId)).body as { fees: FeeBody[] }).fees.some((f) => f.feeId === fees.optionnel)).toBe(false);
        expect((await start(kid.studentId, fees.optionnel, { amount: 1000 })).body).toMatchObject({ code: "FEE_NOT_APPLICABLE" });
    });

    it("rôles internes : 403 sur les situations familiales ; anonyme : 401 ; parent sans enfant : liste vide", async () => {
        actAs(as("ACCOUNTANT", B, [B], accountantB));
        expect((await callRoute(myChildren, { path: "/api/finance/my-children" })).status).toBe(403);
        expect((await detail(b1.studentId)).status).toBe(403);
        actAs(null);
        expect((await callRoute(myChildren, { path: "/api/finance/my-children" })).status).toBe(401);
        const lonely = await parent(A);
        actAs(as("PARENT", A, [A], lonely.userId));
        expect((await callRoute(myChildren, { path: "/api/finance/my-children" })).body).toEqual({ children: [] });
        expect((await detail(a1.studentId)).status).toBe(404);
    });

    it("route dédiée : adresse de retour = adresse publique configurée, jamais l'en-tête Host", async () => {
        const previous = process.env.NEXT_PUBLIC_APP_URL;
        process.env.NEXT_PUBLIC_APP_URL = "https://app.edupilot.test";
        try {
            const kid = await child(A, P.id);
            const p = await prisma.payment.create({ data: { studentId: kid.studentId, feeId: fees.scolarite, amount: 9000, method: "MOBILE_MONEY_MTN", status: "PENDING" } });
            const res = await callRoute(dedicatedInitiate, { method: "POST", path: "http://evil.test/api/payments/fedapay/initiate", body: { paymentId: p.id } });
            expect(res.status).toBe(200);
            expect(calls[0].callbackUrl).toMatch(/^https:\/\/app\.edupilot\.test\/dashboard\/finance\/retour-paiement\?ref=/);
            expect(calls[0].auth).toBe(keyOf(accountA.id));
        } finally {
            if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
            else process.env.NEXT_PUBLIC_APP_URL = previous;
        }
    });
});
