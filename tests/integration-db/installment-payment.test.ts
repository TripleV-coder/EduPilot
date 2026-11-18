import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as payInstallment } from "@/app/api/payment-plans/[id]/installments/[installmentId]/pay/route";
import { POST as cashPayment } from "@/app/api/payments/cash/route";

/**
 * Lot 3c (audit paiements, P-05) — le paiement d'une échéance acceptait
 * n'importe quelle échéance non payée et encaissait son montant INITIAL ;
 * l'imputation chronologique (syncPaymentPlanLedger) affectait ensuite le
 * paiement à l'échéance la plus ancienne. L'écran proposait même d'encaisser
 * l'échéance « à venir » en sautant une échéance en retard. Désormais : seule
 * l'échéance la plus ancienne non soldée se règle, pour son reste.
 */
let schoolId: string;
let accountant: Session;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

async function newStudent() {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "Echeance", role: "STUDENT", schoolId },
    });
    return (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
}
/** Frais et échéancier de deux échéances de 25 000 FCFA. */
async function planOf(dues: [Date, Date] = [day(10), day(40)], statuses: [string, string] = ["PENDING", "PENDING"]) {
    const studentId = await newStudent();
    const feeId = (await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount: 50000 } })).id;
    const plan = await prisma.paymentPlan.create({
        data: {
            studentId, feeId, totalAmount: 50000, installments: 2, paidAmount: 0, status: "ACTIVE",
            installmentPayments: {
                create: [
                    { amount: 25000, dueDate: dues[0], status: statuses[0] as "PENDING" },
                    { amount: 25000, dueDate: dues[1], status: statuses[1] as "PENDING" },
                ],
            },
        },
        include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
    });
    return { studentId, feeId, planId: plan.id, first: plan.installmentPayments[0].id, second: plan.installmentPayments[1].id };
}
const pay = (planId: string, installmentId: string, body: Record<string, unknown> = { method: "CASH" }) =>
    callRoute(payInstallment, {
        method: "POST", path: `/api/payment-plans/${planId}/installments/${installmentId}/pay`,
        params: { id: planId, installmentId }, body,
    });
const cash = (studentId: string, feeId: string, amount: number, extra: Record<string, unknown> = {}) =>
    callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: { studentId, feeId, amount, method: "CASH", ...extra } });
const payments = (studentId: string, feeId: string) =>
    prisma.payment.findMany({ where: { studentId, feeId, status: { in: ["VERIFIED", "RECONCILED"] } }, orderBy: { createdAt: "asc" } });

/** Total payé = somme des paiements ; échéances = imputation chronologique de cette somme. */
async function expectConsistent(studentId: string, feeId: string) {
    const plan = await prisma.paymentPlan.findFirstOrThrow({
        where: { studentId, feeId, status: { not: "CANCELLED" } },
        include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
    });
    const sum = (await payments(studentId, feeId)).reduce((s, p) => s + Number(p.amount), 0);
    expect(Number(plan.paidAmount)).toBe(sum);
    let left = sum;
    for (const i of plan.installmentPayments) {
        expect(i.status === "PAID").toBe(left >= Number(i.amount));
        left = Math.max(0, left - Number(i.amount));
    }
    return { sum, statuses: plan.installmentPayments.map((i) => i.status), planStatus: plan.status };
}

beforeAll(async () => {
    schoolId = (await createSchool("IT-3C")).id;
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "3c", role: "ACCOUNTANT", schoolId },
    });
    accountant = sessionFor("ACCOUNTANT", schoolId, user.id);
});
beforeEach(() => actAs(accountant));

describe("Paiement d'une échéance : imputation chronologique respectée", () => {
    it("première échéance impayée : réglée, la réponse montre l'état final", async () => {
        const p = await planOf();
        const res = await pay(p.planId, p.first);
        expect(res.status).toBe(200);
        expect((res.body as { installment: { id: string; status: string } }).installment).toMatchObject({ id: p.first, status: "PAID" });
        expect((await payments(p.studentId, p.feeId)).map((x) => Number(x.amount))).toEqual([25000]);
        expect(await expectConsistent(p.studentId, p.feeId)).toMatchObject({ sum: 25000, statuses: ["PAID", "PENDING"] });
    });

    it("échéance ultérieure alors qu'une précédente reste impayée : refusée clairement, rien n'est encaissé", async () => {
        const p = await planOf();
        const res = await pay(p.planId, p.second);
        expect(res.status).toBe(409);
        expect((res.body as { error: string }).error).toMatch(/^Réglez d'abord l'échéance du .+ \(reste 25000 FCFA\)/);
        expect(await payments(p.studentId, p.feeId)).toHaveLength(0);
        expect(await expectConsistent(p.studentId, p.feeId)).toMatchObject({ sum: 0, statuses: ["PENDING", "PENDING"] });
    });

    it("première échéance EN RETARD et suivante à venir : la suivante est refusée, la première se règle", async () => {
        const p = await planOf([day(-5), day(25)], ["OVERDUE", "PENDING"]);
        expect((await pay(p.planId, p.second)).status).toBe(409);
        expect((await pay(p.planId, p.first)).status).toBe(200);
        expect(await expectConsistent(p.studentId, p.feeId)).toMatchObject({ sum: 25000, statuses: ["PAID", "PENDING"] });
    });

    it("échéance déjà en partie payée au guichet : seul son reste est encaissé", async () => {
        const p = await planOf();
        expect((await cash(p.studentId, p.feeId, 10000)).status).toBe(200);
        expect((await pay(p.planId, p.first)).status).toBe(200);
        expect((await payments(p.studentId, p.feeId)).map((x) => Number(x.amount))).toEqual([10000, 15000]);
        expect(await expectConsistent(p.studentId, p.feeId)).toMatchObject({ sum: 25000, statuses: ["PAID", "PENDING"] });
    });

    it("reste dû inférieur au montant de la dernière échéance : son reste seul est encaissé, plan soldé", async () => {
        const p = await planOf();
        expect((await cash(p.studentId, p.feeId, 40000)).status).toBe(200);
        expect((await pay(p.planId, p.first)).status).toBe(400); // déjà soldée
        expect((await pay(p.planId, p.second)).status).toBe(200);
        expect((await payments(p.studentId, p.feeId)).map((x) => Number(x.amount))).toEqual([40000, 10000]);
        expect(await expectConsistent(p.studentId, p.feeId)).toMatchObject({ sum: 50000, statuses: ["PAID", "PAID"], planStatus: "COMPLETED" });
    });

    it("reste de l'échéance supérieur au disponible (paiement en ligne en attente) : refusé, rien n'est écrit", async () => {
        const p = await planOf();
        await prisma.payment.create({
            data: { studentId: p.studentId, feeId: p.feeId, amount: 40000, method: "MOBILE_MONEY_MTN", status: "PENDING", reference: uniqueCode("PAY"), provider: "MOMO" },
        });
        const res = await pay(p.planId, p.first);
        expect(res.status).toBe(400);
        expect((res.body as { error: string }).error).toContain("dépasse le reste à payer disponible (10000 FCFA)");
        expect(await payments(p.studentId, p.feeId)).toHaveLength(0);
    });

    it("référence déjà utilisée : 409, ni paiement ni changement d'échéance", async () => {
        const p = await planOf();
        const reference = uniqueCode("CHQ");
        expect((await cash(p.studentId, p.feeId, 1000, { method: "CHECK", reference })).status).toBe(200);
        expect((await pay(p.planId, p.first, { method: "CHECK", reference })).status).toBe(409);
        expect(await expectConsistent(p.studentId, p.feeId)).toMatchObject({ sum: 1000, statuses: ["PENDING", "PENDING"] });
    });

    it("double clic simultané sur la même échéance : un seul encaissement", async () => {
        const p = await planOf();
        const results = await Promise.all([pay(p.planId, p.first), pay(p.planId, p.first)]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
        expect(await payments(p.studentId, p.feeId)).toHaveLength(1);
        expect(await expectConsistent(p.studentId, p.feeId)).toMatchObject({ sum: 25000 });
    });

    it("deux échéances payées simultanément : jamais l'ultérieure avant l'antérieure, total cohérent", async () => {
        const p = await planOf();
        const [a, b] = await Promise.all([pay(p.planId, p.first), pay(p.planId, p.second)]);
        expect(a.status).toBe(200);
        // L'ultérieure passe seulement si l'antérieure a été réglée juste avant elle
        expect([200, 409]).toContain(b.status);
        const { sum } = await expectConsistent(p.studentId, p.feeId);
        expect(sum).toBe(b.status === 200 ? 50000 : 25000);
    });
});
