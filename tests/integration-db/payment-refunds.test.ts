import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { POST as refundRoute } from "@/app/api/payments/[id]/refund/route";
import { PATCH as editPayment, DELETE as cancelPayment } from "@/app/api/payments/[id]/route";
import { getFeeBalance } from "@/lib/finance/online-payments";

/**
 * Remboursements tracés dans EduPilot (décision du 2026-11-02) : écriture
 * d'extourne négative liée au paiement. Vérifie sur un vrai PostgreSQL le
 * reste à payer, l'échéancier, le plafond, la concurrence, l'annulation et le
 * cloisonnement par école.
 */
let schoolId: string;
let otherSchoolId: string;
let accountant: Session;
let otherAccountant: Session;
let parentUserId: string;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);

async function setup() {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Ismaël", lastName: "Gnanhoui", role: "STUDENT", schoolId },
    });
    const studentId = (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
    const parentProfile = await prisma.parentProfile.findFirstOrThrow({ where: { userId: parentUserId } });
    await prisma.parentStudent.create({ data: { parentId: parentProfile.id, studentId, relationship: "MOTHER" } });
    const feeId = (await prisma.fee.create({ data: { schoolId, name: `Scolarité ${uniqueCode("F")}`, amount: 50000 } })).id;
    await prisma.paymentPlan.create({
        data: {
            studentId, feeId, totalAmount: 50000, installments: 2, paidAmount: 0, status: "ACTIVE",
            installmentPayments: { create: [{ amount: 25000, dueDate: day(10), status: "PENDING" }, { amount: 25000, dueDate: day(40), status: "PENDING" }] },
        },
    });
    actAs(accountant);
    const paid = await callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: { studentId, feeId, amount: 50000, method: "CASH" } });
    expect(paid.status).toBe(200);
    const paymentId = (paid.body as { id: string }).id;
    return { studentId, feeId, paymentId };
}

const refund = (paymentId: string, body: Record<string, unknown>, as: Session = accountant) => {
    actAs(as);
    return callRoute(refundRoute, { method: "POST", path: `/api/payments/${paymentId}/refund`, params: { id: paymentId }, body });
};
const plan = (studentId: string, feeId: string) =>
    prisma.paymentPlan.findFirstOrThrow({ where: { studentId, feeId }, include: { installmentPayments: { orderBy: { dueDate: "asc" } } } });
const balance = (studentId: string, feeId: string) => prisma.$transaction((tx) => getFeeBalance(tx, studentId, feeId));

beforeAll(async () => {
    schoolId = (await createSchool("IT-RMB")).id;
    otherSchoolId = (await createSchool("IT-RMB-B")).id;
    const compta = await prisma.user.create({ data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "R", role: "ACCOUNTANT", schoolId } });
    const otherCompta = await prisma.user.create({ data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "B", role: "ACCOUNTANT", schoolId: otherSchoolId } });
    const parent = await prisma.user.create({ data: { email: `${uniqueCode("parent")}@integration.test`, password: "x", firstName: "Rachida", lastName: "Gnanhoui", role: "PARENT", schoolId } });
    await prisma.parentProfile.create({ data: { userId: parent.id } });
    parentUserId = parent.id;
    accountant = sessionFor("ACCOUNTANT", schoolId, compta.id);
    otherAccountant = sessionFor("ACCOUNTANT", otherSchoolId, otherCompta.id);
});
beforeEach(() => actAs(accountant));

describe("Remboursement d'un paiement encaissé", () => {
    it("remboursement partiel : reste à payer rouvert, dernière échéance redevenue due, trace complète", async () => {
        const { studentId, feeId, paymentId } = await setup();
        expect((await plan(studentId, feeId)).installmentPayments.map((i) => i.status)).toEqual(["PAID", "PAID"]);

        const res = await refund(paymentId, { amount: 20000, reason: "Départ de l'élève en cours d'année", method: "CASH" });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ amount: 20000, refundedTotal: 20000, refundable: 30000 });

        const row = await prisma.payment.findFirstOrThrow({ where: { refundOfId: paymentId } });
        expect(Number(row.amount)).toBe(-20000);
        expect(row.status).toBe("VERIFIED");

        expect(await balance(studentId, feeId)).toMatchObject({ settled: 30000, remaining: 20000 });
        const after = await plan(studentId, feeId);
        expect(Number(after.paidAmount)).toBe(30000);
        expect(after.installmentPayments.map((i) => i.status)).toEqual(["PAID", "PENDING"]);
        expect(after.status).toBe("ACTIVE");

        expect(await prisma.auditLog.count({ where: { entityId: paymentId, action: "PAYMENT_REFUND" } })).toBe(1);
        expect(await prisma.notification.count({ where: { userId: parentUserId, title: "Remboursement enregistré" } })).toBeGreaterThan(0);
    });

    it("refuse de dépasser le montant payé, y compris en deux demandes simultanées", async () => {
        const { studentId, feeId, paymentId } = await setup();
        expect((await refund(paymentId, { amount: 60000, reason: "Trop-perçu signalé", method: "CASH" })).status).toBe(400);

        const [a, b] = await Promise.all([
            refund(paymentId, { amount: 30000, reason: "Erreur de saisie au guichet", method: "CASH" }),
            refund(paymentId, { amount: 30000, reason: "Erreur de saisie au guichet", method: "CASH" }),
        ]);
        expect([a.status, b.status].sort()).toEqual([201, 400]);
        expect(await balance(studentId, feeId)).toMatchObject({ settled: 20000 });

        await refund(paymentId, { amount: 20000, reason: "Solde du remboursement", method: "BANK_TRANSFER", reference: uniqueCode("VIR") });
        const full = await refund(paymentId, { amount: 1, reason: "Encore un franc", method: "CASH" });
        expect(full.status).toBe(400);
        expect((full.body as { error: string }).error).toContain("intégralement remboursé");
        expect((await plan(studentId, feeId)).installmentPayments.map((i) => i.status)).not.toContain("PAID");
    });

    it("exige un motif et un montant entier ; un remboursement ne se rembourse pas", async () => {
        const { paymentId } = await setup();
        expect((await refund(paymentId, { amount: 1000, reason: "", method: "CASH" })).status).toBe(400);
        expect((await refund(paymentId, { amount: 1000.5, reason: "Motif valable", method: "CASH" })).status).toBe(400);
        await refund(paymentId, { amount: 1000, reason: "Motif valable", method: "CASH" });
        const refundId = (await prisma.payment.findFirstOrThrow({ where: { refundOfId: paymentId } })).id;
        expect((await refund(refundId, { amount: 500, reason: "Motif valable", method: "CASH" })).status).toBe(409);
    });

    it("cloisonnement : le comptable d'une autre école ne voit même pas le paiement (RLS, 404)", async () => {
        const { paymentId } = await setup();
        expect((await refund(paymentId, { amount: 1000, reason: "Tentative hors école", method: "CASH" }, otherAccountant)).status).toBe(404);
        expect(await prisma.payment.count({ where: { refundOfId: paymentId } })).toBe(0);
    });

    it("paiement remboursé : ni annulable ni réductible sous le remboursé ; annuler le remboursement rétablit le solde", async () => {
        const { studentId, feeId, paymentId } = await setup();
        await refund(paymentId, { amount: 10000, reason: "Activité annulée", method: "CASH" });
        const refundId = (await prisma.payment.findFirstOrThrow({ where: { refundOfId: paymentId } })).id;

        actAs(sessionFor("SCHOOL_ADMIN", schoolId));
        const cancelOriginal = await callRoute(cancelPayment, { method: "DELETE", path: `/api/payments/${paymentId}`, params: { id: paymentId } });
        expect(cancelOriginal.status).toBe(409);

        actAs(accountant);
        const shrink = await callRoute(editPayment, { method: "PATCH", path: `/api/payments/${paymentId}`, params: { id: paymentId }, body: { amount: 5000 } });
        expect(shrink.status).toBe(409);
        const editRefund = await callRoute(editPayment, { method: "PATCH", path: `/api/payments/${refundId}`, params: { id: refundId }, body: { notes: "x" } });
        expect(editRefund.status).toBe(409);

        actAs(sessionFor("SCHOOL_ADMIN", schoolId));
        const cancelRefund = await callRoute(cancelPayment, { method: "DELETE", path: `/api/payments/${refundId}`, params: { id: refundId } });
        expect(cancelRefund.status).toBe(200);
        expect(await balance(studentId, feeId)).toMatchObject({ settled: 50000, remaining: 0 });
        expect((await plan(studentId, feeId)).installmentPayments.map((i) => i.status)).toEqual(["PAID", "PAID"]);
    });

    it("garde-fou en base : aucun montant négatif hors extourne", async () => {
        const { studentId, feeId } = await setup();
        await expect(
            prisma.payment.create({ data: { studentId, feeId, amount: -5, method: "CASH", status: "VERIFIED" } }),
        ).rejects.toThrow();
    });
});
