import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { runAsSystem } from "@/lib/db/db-context";
import {
    ONLINE_PAYMENT_TTL_MS,
    confirmOnlinePayment,
    reconcileStalePayments,
    type VerifyFn,
} from "@/lib/finance/online-payments";

/**
 * Paiements en ligne contre une vraie base (audit paiements du 2026-10-15) :
 * doublons simultanés, montant/devise des confirmations, reste à payer
 * (échéancier, bourses, encaissé), confirmations tardives, réconciliation
 * à 24 h. Seul l'appel HTTP au fournisseur est simulé.
 */
const { initiatePayment } = vi.hoisted(() => ({ initiatePayment: vi.fn() }));

vi.mock("@/lib/finance/factory", () => ({
    PaymentProviderFactory: { getProvider: () => ({ initiatePayment }) },
}));
vi.mock("@/lib/finance/providers/momo", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/finance/providers/momo")>()),
    isMomoConfigured: () => true,
}));

import { POST as initiate } from "@/app/api/payments/initiate/route";
import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { ProviderInitError } from "@/lib/finance/providers/init-error";
import { CircuitOpenError } from "@/lib/resilience/errors";
import { failOnlinePayment } from "@/lib/finance/online-payments";
import { POST as momoWebhook } from "@/app/api/payments/momo/webhook/route";

const WEBHOOK_SECRET = "integration-online-payments-secret";

let schoolId: string;
let studentId: string;

async function newFee(amount = 50000): Promise<string> {
    const fee = await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount } });
    return fee.id;
}

function initiateRequest(feeId: string, amount: number) {
    return callRoute(initiate, {
        method: "POST",
        path: "/api/payments/initiate",
        body: { amount, feeId, studentId, provider: "MOMO", payerPhone: "0190000000" },
    });
}

async function initiateOk(feeId: string, amount: number): Promise<{ paymentId: string; reference: string }> {
    const res = await initiateRequest(feeId, amount);
    expect(res.status).toBe(200);
    const paymentId = (res.body as { paymentId: string }).paymentId;
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    return { paymentId, reference: payment.reference! };
}

async function deliverMomo(event: Record<string, unknown>) {
    const raw = JSON.stringify(event);
    const signature = createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
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

function success(externalId: string, amount: string, currency = "XOF") {
    return { financialTransactionId: uniqueCode("MTN"), externalId, amount, currency, status: "SUCCESSFUL" };
}

/** Vieillit un essai : simule « plus de 24 h sans réponse ». */
async function age(paymentId: string, ms = ONLINE_PAYMENT_TTL_MS + 60_000) {
    await prisma.payment.update({ where: { id: paymentId }, data: { createdAt: new Date(Date.now() - ms) } });
}

beforeAll(async () => {
    process.env.MOMO_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const school = await createSchool("IT-PAY");
    schoolId = school.id;
    const user = await prisma.user.create({
        data: {
            email: `${uniqueCode("eleve")}@integration.test`,
            password: "non-utilise",
            firstName: "Koffi",
            lastName: "Test",
            role: "STUDENT",
            schoolId,
        },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } });
    studentId = student.id;
});

beforeEach(() => {
    actAs(sessionFor("ACCOUNTANT", schoolId));
    initiatePayment.mockReset();
    initiatePayment.mockImplementation(async () => ({ paymentUrl: "", transactionId: uniqueCode("momo-ref") }));
});

describe("Doublons simultanés (verrou par élève et par frais)", () => {
    it("deux demandes simultanées qui dépassent ensemble le reste à payer : une seule passe", async () => {
        const feeId = await newFee(50000);

        const [a, b] = await Promise.all([initiateRequest(feeId, 30000), initiateRequest(feeId, 25000)]);

        expect([a.status, b.status].sort()).toEqual([200, 409]);
        const pending = await prisma.payment.count({ where: { feeId, studentId, status: "PENDING" } });
        expect(pending).toBe(1);
    });

    // S3 : la seconde demande n'est plus renvoyée au fournisseur (avant : deux
    // transactions chez lui pour un même essai, la première écrasée)
    it("deux demandes identiques simultanées (double clic) : un seul essai, un seul appel au fournisseur", async () => {
        const feeId = await newFee(50000);
        const callsBefore = initiatePayment.mock.calls.length;

        const results = await Promise.all([initiateRequest(feeId, 50000), initiateRequest(feeId, 50000)]);

        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        const [ok, started] = results[0].status === 200 ? results : [results[1], results[0]];
        expect(started.body).toMatchObject({ code: "PAYMENT_ALREADY_STARTED", paymentId: (ok.body as { paymentId: string }).paymentId });
        expect(await prisma.payment.count({ where: { feeId, studentId } })).toBe(1);
        expect(initiatePayment.mock.calls.length - callsBefore).toBe(1);
    });

    it("l'essai garde le fournisseur et son identifiant pour la réconciliation", async () => {
        const feeId = await newFee();
        initiatePayment.mockResolvedValueOnce({ paymentUrl: "", transactionId: "uuid-momo-42" });

        const { paymentId } = await initiateOk(feeId, 50000);

        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.provider).toBe("MOMO");
        expect(payment.providerTransactionId).toBe("uuid-momo-42");
    });

    it("un refus avéré chez le fournisseur ne bloque pas la famille : l'essai cesse de réserver", async () => {
        const feeId = await newFee(50000);
        // Jeton refusé : la demande n'a jamais été envoyée (lot 3b ; une erreur
        // sans preuve d'absence de transaction laisse l'essai réservé, voir plus bas)
        initiatePayment.mockRejectedValueOnce(new ProviderInitError("[MoMo] Échec d'authentification (401)", "REFUSED"));

        const failed = await initiateRequest(feeId, 50000);
        expect(failed.status).toBe(500);
        const first = await prisma.payment.findFirstOrThrow({ where: { feeId, studentId } });
        expect(first.status).toBe("EXPIRED");

        // Nouvel essai immédiatement possible pour le même montant
        await initiateOk(feeId, 50000);
    });
});

describe("Reste à payer : encaissé, échéancier, bourse, essais en cours", () => {
    it("les paiements validés ET rapprochés sont déduits", async () => {
        const feeId = await newFee(50000);
        await prisma.payment.createMany({
            data: [
                { studentId, feeId, amount: 20000, method: "CASH", status: "VERIFIED" },
                { studentId, feeId, amount: 15000, method: "CASH", status: "RECONCILED" },
            ],
        });

        const over = await initiateRequest(feeId, 20000);
        expect(over.status).toBe(400);
        expect((over.body as { remaining: number }).remaining).toBe(15000);
        await initiateOk(feeId, 15000);
    });

    it("l'échéancier (bourse déduite) remplace le montant du frais", async () => {
        const feeId = await newFee(50000);
        await prisma.paymentPlan.create({ data: { studentId, feeId, totalAmount: 40000, installments: 2 } });

        expect((await initiateRequest(feeId, 45000)).status).toBe(400);
        await initiateOk(feeId, 40000);
    });

    it("un essai en attente réserve son montant, même après 24 h, jusqu'à un échec définitif chez le fournisseur", async () => {
        const feeId = await newFee(50000);
        const { paymentId } = await initiateOk(feeId, 30000);

        // (même montant dans les 5 min = même essai repris : on demande autre chose)
        const blocked = await initiateRequest(feeId, 25000);
        expect(blocked.status).toBe(409);
        expect(blocked.body).toMatchObject({ code: "PAYMENT_IN_PROGRESS", reserved: 30000, available: 20000 });

        // Plus de 24 h sans réponse : encore confirmable, donc toujours réservé (lot 3b)
        await age(paymentId);
        const stillBlocked = await initiateRequest(feeId, 25000);
        expect(stillBlocked.status).toBe(409);
        expect(stillBlocked.body).toMatchObject({ reserved: 30000, available: 20000 });

        // Fournisseur « toujours en attente » : résultat inconnu, l'essai reste réservé
        await runAsSystem("test", () => reconcileStalePayments(async () => ({ status: "PENDING", rawData: null })));
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PENDING");
        expect((await initiateRequest(feeId, 25000)).status).toBe(409);

        // Échec définitif chez le fournisseur : annulé, réservation libérée
        const attempt = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        await runAsSystem("test", () =>
            reconcileStalePayments(async (_provider, transactionId) => ({
                status: transactionId === attempt.providerTransactionId ? "FAILED" : "PENDING",
                rawData: null,
            })),
        );
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("CANCELLED");
        await initiateOk(feeId, 25000);
    });
});

describe("Confirmation : montant et devise contrôlés", () => {
    it("montant partiel : aucune validation, paiement « à rapprocher »", async () => {
        const feeId = await newFee();
        const { paymentId, reference } = await initiateOk(feeId, 50000);

        expect((await deliverMomo(success(reference, "100"))).status).toBe(200);

        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("PENDING");
        expect(payment.notes).toContain("À rapprocher");
        expect(payment.notes).toContain("montant reçu 100 FCFA au lieu de 50000 FCFA");
    });

    it("devise différente : aucune validation", async () => {
        const feeId = await newFee();
        const { paymentId, reference } = await initiateOk(feeId, 50000);

        await deliverMomo(success(reference, "50000", "EUR"));

        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("PENDING");
        expect(payment.notes).toContain("devise reçue EUR");
    });

    it("confirmations simultanées : validé une seule fois, compté une seule fois", async () => {
        const feeId = await newFee();
        const { paymentId, reference } = await initiateOk(feeId, 50000);
        const confirm = (source: string) =>
            runAsSystem("test", () =>
                confirmOnlinePayment({ reference, provider: "MOMO", receivedAmount: 50000, receivedCurrency: "XOF", source }),
            );

        const outcomes = await Promise.all([confirm("a"), confirm("b"), confirm("c")]);

        expect(outcomes.filter((o) => o.outcome === "CONFIRMED")).toHaveLength(1);
        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("VERIFIED");
        expect(payment.notes?.match(/Confirmé par/g)).toHaveLength(1);

        // Webhook rejoué ensuite : sans effet
        await deliverMomo(success(reference, "50000"));
        const settled = await prisma.payment.aggregate({ where: { feeId, studentId, status: "VERIFIED" }, _sum: { amount: true } });
        expect(Number(settled._sum.amount)).toBe(50000);
    });

    it("confirmation tardive (après expiration) : validée et signalée", async () => {
        const feeId = await newFee();
        const { paymentId, reference } = await initiateOk(feeId, 50000);
        await prisma.payment.update({ where: { id: paymentId }, data: { status: "EXPIRED" } });

        await deliverMomo(success(reference, "50000"));

        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("VERIFIED");
        expect(payment.notes).toContain("confirmation tardive");
    });

    it("confirmation tardive alors que la famille a réglé entre-temps : trop-perçu enregistré", async () => {
        const feeId = await newFee(50000);
        const { paymentId, reference } = await initiateOk(feeId, 50000);
        await age(paymentId);
        await prisma.payment.create({ data: { studentId, feeId, amount: 50000, method: "CASH", status: "VERIFIED" } });

        const result = await runAsSystem("test", () =>
            confirmOnlinePayment({ reference, provider: "MOMO", receivedAmount: 50000, receivedCurrency: "XOF", source: "test" }),
        );

        expect(result).toMatchObject({ outcome: "CONFIRMED", overpaid: 50000 });
        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("VERIFIED");
        expect(payment.notes).toContain("Trop-perçu de 50000 FCFA");
    });

    it("un échec reçu après validation ne défait rien", async () => {
        const feeId = await newFee();
        const { paymentId, reference } = await initiateOk(feeId, 50000);
        await deliverMomo(success(reference, "50000"));

        await deliverMomo({ ...success(reference, "50000"), status: "FAILED" });

        expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("VERIFIED");
    });
});

describe("Réconciliation à 24 h", () => {
    async function staleAttempt(amount = 50000) {
        const feeId = await newFee(amount);
        const { paymentId } = await initiateOk(feeId, amount);
        await age(paymentId);
        return paymentId;
    }

    /** Réponse simulée du fournisseur pour cet essai seulement ; les autres restent incertains. */
    async function reconcileWith(paymentId: string, verify: VerifyFn) {
        const target = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        const scoped: VerifyFn = (provider, transactionId) =>
            transactionId === target.providerTransactionId
                ? verify(provider, transactionId)
                : Promise.resolve({ status: "PENDING", rawData: null });
        return runAsSystem("test", () => reconcileStalePayments(scoped));
    }

    it("payé chez le fournisseur au bon montant → validé", async () => {
        const paymentId = await staleAttempt();

        await reconcileWith(paymentId, async () => ({ status: "SUCCESS", rawData: { amount: "50000", currency: "XOF" } }));

        expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("VERIFIED");
    });

    it("payé mais montant différent → reste en attente et réservé, à rapprocher (jamais validé)", async () => {
        const paymentId = await staleAttempt();

        await reconcileWith(paymentId, async () => ({ status: "SUCCESS", rawData: { amount: "20000", currency: "XOF" } }));

        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("PENDING");
        expect(payment.notes).toContain("montant reçu 20000");
        // Le montant attendu reste réservé : aucun nouvel essai sur ce solde
        expect((await initiateRequest(payment.feeId, 10000)).status).toBe(409);
    });

    it("échec confirmé par le fournisseur → annulé", async () => {
        const paymentId = await staleAttempt();

        await reconcileWith(paymentId, async () => ({ status: "FAILED", rawData: {} }));

        expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("CANCELLED");
    });

    it("résultat incertain ou fournisseur injoignable → reste en attente et réservé, noté une fois, rien supprimé", async () => {
        const uncertain = await staleAttempt();
        const unreachable = await staleAttempt();

        for (let pass = 0; pass < 2; pass++) {
            await reconcileWith(uncertain, async () => ({ status: "PENDING", rawData: {} }));
            await reconcileWith(unreachable, async () => {
                throw new Error("timeout");
            });
        }

        for (const id of [uncertain, unreachable]) {
            const payment = await prisma.payment.findUniqueOrThrow({ where: { id } });
            expect(payment.status).toBe("PENDING");
            expect(payment.notes!.split("Sans réponse définitive du fournisseur").length - 1).toBe(1);
            expect((await initiateRequest(payment.feeId, 10000)).status).toBe(409);
        }
    });

    it("en attente depuis plus de 48 h : une seule alerte à l'administration financière, aucune libération", async () => {
        const accountant = await prisma.user.create({
            data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "Alerte", role: "ACCOUNTANT", schoolId },
        });
        const feeId = await newFee(50000);
        const { paymentId } = await initiateOk(feeId, 50000);
        await age(paymentId, 49 * 60 * 60 * 1000);

        await reconcileWith(paymentId, async () => ({ status: "PENDING", rawData: {} }));
        await reconcileWith(paymentId, async () => {
            throw new Error("timeout");
        });

        const alerts = await prisma.notification.findMany({ where: { userId: accountant.id, title: "Paiement en ligne sans réponse définitive" } });
        expect(alerts).toHaveLength(1);
        expect(alerts[0].message).toContain("50000 FCFA");
        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("PENDING");
        expect(payment.notes).toContain("Signalé à l'administration financière");
        expect((await initiateRequest(feeId, 10000)).status).toBe(409);
    });

    it("un essai de moins de 24 h n'est pas touché", async () => {
        const feeId = await newFee();
        const { paymentId } = await initiateOk(feeId, 50000);

        await reconcileWith(paymentId, async () => ({ status: "FAILED", rawData: {} }));

        expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PENDING");
    });
});

describe("Initialisation : refus avéré ou résultat inconnu (lot 3b)", () => {
    const lastAttempt = (feeId: string) => prisma.payment.findFirstOrThrow({ where: { feeId, studentId }, orderBy: { createdAt: "desc" } });

    it("réponse 4xx du fournisseur à la création : résultat inconnu, l'essai reste réservé", async () => {
        const feeId = await newFee(50000);
        initiatePayment.mockRejectedValueOnce(new ProviderInitError("[MoMo] requestToPay refusé (400)", "UNKNOWN", "momo-uuid-400"));
        expect((await initiateRequest(feeId, 50000)).status).toBe(502);
        const attempt = await lastAttempt(feeId);
        expect(attempt).toMatchObject({ status: "PENDING", providerTransactionId: "momo-uuid-400" });
        expect((await initiateRequest(feeId, 10000)).status).toBe(409);
    });

    it("demande jamais transmise (jeton refusé) : aucune transaction, l'essai cesse de réserver", async () => {
        const feeId = await newFee(50000);
        initiatePayment.mockRejectedValueOnce(new ProviderInitError("[MoMo] Échec d'authentification (401)", "REFUSED"));
        const res = await initiateRequest(feeId, 50000);
        expect(res.status).toBe(500);
        const attempt = await lastAttempt(feeId);
        expect(attempt.status).toBe("EXPIRED");
        expect(attempt.notes).toContain("aucune transaction créée");
        await initiateOk(feeId, 50000);
    });

    it("circuit ouvert (jamais envoyé) : 503, l'essai cesse de réserver", async () => {
        const feeId = await newFee(50000);
        initiatePayment.mockRejectedValueOnce(new ProviderInitError("circuit", "REFUSED", undefined, { cause: new CircuitOpenError("momo", 5000) }));
        expect((await initiateRequest(feeId, 50000)).status).toBe(503);
        expect((await lastAttempt(feeId)).status).toBe("EXPIRED");
    });

    it("délai dépassé après l'envoi : PENDING, identifiant conservé, réservé ; la reprise ne rappelle pas le fournisseur", async () => {
        const feeId = await newFee(50000);
        initiatePayment.mockRejectedValueOnce(new ProviderInitError("[MoMo] requestToPay sans réponse : aborted", "UNKNOWN", "momo-uuid-1"));
        const res = await initiateRequest(feeId, 30000);
        expect(res.status).toBe(502);
        expect(res.body).toMatchObject({ code: "PAYMENT_INIT_UNCERTAIN" });
        const attempt = await lastAttempt(feeId);
        expect(attempt).toMatchObject({ status: "PENDING", providerTransactionId: "momo-uuid-1" });
        expect(attempt.notes).toContain("Résultat de l'initialisation inconnu");

        // Même demande répétée : pas de second appel au fournisseur
        const callsBefore = initiatePayment.mock.calls.length;
        const retry = await initiateRequest(feeId, 30000);
        expect(retry.status).toBe(409);
        expect(retry.body).toMatchObject({ code: "PAYMENT_INIT_UNCERTAIN" });
        expect(initiatePayment.mock.calls.length).toBe(callsBefore);
        // Autre montant : le solde réservé n'est pas offert de nouveau
        const other = await initiateRequest(feeId, 25000);
        expect(other.status).toBe(409);
        expect(other.body).toMatchObject({ reserved: 30000, available: 20000 });
    });

    it("erreur inattendue (aucune preuve d'absence de transaction) : PENDING et réservé", async () => {
        const feeId = await newFee(50000);
        initiatePayment.mockRejectedValueOnce(new Error("Unexpected end of JSON input"));
        expect((await initiateRequest(feeId, 50000)).status).toBe(502);
        expect((await lastAttempt(feeId)).status).toBe("PENDING");
    });

    it("coupure sans identifiant : visible en réconciliation, alerte après 48 h, guichet refusé, jamais libéré", async () => {
        const accountant = await prisma.user.create({
            data: { email: `${uniqueCode("compta-init")}@integration.test`, password: "x", firstName: "Compta", lastName: "Init", role: "ACCOUNTANT", schoolId },
        });
        const feeId = await newFee(50000);
        initiatePayment.mockRejectedValueOnce(new ProviderInitError("[FedaPay] création de transaction : socket hang up", "UNKNOWN"));
        expect((await initiateRequest(feeId, 50000)).status).toBe(502);
        const attempt = await lastAttempt(feeId);
        expect(attempt).toMatchObject({ status: "PENDING", providerTransactionId: null });

        await age(attempt.id, 49 * 60 * 60 * 1000);
        await runAsSystem("test", () => reconcileStalePayments(async () => ({ status: "PENDING", rawData: null })));
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } });
        expect(after.status).toBe("PENDING");
        expect(after.notes).toContain("Signalé à l'administration financière");
        expect(await prisma.notification.count({ where: { userId: accountant.id, title: "Paiement en ligne sans réponse définitive" } })).toBe(1);

        actAs(sessionFor("ACCOUNTANT", schoolId, accountant.id));
        const counter = await callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: { studentId, feeId, amount: 50000, method: "CASH" } });
        expect(counter.status).toBe(400);
        expect(await prisma.payment.count({ where: { feeId, method: "CASH" } })).toBe(0);
    });

    it("confirmation tardive d'une initialisation incertaine (webhook par référence) : comptée une seule fois", async () => {
        const feeId = await newFee(50000);
        initiatePayment.mockRejectedValueOnce(new ProviderInitError("[MoMo] requestToPay sans réponse : aborted", "UNKNOWN", "momo-uuid-2"));
        await initiateRequest(feeId, 50000);
        const attempt = await lastAttempt(feeId);
        expect((await deliverMomo(success(attempt.reference!, "50000"))).status).toBe(200);
        expect((await deliverMomo(success(attempt.reference!, "50000"))).status).toBe(200);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: attempt.id } })).status).toBe("VERIFIED");
        expect(await prisma.payment.count({ where: { feeId, status: { in: ["VERIFIED", "RECONCILED"] } } })).toBe(1);
    });

    it("confirmation authentique après un échec signalé par le fournisseur : comptabilisée une seule fois, état antérieur noté", async () => {
        const feeId = await newFee(50000);
        const { paymentId, reference } = await initiateOk(feeId, 50000);
        await runAsSystem("test", () => failOnlinePayment(reference, "test"));
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).cancellationSource).toBe("PROVIDER");
        const confirm = () => runAsSystem("test", () => confirmOnlinePayment({ reference, provider: "MOMO", receivedAmount: 50000, receivedCurrency: "XOF", source: "webhook MOMO" }));
        expect(await confirm()).toMatchObject({ outcome: "CONFIRMED", overpaid: 0 });
        expect(await confirm()).toMatchObject({ outcome: "ALREADY_PROCESSED" });
        const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
        expect(payment.status).toBe("VERIFIED");
        expect(payment.cancellationSource).toBe("PROVIDER"); // trace conservée
        expect(payment.notes).toContain("état antérieur : annulé, échec signalé par le fournisseur");
        expect(await prisma.payment.count({ where: { feeId, status: { in: ["VERIFIED", "RECONCILED"] } } })).toBe(1);
    });
});
