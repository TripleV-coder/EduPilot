import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { createSchool, uniqueCode } from "./helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { confirmOnlinePayment, getFeeBalance } from "@/lib/finance/online-payments";

/**
 * Lot S3 (audit de souveraineté, F-02) — confirmOnlinePayment retrouvait le
 * paiement par sa seule référence : il ne vérifiait ni que la notification
 * venait du fournisseur du paiement, ni que la transaction était celle
 * enregistrée à l'initiation, et il écrasait toujours l'identifiant de
 * transaction par celui reçu. Ces règles vivent dans confirmOnlinePayment,
 * appelée ici directement (2026-11-08 : webhooks globaux retirés ; le
 * transport signé par compte d'école est éprouvé par school-payment-accounts).
 * Les paiements MoMo restent des données historiques possibles.
 */
let schoolId: string;
let studentId: string;

async function pending(opts: { provider: string | null; providerTransactionId?: string | null; status?: "PENDING" | "CANCELLED"; cancellationSource?: "MANUAL" | "PROVIDER" }) {
    const fee = await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount: 50000 } });
    const reference = uniqueCode("PAY");
    const payment = await prisma.payment.create({
        data: {
            studentId, feeId: fee.id, amount: 20000, method: "MOBILE_MONEY_MTN", status: opts.status ?? "PENDING",
            reference, provider: opts.provider, providerTransactionId: opts.providerTransactionId ?? null,
            cancellationSource: opts.cancellationSource ?? null,
        },
    });
    return { id: payment.id, reference, feeId: fee.id };
}
const state = (id: string) => prisma.payment.findUniqueOrThrow({ where: { id } });
const balance = (feeId: string) => runAsSystem("test:s3", () => prisma.$transaction((tx) => getFeeBalance(tx, studentId, feeId)));
const rejectionAlerts = (reference: string) =>
    prisma.notification.count({ where: { title: "Confirmation de paiement en ligne refusée", message: { contains: reference } } });

/** Notification FedaPay approuvée (identifiant numérique, ou absent). */
const fedapayApproved = async (reference: string, transactionId?: number) => ({
    body: await confirm(reference, "FEDAPAY", transactionId === undefined ? null : String(transactionId)),
});
const confirm = (reference: string, provider: "FEDAPAY" | "MOMO", providerTransactionId: string | null) =>
    runAsSystem("test:s3", () => confirmOnlinePayment({ reference, provider, receivedAmount: 20000, receivedCurrency: "XOF", providerTransactionId, source: "test S3" }));

beforeAll(async () => {
    schoolId = (await createSchool("IT-S3")).id;
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "S3", role: "STUDENT", schoolId },
    });
    studentId = (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
    // Destinataire des alertes financières de l'école
    await prisma.user.create({
        data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "S3", role: "ACCOUNTANT", schoolId },
    });
});


describe("Fournisseur : seul celui du paiement peut le confirmer", () => {
    it("FedaPay, bon fournisseur et même transaction : validé, identifiant inchangé", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: "4242" });
        const res = await fedapayApproved(p.reference, 4242);
        expect(res.body).toMatchObject({ outcome: "CONFIRMED" });
        const after = await state(p.id);
        expect([after.status, after.providerTransactionId]).toEqual(["VERIFIED", "4242"]);
    });

    it("webhook FedaPay authentifié sur un paiement initié chez MoMo : refusé, rien ne change, signalé une fois", async () => {
        const p = await pending({ provider: "MOMO", providerTransactionId: "momo-ref-uuid" });
        const before = await state(p.id);
        const balanceBefore = await balance(p.feeId);
        expect((await fedapayApproved(p.reference, 999)).body).toMatchObject({ outcome: "REJECTED" });
        expect((await fedapayApproved(p.reference, 999)).body).toMatchObject({ outcome: "REJECTED" });
        const after = await state(p.id);
        expect([after.status, after.provider, after.providerTransactionId, after.paidAt, after.reconciledAt])
            .toEqual([before.status, "MOMO", "momo-ref-uuid", null, null]);
        expect(await balance(p.feeId)).toEqual(balanceBefore);
        expect(after.notes?.match(/Confirmation refusée/g)).toHaveLength(1);
        expect(await rejectionAlerts(p.reference)).toBe(1);
    });

    it("paiement sans fournisseur en ligne : aucune notification ne le confirme", async () => {
        const p = await pending({ provider: null });
        expect(await confirm(p.reference, "FEDAPAY", "1")).toMatchObject({ outcome: "REJECTED" });
        expect((await state(p.id)).status).toBe("PENDING");
    });
});

describe("Transaction : jamais de substitution d'identifiant", () => {
    it("FedaPay, autre transaction que celle enregistrée : refusé, identifiant non remplacé, solde inchangé", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: "4242" });
        const balanceBefore = await balance(p.feeId);
        expect((await fedapayApproved(p.reference, 5151)).body).toMatchObject({ outcome: "REJECTED" });
        const after = await state(p.id);
        expect([after.status, after.providerTransactionId]).toEqual(["PENDING", "4242"]);
        expect(await balance(p.feeId)).toEqual(balanceBefore);
    });

    it("FedaPay, identifiant absent de la notification alors qu'il est connu : refusé (données insuffisantes)", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: "4242" });
        expect((await fedapayApproved(p.reference)).body).toMatchObject({ outcome: "REJECTED" });
        expect((await state(p.id)).status).toBe("PENDING");
    });

    it("FedaPay, initiation incertaine sans identifiant : la notification signée valide et enregistre l'identifiant", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: null });
        expect((await fedapayApproved(p.reference, 7373)).body).toMatchObject({ outcome: "CONFIRMED" });
        const after = await state(p.id);
        expect([after.status, after.providerTransactionId]).toEqual(["VERIFIED", "7373"]);
    });
});

describe("Idempotence et notifications tardives", () => {
    it("notification valide répétée : validée une seule fois, encaissé compté une fois", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: "4242" });
        expect((await fedapayApproved(p.reference, 4242)).body).toMatchObject({ outcome: "CONFIRMED" });
        expect((await fedapayApproved(p.reference, 4242)).body).toMatchObject({ outcome: "ALREADY_PROCESSED" });
        expect((await balance(p.feeId))!.settled).toBe(20000);
        expect((await state(p.id)).notes?.match(/Confirmé par/g)).toHaveLength(1);
    });

    it("tardive sur un paiement annulé à la main : bon fournisseur → validé et signalé (règle 3b inchangée)", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: "4242", status: "CANCELLED", cancellationSource: "MANUAL" });
        expect((await fedapayApproved(p.reference, 4242)).body).toMatchObject({ outcome: "CONFIRMED" });
        const after = await state(p.id);
        expect([after.status, after.cancellationSource]).toEqual(["VERIFIED", "MANUAL"]);
        expect(await prisma.notification.count({ where: { title: "Paiement validé après une annulation", message: { contains: p.reference } } })).toBe(1);
    });

    it("tardive sur un paiement annulé, autre fournisseur : refusé, reste annulé, origine conservée", async () => {
        const p = await pending({ provider: "MOMO", providerTransactionId: "momo-ref", status: "CANCELLED", cancellationSource: "PROVIDER" });
        expect((await fedapayApproved(p.reference, 4242)).body).toMatchObject({ outcome: "REJECTED" });
        const after = await state(p.id);
        expect([after.status, after.cancellationSource, after.providerTransactionId]).toEqual(["CANCELLED", "PROVIDER", "momo-ref"]);
    });
});

describe("Confirmations concurrentes (PostgreSQL)", () => {
    it("une notification valide et une autre transaction en même temps : une seule validation, identifiant d'origine", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: "4242" });
        const outcomes = (await Promise.all([confirm(p.reference, "FEDAPAY", "4242"), confirm(p.reference, "FEDAPAY", "5151")])).map((r) => r.outcome);
        expect(outcomes.sort()).toEqual(["CONFIRMED", "REJECTED"]);
        const after = await state(p.id);
        expect([after.status, after.providerTransactionId]).toEqual(["VERIFIED", "4242"]);
        expect((await balance(p.feeId))!.settled).toBe(20000);
    });

    it("deux notifications valides simultanées : une validation, l'autre déjà traitée, encaissé compté une fois", async () => {
        const p = await pending({ provider: "FEDAPAY", providerTransactionId: "4242" });
        const outcomes = (await Promise.all([confirm(p.reference, "FEDAPAY", "4242"), confirm(p.reference, "FEDAPAY", "4242")])).map((r) => r.outcome);
        expect(outcomes.sort()).toEqual(["ALREADY_PROCESSED", "CONFIRMED"]);
        expect((await balance(p.feeId))!.settled).toBe(20000);
    });
});
