import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { enrollInCurrentYear } from "./fixtures/enrollment";
import { runAsSystem } from "@/lib/db/db-context";
import { POST as createScholarship } from "@/app/api/scholarships/route";
import { PATCH as patchScholarship, DELETE as deleteScholarship } from "@/app/api/scholarships/[id]/route";
import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { getFeeBalance } from "@/lib/finance/online-payments";
import { computeStudentBalances } from "@/lib/finance/expected-fees";

/**
 * FIN-01 (audit du 2026-11-24) — une bourse change le dû PARTOUT et TOUT DE
 * SUITE : sans échéancier (solde, plafond du guichet), avec échéancier
 * (recalcul à partir de la dernière échéance), au retrait (dû rétabli), et
 * un trop-perçu est signalé pour remboursement. Avant : la bourse n'était lue
 * qu'à la création d'un échéancier, un montant fixe déduit de chaque frais.
 */
let schoolId: string;
let admin: Session;
let accountant: Session;
let accountantId: string;
/** Niveau propre à chaque test : un élève ne doit que les frais créés pour lui. */
let level: string;

async function enrolledStudent() {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Awa", lastName: "Boursière", role: "STUDENT", schoolId },
    });
    const id = (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
    await enrollInCurrentYear(id, schoolId, level);
    return id;
}
async function newFee(amount: number, extra: { isRequired?: boolean; dueDate?: Date } = {}) {
    return (await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount, classLevelCode: level, ...extra } })).id;
}
async function newPlan(studentId: string, feeId: string, total: number) {
    return prisma.paymentPlan.create({
        data: {
            studentId, feeId, totalAmount: total, installments: 2, paidAmount: 0, status: "ACTIVE",
            installmentPayments: {
                create: [
                    { amount: total / 2, dueDate: new Date(Date.now() + 10 * 86_400_000), status: "PENDING" },
                    { amount: total / 2, dueDate: new Date(Date.now() + 40 * 86_400_000), status: "PENDING" },
                ],
            },
        },
    });
}
const grant = (studentId: string, extra: Record<string, unknown>) => {
    actAs(admin);
    return callRoute(createScholarship, {
        method: "POST",
        path: "/api/scholarships",
        body: { studentId, name: "Bourse d'excellence", type: "MERIT", startDate: new Date("2026-10-01").toISOString(), ...extra },
    });
};
const cash = (studentId: string, feeId: string, amount: number) => {
    actAs(accountant);
    return callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: { studentId, feeId, amount, method: "CASH" } });
};
const balance = (studentId: string, feeId: string) =>
    runAsSystem("test:fin-01", () => prisma.$transaction((tx) => getFeeBalance(tx, studentId, feeId)));
const installments = async (studentId: string, feeId: string) =>
    (
        await prisma.paymentPlan.findFirstOrThrow({
            where: { studentId, feeId, status: { not: "CANCELLED" } },
            include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
        })
    ).installmentPayments.map((i) => ({ amount: Number(i.amount), status: i.status }));
const planTotal = async (studentId: string, feeId: string) =>
    Number((await prisma.paymentPlan.findFirstOrThrow({ where: { studentId, feeId, status: { not: "CANCELLED" } } })).totalAmount);

beforeAll(async () => {
    schoolId = (await createSchool("IT-FIN01")).id;
    const mk = (role: "ACCOUNTANT" | "SCHOOL_ADMIN") =>
        prisma.user.create({ data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "FIN01", role, schoolId } });
    admin = sessionFor("SCHOOL_ADMIN", schoolId, (await mk("SCHOOL_ADMIN")).id);
    const acc = await mk("ACCOUNTANT");
    accountantId = acc.id;
    accountant = sessionFor("ACCOUNTANT", schoolId, acc.id);
});
beforeEach(() => {
    actAs(admin);
    level = uniqueCode("NIV");
});

describe("FIN-01 — sans échéancier", () => {
    it("bourse de 50 % : solde, plafond du guichet et solde famille réduits de moitié", async () => {
        const s = await enrolledStudent();
        const f = await newFee(50_000);
        expect((await grant(s, { percentage: 50 })).status).toBe(201);

        expect(await balance(s, f)).toMatchObject({ billed: 25_000, remaining: 25_000 });
        expect((await computeStudentBalances(s)).find((b) => b.feeId === f)?.billed).toBe(25_000);
        expect((await cash(s, f, 25_001)).status).toBe(400);
        expect((await cash(s, f, 25_000)).status).toBe(200);
        expect(await balance(s, f)).toMatchObject({ remaining: 0 });
    });

    it("montant fixe sur deux frais : une seule enveloppe (40 000 au total, pas 80 000)", async () => {
        const s = await enrolledStudent();
        const f1 = await newFee(30_000, { dueDate: new Date("2026-10-15") });
        const f2 = await newFee(30_000, { dueDate: new Date("2027-01-15") });
        expect((await grant(s, { amount: 40_000 })).status).toBe(201);
        const [b1, b2] = [await balance(s, f1), await balance(s, f2)];
        expect([b1?.billed, b2?.billed]).toEqual([0, 20_000]);
    });

    it("frais visés par l'école : seule la cantine (facultative) est réduite", async () => {
        const s = await enrolledStudent();
        const scolarite = await newFee(100_000);
        const cantine = await newFee(30_000, { isRequired: false });
        expect((await grant(s, { percentage: 50, feeIds: [cantine] })).status).toBe(201);
        expect((await balance(s, scolarite))?.billed).toBe(100_000);
        expect((await balance(s, cantine))?.billed).toBe(15_000);
    });

    it("frais d'une autre école dans feeIds : refusé, aucune bourse créée", async () => {
        const s = await enrolledStudent();
        const other = await createSchool("IT-FIN01-B");
        const foreign = (await prisma.fee.create({ data: { schoolId: other.id, name: "Étranger", amount: 1000 } })).id;
        expect((await grant(s, { percentage: 10, feeIds: [foreign] })).status).toBe(400);
        expect(await prisma.scholarship.count({ where: { studentId: s } })).toBe(0);
    });

    it("montant ET pourcentage : refusé (une seule forme)", async () => {
        const s = await enrolledStudent();
        expect((await grant(s, { amount: 1000, percentage: 10 })).status).toBe(400);
    });
});

describe("FIN-01 — bourse accordée après un premier paiement (scénario n° 6 de la mission)", () => {
    it("échéancier réduit à partir de la DERNIÈRE échéance ; l'échéance payée reste intacte", async () => {
        const s = await enrolledStudent();
        const f = await newFee(50_000);
        await newPlan(s, f, 50_000);
        expect((await cash(s, f, 25_000)).status).toBe(200);

        const res = await grant(s, { amount: 20_000 });
        expect(res.status).toBe(201);
        expect((res.body as { planAdjustments: unknown[] }).planAdjustments).toEqual([
            expect.objectContaining({ previousTotal: 50_000, newTotal: 30_000, overpaid: 0 }),
        ]);
        expect(await planTotal(s, f)).toBe(30_000);
        expect(await installments(s, f)).toEqual([
            { amount: 25_000, status: "PAID" },
            { amount: 5_000, status: "PENDING" },
        ]);
        expect(await balance(s, f)).toMatchObject({ billed: 30_000, remaining: 5_000 });
    });

    it("déjà tout payé puis bourse de 40 % : trop-perçu signalé à la comptabilité, rien d'effacé", async () => {
        const s = await enrolledStudent();
        const f = await newFee(50_000);
        await newPlan(s, f, 50_000);
        expect((await cash(s, f, 50_000)).status).toBe(200);
        const before = await prisma.notification.count({ where: { userId: accountantId, title: "Trop-perçu à rembourser" } });

        const res = await grant(s, { percentage: 40 });
        expect(res.status).toBe(201);
        expect((res.body as { planAdjustments: Array<{ overpaid: number }> }).planAdjustments[0].overpaid).toBe(20_000);
        expect(await planTotal(s, f)).toBe(30_000);
        // Le paiement encaissé n'est ni modifié ni supprimé
        const payments = await prisma.payment.findMany({ where: { studentId: s, feeId: f } });
        expect(payments.map((p) => Number(p.amount))).toEqual([50_000]);
        const alerts = await prisma.notification.findMany({ where: { userId: accountantId, title: "Trop-perçu à rembourser" }, orderBy: { createdAt: "asc" } });
        expect(alerts.length).toBe(before + 1);
        expect(alerts.at(-1)?.message).toMatch(/20\s000 F/);
    });
});

describe("FIN-01 — retrait et modification", () => {
    it("désactivation puis suppression : le dû revient au montant plein, hausse sur la dernière échéance", async () => {
        const s = await enrolledStudent();
        const f = await newFee(50_000);
        await newPlan(s, f, 50_000);
        const created = await grant(s, { percentage: 50 });
        const id = (created.body as { id: string }).id;
        expect(await planTotal(s, f)).toBe(25_000);

        actAs(admin);
        const off = await callRoute(patchScholarship, { method: "PATCH", path: `/api/scholarships/${id}`, params: { id }, body: { isActive: false } });
        expect(off.status).toBe(200);
        expect(await planTotal(s, f)).toBe(50_000);

        await callRoute(patchScholarship, { method: "PATCH", path: `/api/scholarships/${id}`, params: { id }, body: { isActive: true } });
        expect(await planTotal(s, f)).toBe(25_000);
        actAs(admin);
        expect((await callRoute(deleteScholarship, { method: "DELETE", path: `/api/scholarships/${id}`, params: { id } })).status).toBe(200);
        expect(await planTotal(s, f)).toBe(50_000);
        expect((await installments(s, f)).reduce((sum, i) => sum + i.amount, 0)).toBe(50_000);
    });

    it("passer de 50 % à un montant fixe : le pourcentage ne reste pas appliqué", async () => {
        const s = await enrolledStudent();
        const f = await newFee(50_000);
        const id = ((await grant(s, { percentage: 50 })).body as { id: string }).id;
        actAs(admin);
        await callRoute(patchScholarship, { method: "PATCH", path: `/api/scholarships/${id}`, params: { id }, body: { amount: 10_000 } });
        expect((await balance(s, f))?.billed).toBe(40_000);
    });
});

describe("FIN-01 — concurrence", () => {
    it("bourse accordée pendant un encaissement au guichet : échéancier et total payés cohérents", async () => {
        const s = await enrolledStudent();
        const f = await newFee(60_000);
        await newPlan(s, f, 60_000);
        const [g, c] = await Promise.all([grant(s, { amount: 20_000 }), cash(s, f, 30_000)]);
        expect(g.status).toBe(201);
        expect(c.status).toBe(200);
        const plan = await prisma.paymentPlan.findFirstOrThrow({
            where: { studentId: s, feeId: f, status: { not: "CANCELLED" } },
            include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
        });
        expect(Number(plan.totalAmount)).toBe(40_000);
        expect(Number(plan.paidAmount)).toBe(30_000);
        const live = plan.installmentPayments.filter((i) => i.status !== "CANCELLED");
        expect(live.reduce((sum, i) => sum + Number(i.amount), 0)).toBe(40_000);
        expect(live[0]).toMatchObject({ status: "PAID" });
    });
});
