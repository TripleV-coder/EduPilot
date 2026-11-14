import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { ONLINE_PAYMENT_TTL_MS, confirmOnlinePayment, reconcileStalePayments } from "@/lib/finance/online-payments";
import { runInstallmentReminders } from "@/lib/finance/reminders";
import { POST as cashPayment } from "@/app/api/payments/cash/route";

/**
 * Lot 3a (audit paiements, P-01) — une confirmation en ligne passait le
 * paiement à VERIFIED sans recalculer l'échéancier : total payé du plan et
 * état des échéances restaient périmés. Conséquences : relances « en retard »
 * pour une échéance déjà payée, plafond du guichet calculé sur un total faux
 * (second encaissement accepté). `confirmOnlinePayment` est le chemin commun
 * des trois webhooks et de la réconciliation à 24 h.
 */
let schoolId: string;
let studentId: string;
let parentUserId: string;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

/** Frais, échéancier de deux échéances et paiement en ligne en attente. */
async function planWithPendingOnline(opts: { total?: number; firstDue?: Date; secondDue?: Date; online?: number } = {}) {
    const total = opts.total ?? 50000;
    const fee = await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount: total } });
    const plan = await prisma.paymentPlan.create({
        data: {
            studentId, feeId: fee.id, totalAmount: total, installments: 2, paidAmount: 0, status: "ACTIVE",
            installmentPayments: {
                create: [
                    { amount: total / 2, dueDate: opts.firstDue ?? day(10), status: "PENDING" },
                    { amount: total / 2, dueDate: opts.secondDue ?? day(40), status: "PENDING" },
                ],
            },
        },
    });
    const reference = uniqueCode("PAY");
    const payment = await prisma.payment.create({
        data: {
            studentId, feeId: fee.id, amount: opts.online ?? total / 2, method: "MOBILE_MONEY_MTN", status: "PENDING",
            reference, provider: "MOMO", providerTransactionId: uniqueCode("MTN"),
        },
    });
    return { feeId: fee.id, planId: plan.id, paymentId: payment.id, reference, providerTransactionId: payment.providerTransactionId! };
}
const confirm = (reference: string, amount: number) =>
    runAsSystem("test:ledger", () =>
        confirmOnlinePayment({ reference, provider: "MOMO", receivedAmount: amount, receivedCurrency: "XOF", source: "test" }),
    );
const planState = async (planId: string) => {
    const plan = await prisma.paymentPlan.findUniqueOrThrow({
        where: { id: planId },
        include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
    });
    return { paidAmount: Number(plan.paidAmount), status: plan.status, installments: plan.installmentPayments.map((i) => i.status) };
};

beforeAll(async () => {
    schoolId = (await createSchool("IT-LEDGER")).id;
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Afi", lastName: "Ledger", role: "STUDENT", schoolId },
    });
    studentId = (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
    const parent = await prisma.user.create({
        data: { email: `${uniqueCode("parent")}@integration.test`, password: "x", firstName: "Parent", lastName: "Ledger", role: "PARENT", schoolId },
    });
    const profile = await prisma.parentProfile.create({ data: { userId: parent.id } });
    await prisma.parentStudent.create({ data: { parentId: profile.id, studentId, relationship: "PARENT" } });
    parentUserId = parent.id;
});

describe("Confirmation en ligne : échéancier recalculé immédiatement", () => {
    it("total payé et état des échéances à jour dès la confirmation", async () => {
        const p = await planWithPendingOnline();
        expect(await confirm(p.reference, 25000)).toMatchObject({ outcome: "CONFIRMED", overpaid: 0 });
        expect(await planState(p.planId)).toEqual({ paidAmount: 25000, status: "ACTIVE", installments: ["PAID", "PENDING"] });
        const first = await prisma.installmentPayment.findFirstOrThrow({ where: { paymentPlanId: p.planId }, orderBy: { dueDate: "asc" } });
        expect(first.paidAt).not.toBeNull();
    });

    it("confirmation rejouée : aucun double comptage", async () => {
        const p = await planWithPendingOnline();
        await confirm(p.reference, 25000);
        expect(await confirm(p.reference, 25000)).toMatchObject({ outcome: "ALREADY_PROCESSED" });
        expect((await planState(p.planId)).paidAmount).toBe(25000);
        expect(await prisma.payment.count({ where: { feeId: p.feeId, status: "VERIFIED" } })).toBe(1);
    });

    it("confirmation tardive (paiement expiré) : validée, signalée, échéancier recalculé", async () => {
        const p = await planWithPendingOnline({ online: 50000 });
        await prisma.payment.update({ where: { id: p.paymentId }, data: { status: "EXPIRED", notes: "Non confirmé après 24 h : à rapprocher." } });
        expect(await confirm(p.reference, 50000)).toMatchObject({ outcome: "CONFIRMED" });
        expect(await planState(p.planId)).toEqual({ paidAmount: 50000, status: "COMPLETED", installments: ["PAID", "PAID"] });
        const notes = (await prisma.payment.findUniqueOrThrow({ where: { id: p.paymentId } })).notes!;
        expect(notes).toContain("Non confirmé après 24 h");
        expect(notes).toContain("confirmation tardive");
    });

    it("réconciliation à 24 h (payé chez le fournisseur) : échéancier cohérent", async () => {
        const p = await planWithPendingOnline();
        await prisma.payment.update({ where: { id: p.paymentId }, data: { createdAt: new Date(Date.now() - ONLINE_PAYMENT_TTL_MS - 60_000) } });
        const report = await runAsSystem("test:ledger", () =>
            reconcileStalePayments(async (_provider, transactionId) => ({
                status: transactionId === p.providerTransactionId ? "SUCCESS" : "PENDING",
                rawData: { amount: 25000, currency: "XOF" },
            })),
        );
        expect(report.confirmed).toBeGreaterThanOrEqual(1);
        expect(await planState(p.planId)).toEqual({ paidAmount: 25000, status: "ACTIVE", installments: ["PAID", "PENDING"] });
    });

    it("erreur pendant le recalcul : rien n'est validé, plan et échéances intacts", async () => {
        const p = await planWithPendingOnline();
        // Échec simulé de l'écriture du plan, pour ce seul plan
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION it_fail_plan_update() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW."id" = '${p.planId}' THEN RAISE EXCEPTION 'échec simulé du recalcul'; END IF;
              RETURN NEW;
            END $$;`);
        await prisma.$executeRawUnsafe(`CREATE TRIGGER it_fail_plan_update BEFORE UPDATE ON "payment_plans" FOR EACH ROW EXECUTE FUNCTION it_fail_plan_update()`);
        try {
            await expect(confirm(p.reference, 25000)).rejects.toThrow();
        } finally {
            await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS it_fail_plan_update ON "payment_plans"`);
            await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS it_fail_plan_update()`);
        }
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.paymentId } })).status).toBe("PENDING");
        expect(await planState(p.planId)).toEqual({ paidAmount: 0, status: "ACTIVE", installments: ["PENDING", "PENDING"] });
        // Une nouvelle confirmation passe ensuite normalement
        expect(await confirm(p.reference, 25000)).toMatchObject({ outcome: "CONFIRMED" });
        expect((await planState(p.planId)).paidAmount).toBe(25000);
    });

    it("réconciliation : un paiement dont la validation échoue n'empêche pas de valider les autres", async () => {
        const failing = await planWithPendingOnline();
        const ok = await planWithPendingOnline();
        const old = new Date(Date.now() - ONLINE_PAYMENT_TTL_MS - 60_000);
        await prisma.payment.updateMany({ where: { id: { in: [failing.paymentId, ok.paymentId] } }, data: { createdAt: old } });
        await prisma.$executeRawUnsafe(`
            CREATE OR REPLACE FUNCTION it_fail_plan_update() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW."id" = '${failing.planId}' THEN RAISE EXCEPTION 'échec simulé du recalcul'; END IF;
              RETURN NEW;
            END $$;`);
        await prisma.$executeRawUnsafe(`CREATE TRIGGER it_fail_plan_update BEFORE UPDATE ON "payment_plans" FOR EACH ROW EXECUTE FUNCTION it_fail_plan_update()`);
        let report;
        try {
            report = await runAsSystem("test:ledger", () =>
                reconcileStalePayments(async (_provider, transactionId) => ({
                    status: [failing.providerTransactionId, ok.providerTransactionId].includes(transactionId) ? "SUCCESS" : "PENDING",
                    rawData: { amount: 25000, currency: "XOF" },
                })),
            );
        } finally {
            await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS it_fail_plan_update ON "payment_plans"`);
            await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS it_fail_plan_update()`);
        }
        expect(report.failed).toBeGreaterThanOrEqual(1);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: failing.paymentId } })).status).toBe("PENDING");
        expect(await planState(failing.planId)).toEqual({ paidAmount: 0, status: "ACTIVE", installments: ["PENDING", "PENDING"] });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: ok.paymentId } })).status).toBe("VERIFIED");
        expect((await planState(ok.planId)).paidAmount).toBe(25000);
    });

    it("échéance payée en ligne : aucune relance de retard pour le parent", async () => {
        const p = await planWithPendingOnline({ firstDue: day(-3), secondDue: day(60) });
        await confirm(p.reference, 25000);
        const before = await prisma.notification.count({ where: { userId: parentUserId } });
        await runAsSystem("test:ledger", () => runInstallmentReminders(new Date()));
        const first = await prisma.installmentPayment.findFirstOrThrow({ where: { paymentPlanId: p.planId }, orderBy: { dueDate: "asc" } });
        expect(first.status).toBe("PAID");
        expect(first.lastReminderStage).toBeNull();
        expect(await prisma.notification.count({ where: { userId: parentUserId } })).toBe(before);
    });

    it("guichet après un paiement en ligne du solde : second encaissement refusé, rien créé", async () => {
        const p = await planWithPendingOnline({ online: 50000 });
        await confirm(p.reference, 50000);
        actAs(sessionFor("ACCOUNTANT", schoolId));
        const res = await callRoute(cashPayment, {
            method: "POST", path: "/api/payments/cash",
            body: { studentId, feeId: p.feeId, amount: 50000, method: "CASH" },
        });
        expect(res.status).toBe(400);
        expect(await prisma.payment.count({ where: { feeId: p.feeId, method: "CASH" } })).toBe(0);
    });
});
