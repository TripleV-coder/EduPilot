import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { confirmOnlinePayment, getFeeBalance } from "@/lib/finance/online-payments";
import { IncoherentPaymentPlanError, syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { runInstallmentReminders } from "@/lib/finance/reminders";
import { POST as createPlan } from "@/app/api/payment-plans/route";
import { DELETE as cancelPlan } from "@/app/api/payment-plans/[id]/route";
import { POST as payInstallment } from "@/app/api/payment-plans/[id]/installments/[installmentId]/pay/route";
import { POST as cashPayment } from "@/app/api/payments/cash/route";

/**
 * Lot 3d (audit paiements, D-1 à D-7) — plans de paiement : doublon possible
 * (contrôle limité aux plans ACTIVE, hors verrou), plan créé à zéro malgré des
 * paiements reçus, choix du plan arbitraire dans le recalcul, annulation sans
 * verrou d'un plan déjà en partie payé. Règles validées : un seul plan non
 * annulé par élève et par frais ; recalcul immédiat à la création ; annulation
 * refusée dès qu'une opération de paiement existe ; aucun doublon historique
 * modifié. Souveraineté des écoles : élève et frais d'un plan toujours du
 * même établissement, pour tous les rôles (SUPER_ADMIN compris) et en base.
 */
let schoolA: string;
let schoolB: string;
let accountantA: Session;
let accountantB: Session;
let superAdmin: Session;
const MIGRATION = path.resolve(__dirname, "../../prisma/migrations/20261017140000_payment_plan_unique_guard/migration.sql");

async function newStudent(schoolId = schoolA) {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "Plan", role: "STUDENT", schoolId },
    });
    return (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
}
const newFee = async (schoolId = schoolA, amount = 50000) =>
    (await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount } })).id;
const create = (studentId: string, feeId: string) =>
    callRoute(createPlan, {
        method: "POST", path: "/api/payment-plans",
        body: { studentId, feeId, installments: 2, startDate: new Date(Date.now() + 86_400_000).toISOString() },
    });
const cancel = (id: string) => callRoute(cancelPlan, { method: "DELETE", path: `/api/payment-plans/${id}`, params: { id } });
const cash = (studentId: string, feeId: string, amount: number) =>
    callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: { studentId, feeId, amount, method: "CASH" } });
const livePlans = (studentId: string, feeId: string) =>
    prisma.paymentPlan.findMany({ where: { studentId, feeId, status: { not: "CANCELLED" } }, include: { installmentPayments: { orderBy: { dueDate: "asc" } } } });
const settled = async (studentId: string, feeId: string) =>
    (await prisma.payment.findMany({ where: { studentId, feeId, status: { in: ["VERIFIED", "RECONCILED"] } } })).reduce((s, p) => s + Number(p.amount), 0);
const GUARDS = [
    ["payment_plans", "payment_plans_unique_guard"],
    ["installment_payments", "installment_payments_incoherent_plan_guard"],
] as const;
/**
 * Plan créé hors application, garde-fous désactivés (tous les triggers
 * utilisateur des deux tables ; les clés étrangères restent actives) : simule
 * un plan historique, doublon ou incohérent, antérieur à toute protection.
 */
async function historicalPlan(studentId: string, feeId: string, total: number, createdAt: Date, firstDueInDays = 10) {
    for (const [table] of GUARDS) await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
    try {
        return await prisma.paymentPlan.create({
            data: {
                studentId, feeId, totalAmount: total, installments: 2, paidAmount: 0, status: "ACTIVE", createdAt,
                installmentPayments: { create: [
                    { amount: total / 2, dueDate: new Date(Date.now() + firstDueInDays * 86_400_000), status: "PENDING" },
                    { amount: total / 2, dueDate: new Date(Date.now() + 40 * 86_400_000), status: "PENDING" },
                ] },
            },
            include: { installmentPayments: { orderBy: { dueDate: "asc" } } },
        });
    } finally {
        for (const [table] of GUARDS) await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
    }
}
/** Paiement historique incohérent (antérieur au garde-fou des paiements, lot S1) : inséré garde-fous désactivés. */
async function historicalPayment(data: Prisma.PaymentUncheckedCreateInput) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "payments" DISABLE TRIGGER USER`);
    try {
        return await prisma.payment.create({ data });
    } finally {
        await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ENABLE TRIGGER USER`);
    }
}
/** Plan et échéances, pour vérifier qu'aucune écriture n'a eu lieu. */
const snapshot = async (planId: string) => {
    const plan = await prisma.paymentPlan.findUniqueOrThrow({ where: { id: planId }, include: { installmentPayments: { orderBy: { dueDate: "asc" } } } });
    return {
        status: plan.status, paidAmount: Number(plan.paidAmount), totalAmount: Number(plan.totalAmount), updatedAt: plan.updatedAt.toISOString(),
        installments: plan.installmentPayments.map((i) => ({ status: i.status, paidAt: i.paidAt, amount: Number(i.amount), updatedAt: i.updatedAt.toISOString() })),
    };
};

beforeAll(async () => {
    [schoolA, schoolB] = [(await createSchool("IT-3D-A")).id, (await createSchool("IT-3D-B")).id];
    const mk = async (schoolId: string) =>
        sessionFor("ACCOUNTANT", schoolId, (await prisma.user.create({
            data: { email: `${uniqueCode("compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "3d", role: "ACCOUNTANT", schoolId },
        })).id);
    accountantA = await mk(schoolA);
    accountantB = await mk(schoolB);
    superAdmin = sessionFor("SUPER_ADMIN", null, (await prisma.user.create({
        data: { email: `${uniqueCode("root")}@integration.test`, password: "x", firstName: "Root", lastName: "3d", role: "SUPER_ADMIN" },
    })).id);
});
beforeEach(() => actAs(accountantA));

describe("Création d'un plan", () => {
    it("sans paiement préalable : plan à zéro, échéances à venir", async () => {
        const s = await newStudent();
        const f = await newFee();
        const res = await create(s, f);
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ paidAmount: "0", status: "ACTIVE" });
    });

    it("après des paiements déjà reçus : total payé et échéances justes dès la création", async () => {
        const s = await newStudent();
        const f = await newFee();
        expect((await cash(s, f, 30000)).status).toBe(200);
        const res = await create(s, f);
        expect(res.status).toBe(201);
        const body = res.body as { paidAmount: string; installmentPayments: Array<{ status: string }> };
        expect(Number(body.paidAmount)).toBe(30000);
        expect(body.installmentPayments.map((i) => i.status)).toEqual(["PAID", "PENDING"]);
    });

    it("second plan refusé (409) quel que soit le statut du premier : ACTIVE, OVERDUE, COMPLETED", async () => {
        for (const status of ["ACTIVE", "OVERDUE", "COMPLETED"] as const) {
            const s = await newStudent();
            const f = await newFee();
            const first = (await create(s, f)).body as { id: string };
            if (status !== "ACTIVE") await prisma.paymentPlan.update({ where: { id: first.id }, data: { status } });
            const second = await create(s, f);
            expect(second.status, status).toBe(409);
            expect(await livePlans(s, f), status).toHaveLength(1);
        }
    });

    it("après annulation d'un plan sans aucune opération : nouveau plan accepté", async () => {
        const s = await newStudent();
        const f = await newFee();
        const first = (await create(s, f)).body as { id: string };
        expect((await cancel(first.id)).status).toBe(200);
        expect((await create(s, f)).status).toBe(201);
        expect(await livePlans(s, f)).toHaveLength(1);
    });

    it("deux créations simultanées : un seul plan non annulé", async () => {
        const s = await newStudent();
        const f = await newFee();
        const results = await Promise.all([create(s, f), create(s, f)]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(await livePlans(s, f)).toHaveLength(1);
    });

    it("création simultanée à un encaissement : un seul plan, total payé égal aux paiements", async () => {
        const s = await newStudent();
        const f = await newFee();
        const [plan, counter] = await Promise.all([create(s, f), cash(s, f, 20000)]);
        expect(plan.status).toBe(201);
        expect(counter.status).toBe(200);
        const plans = await livePlans(s, f);
        expect(plans).toHaveLength(1);
        expect(Number(plans[0].paidAmount)).toBe(await settled(s, f));
    });

    it("école étrangère : création refusée, aucun plan", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolA);
        actAs(accountantB);
        expect([403, 404]).toContain((await create(s, f)).status);
        expect(await livePlans(s, f)).toHaveLength(0);
    });

    it("SUPER_ADMIN : élève d'une école et frais d'une autre refusés (403), aucun plan", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        actAs(superAdmin);
        expect((await create(s, f)).status).toBe(403);
        expect(await livePlans(s, f)).toHaveLength(0);
    });

    it("SUPER_ADMIN : plan accepté quand élève et frais sont de la même école", async () => {
        const s = await newStudent(schoolB);
        const f = await newFee(schoolB);
        actAs(superAdmin);
        expect((await create(s, f)).status).toBe(201);
        expect(await livePlans(s, f)).toHaveLength(1);
    });
});

describe("Garde-fou PostgreSQL", () => {
    const planRow = (studentId: string, feeId: string) => prisma.paymentPlan.create({
        data: { studentId, feeId, totalAmount: 50000, installments: 1, paidAmount: 0, status: "ACTIVE" },
    });

    it("insertion SQL directe d'un plan entre deux écoles : refusée", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        await expect(planRow(s, f)).rejects.toThrow(/même établissement/);
        expect(await livePlans(s, f)).toHaveLength(0);
    });

    it("rattachement d'un plan aux frais d'une autre école : refusé, plan inchangé", async () => {
        const s = await newStudent(schoolA);
        const plan = await planRow(s, await newFee(schoolA));
        const foreign = await newFee(schoolB);
        await expect(prisma.paymentPlan.update({ where: { id: plan.id }, data: { feeId: foreign } })).rejects.toThrow(/même établissement/);
        expect((await prisma.paymentPlan.findUniqueOrThrow({ where: { id: plan.id } })).feeId).toBe(plan.feeId);
    });

    it("insertion SQL directe d'un doublon : refusée", async () => {
        const s = await newStudent();
        const f = await newFee();
        await create(s, f);
        await expect(prisma.paymentPlan.create({ data: { studentId: s, feeId: f, totalAmount: 50000, installments: 1 } })).rejects.toThrow(/non annulé existe déjà/);
        expect(await livePlans(s, f)).toHaveLength(1);
    });

    it("réactivation d'un plan annulé alors qu'un autre est en vigueur : refusée", async () => {
        const s = await newStudent();
        const f = await newFee();
        const old = (await create(s, f)).body as { id: string };
        await cancel(old.id);
        await create(s, f);
        await expect(prisma.paymentPlan.update({ where: { id: old.id }, data: { status: "ACTIVE" } })).rejects.toThrow(/non annulé existe déjà/);
    });

    it("doublons historiques : la migration repasse, le recalcul fonctionne, toutes les fonctions visent le même plan", async () => {
        const s = await newStudent();
        const f = await newFee();
        const older = await historicalPlan(s, f, 40000, new Date(Date.now() - 2 * 86_400_000));
        const newer = await historicalPlan(s, f, 50000, new Date(Date.now() - 86_400_000));

        // La migration elle-même passe avec des doublons en base
        const sql = readFileSync(MIGRATION, "utf8");
        for (const [table, trigger] of [
            ...GUARDS,
            ["student_profiles", "student_profiles_school_change_guard"],
            ["fees", "fees_school_change_guard"],
        ]) await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "${table}"`);
        for (const statement of sql.split(/^(?=CREATE )/m).slice(1)) await prisma.$executeRawUnsafe(statement);

        // Recalcul possible (aucune erreur), sur le plan le plus récent
        expect((await cash(s, f, 25000)).status).toBe(200);
        const [o, n] = await Promise.all([
            prisma.paymentPlan.findUniqueOrThrow({ where: { id: older.id } }),
            prisma.paymentPlan.findUniqueOrThrow({ where: { id: newer.id } }),
        ]);
        expect(Number(n.paidAmount)).toBe(25000);
        expect(Number(o.paidAmount)).toBe(0); // doublon historique non modifié
        const balance = (await runAsSystem("test:3d", () => prisma.$transaction((tx) => getFeeBalance(tx, s, f))))!;
        expect(balance.billed).toBe(50000); // même plan que le recalcul

        // Le paiement d'une échéance de l'ancien plan est refusé
        const res = await callRoute(payInstallment, {
            method: "POST", path: `/api/payment-plans/${older.id}/installments/${older.installmentPayments[0].id}/pay`,
            params: { id: older.id, installmentId: older.installmentPayments[0].id }, body: { method: "CASH" },
        });
        expect(res.status).toBe(409);
        expect(await livePlans(s, f)).toHaveLength(2); // aucun doublon supprimé ni fusionné
    });
});

describe("Annulation d'un plan", () => {
    async function planWithPayment(status: "PENDING" | "VERIFIED" | "RECONCILED" | "CANCELLED" | "EXPIRED") {
        const s = await newStudent();
        const f = await newFee();
        const plan = (await create(s, f)).body as { id: string };
        await prisma.payment.create({
            data: { studentId: s, feeId: f, amount: 10000, method: "MOBILE_MONEY_MTN", status, reference: uniqueCode("PAY"), provider: "MOMO" },
        });
        return { s, f, planId: plan.id };
    }

    it("refusée (409) dès qu'une opération de paiement existe, quel que soit son statut ; rien n'est modifié", async () => {
        for (const status of ["PENDING", "VERIFIED", "RECONCILED", "CANCELLED", "EXPIRED"] as const) {
            const p = await planWithPayment(status);
            const res = await cancel(p.planId);
            expect(res.status, status).toBe(409);
            expect((await prisma.paymentPlan.findUniqueOrThrow({ where: { id: p.planId } })).status, status).not.toBe("CANCELLED");
            expect(await prisma.payment.count({ where: { studentId: p.s, feeId: p.f, status } }), status).toBe(1);
        }
    });

    it("autorisée sans aucune opération ; une seconde annulation est refusée", async () => {
        const s = await newStudent();
        const f = await newFee();
        const plan = (await create(s, f)).body as { id: string };
        expect((await cancel(plan.id)).status).toBe(200);
        expect((await cancel(plan.id)).status).toBe(400);
    });

    it("annulation simultanée à un encaissement : jamais d'annulation après un paiement validé", async () => {
        const s = await newStudent();
        const f = await newFee();
        const plan = (await create(s, f)).body as { id: string };
        const [cancelled, counter] = await Promise.all([cancel(plan.id), cash(s, f, 20000)]);
        expect(counter.status).toBe(200);
        const final = await prisma.paymentPlan.findUniqueOrThrow({ where: { id: plan.id } });
        if (cancelled.status === 200) {
            // Annulé d'abord : l'encaissement a suivi, sans plan
            expect(final.status).toBe("CANCELLED");
        } else {
            expect(cancelled.status).toBe(409);
            expect(final.status).not.toBe("CANCELLED");
            expect(Number(final.paidAmount)).toBe(await settled(s, f));
        }
    });

    it("école étrangère : annulation refusée", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolA);
        const plan = (await create(s, f)).body as { id: string };
        actAs(accountantB);
        expect([403, 404]).toContain((await cancel(plan.id)).status);
        expect((await prisma.paymentPlan.findUniqueOrThrow({ where: { id: plan.id } })).status).toBe("ACTIVE");
    });
});

describe("Plans historiques incohérents (élève et frais d'écoles différentes)", () => {
    const legacyPlan = async (firstDueInDays = 10) => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        const plan = await historicalPlan(s, f, 40000, new Date(), firstDueInDays);
        return { s, f, plan };
    };
    const rejectsFrozen = /incohérent/;

    it("création d'un plan incohérent : toujours interdite (API SUPER_ADMIN et SQL direct)", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        actAs(superAdmin);
        expect((await create(s, f)).status).toBe(403);
        await expect(prisma.paymentPlan.create({ data: { studentId: s, feeId: f, totalAmount: 1000, installments: 1, status: "CANCELLED" } })).rejects.toThrow(/même établissement/);
        expect(await prisma.paymentPlan.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });

    it("modification financière par SQL direct : refusée sur le plan et ses échéances, plan conservé à l'identique", async () => {
        const { plan } = await legacyPlan();
        const before = await snapshot(plan.id);
        const attempts = [
            () => prisma.paymentPlan.update({ where: { id: plan.id }, data: { paidAmount: 10000 } }),
            () => prisma.paymentPlan.update({ where: { id: plan.id }, data: { status: "COMPLETED" } }),
            () => prisma.paymentPlan.update({ where: { id: plan.id }, data: { status: "CANCELLED" } }),
            () => prisma.paymentPlan.update({ where: { id: plan.id }, data: { totalAmount: 1 } }),
            () => prisma.$executeRawUnsafe(`UPDATE "payment_plans" SET "paidAmount" = 40000, "status" = 'COMPLETED' WHERE "id" = $1`, plan.id),
            () => prisma.installmentPayment.update({ where: { id: plan.installmentPayments[0].id }, data: { status: "PAID", paidAt: new Date() } }),
            () => prisma.$executeRawUnsafe(`UPDATE "installment_payments" SET "amount" = 1 WHERE "paymentPlanId" = $1`, plan.id),
            () => prisma.installmentPayment.create({ data: { paymentPlanId: plan.id, amount: 5000, dueDate: new Date(), status: "PENDING" } }),
        ];
        for (const attempt of attempts) await expect(attempt()).rejects.toThrow(rejectsFrozen);
        expect(await snapshot(plan.id)).toEqual(before);
    });

    it("recalcul : refusé avant toute écriture, statut et total payé inchangés", async () => {
        const { s, f, plan } = await legacyPlan();
        // Paiement validé historique (antérieur aux contrôles d'école)
        await historicalPayment({ studentId: s, feeId: f, amount: 20000, method: "CASH", status: "VERIFIED" });
        const before = await snapshot(plan.id);
        await expect(syncPaymentPlanLedger(prisma, s, f)).rejects.toBeInstanceOf(IncoherentPaymentPlanError);
        expect(await snapshot(plan.id)).toEqual(before);
    });

    // Comptable de l'école de l'élève : seul profil qui atteint ces routes
    // (SUPER_ADMIN n'y a pas accès par rôle)
    it("paiement d'une échéance : 409, aucun paiement écrit, plan inchangé", async () => {
        const { s, f, plan } = await legacyPlan();
        const before = await snapshot(plan.id);
        const res = await callRoute(payInstallment, {
            method: "POST",
            path: `/api/payment-plans/${plan.id}/installments/${plan.installmentPayments[0].id}/pay`,
            params: { id: plan.id, installmentId: plan.installmentPayments[0].id },
            body: { method: "CASH" },
        });
        expect(res.status).toBe(409);
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
        expect(await snapshot(plan.id)).toEqual(before);
    });

    it("annulation du plan : 409, plan conservé", async () => {
        const { plan } = await legacyPlan();
        const before = await snapshot(plan.id);
        const res = await cancel(plan.id);
        expect(res.status).toBe(409);
        expect((res.body as { error: string }).error).toMatch(/établissements différents/);
        expect(await snapshot(plan.id)).toEqual(before);
    });

    it("confirmation en ligne : non validée (BLOCKED), paiement toujours en attente, tracé et signalé une seule fois", async () => {
        const { s, f, plan } = await legacyPlan();
        const reference = uniqueCode("PAY");
        const payment = await historicalPayment({
            studentId: s, feeId: f, amount: 20000, method: "MOBILE_MONEY_MTN", status: "PENDING", reference, provider: "MOMO", providerTransactionId: uniqueCode("MTN"),
        });
        const before = await snapshot(plan.id);
        const confirm = () => runAsSystem("test:3d", () =>
            confirmOnlinePayment({ reference, provider: "MOMO", receivedAmount: 20000, receivedCurrency: "XOF", source: "test" }));

        expect(await confirm()).toMatchObject({ outcome: "BLOCKED", paymentId: payment.id });
        expect(await confirm()).toMatchObject({ outcome: "BLOCKED", paymentId: payment.id });

        const after = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
        expect([after.status, after.paidAt, after.reconciledAt]).toEqual(["PENDING", null, null]);
        expect(after.notes?.match(/Validation bloquée/g)).toHaveLength(1);
        expect(await snapshot(plan.id)).toEqual(before);
        const alerts = await prisma.notification.count({ where: { title: "Paiement en ligne bloqué : plan incohérent", message: { contains: reference } } });
        expect(alerts).toBe(1); // le comptable de l'école de l'élève
    });

    it("relances : le plan incohérent est tenu à l'écart, les plans cohérents sont toujours traités", async () => {
        const { plan } = await legacyPlan(-5); // première échéance déjà passée
        const s = await newStudent();
        const coherent = (await create(s, await newFee())).body as { id: string };
        const overdueInstallment = await prisma.installmentPayment.findFirstOrThrow({ where: { paymentPlanId: coherent.id }, orderBy: { dueDate: "asc" } });
        // Échéance cohérente échue, posée hors application (le trigger l'autorise : plan cohérent)
        await prisma.installmentPayment.update({ where: { id: overdueInstallment.id }, data: { dueDate: new Date(Date.now() - 5 * 86_400_000) } });
        const before = await snapshot(plan.id);

        await runAsSystem("test:3d", () => runInstallmentReminders(new Date()));

        expect(await snapshot(plan.id)).toEqual(before);
        expect((await prisma.installmentPayment.findUniqueOrThrow({ where: { id: overdueInstallment.id } })).status).toBe("OVERDUE");
    });

    it("plans cohérents : encaissement et recalcul inchangés", async () => {
        const s = await newStudent();
        const f = await newFee();
        expect((await create(s, f)).status).toBe(201);
        expect((await cash(s, f, 25000)).status).toBe(200);
        const [plan] = await livePlans(s, f);
        expect(Number(plan.paidAmount)).toBe(25000);
        expect(plan.installmentPayments.map((i) => i.status)).toEqual(["PAID", "PENDING"]);
    });
});

describe("Changement d'école d'une fiche élève ou d'un frais", () => {
    const moveStudent = (id: string, schoolId: string) => prisma.studentProfile.update({ where: { id }, data: { schoolId } });
    const moveFee = (id: string, schoolId: string) => prisma.fee.update({ where: { id }, data: { schoolId } });
    const schoolOf = async (studentId: string, feeId: string) => [
        (await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } })).schoolId,
        (await prisma.fee.findUniqueOrThrow({ where: { id: feeId } })).schoolId,
    ];
    const refused = /Rattachement scolaire non modifiable/;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    it("sans plan lié : changement autorisé (élève et frais)", async () => {
        const s = await newStudent();
        const f = await newFee();
        await moveStudent(s, schoolB);
        await moveFee(f, schoolB);
        expect(await schoolOf(s, f)).toEqual([schoolB, schoolB]);
    });

    it("plan cohérent : changement refusé (Prisma et SQL direct), plan toujours utilisable", async () => {
        const s = await newStudent();
        const f = await newFee();
        const plan = (await create(s, f)).body as { id: string };
        await expect(moveStudent(s, schoolB)).rejects.toThrow(refused);
        await expect(moveFee(f, schoolB)).rejects.toThrow(refused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "student_profiles" SET "schoolId" = $1 WHERE "id" = $2`, schoolB, s)).rejects.toThrow(refused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "fees" SET "schoolId" = $1 WHERE "id" = $2`, schoolB, f)).rejects.toThrow(refused);
        expect(await schoolOf(s, f)).toEqual([schoolA, schoolA]);

        // Aucune régression : autres champs modifiables, même école réécrite acceptée, encaissement normal
        await prisma.studentProfile.update({ where: { id: s }, data: { address: "Cotonou", schoolId: schoolA } });
        await prisma.fee.update({ where: { id: f }, data: { name: `Frais ${uniqueCode("R")}` } });
        expect((await cash(s, f, 25000)).status).toBe(200);
        expect(Number((await prisma.paymentPlan.findUniqueOrThrow({ where: { id: plan.id } })).paidAmount)).toBe(25000);
    });

    it("plan annulé seulement : changement refusé aussi (il deviendrait un plan incohérent)", async () => {
        const s = await newStudent();
        const f = await newFee();
        const plan = (await create(s, f)).body as { id: string };
        expect((await cancel(plan.id)).status).toBe(200);
        await expect(moveStudent(s, schoolB)).rejects.toThrow(refused);
        await expect(moveFee(f, schoolB)).rejects.toThrow(refused);
    });

    it("plan historique incohérent : aucun changement, même vers l'école qui le rendrait cohérent ; plan conservé", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        const legacy = await historicalPlan(s, f, 40000, new Date());
        const before = await snapshot(legacy.id);
        await expect(moveStudent(s, schoolB)).rejects.toThrow(refused);
        await expect(moveFee(f, schoolA)).rejects.toThrow(refused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "student_profiles" SET "schoolId" = $1 WHERE "id" = $2`, schoolB, s)).rejects.toThrow(refused);
        expect(await schoolOf(s, f)).toEqual([schoolA, schoolB]);
        expect(await snapshot(legacy.id)).toEqual(before);
    });

    it("course : création de plan en cours puis changement d'école → le changement attend et est refusé", async () => {
        const s = await newStudent();
        const f = await newFee();
        const [creation, move] = await Promise.allSettled([
            prisma.$transaction(async (tx) => {
                await tx.paymentPlan.create({ data: { studentId: s, feeId: f, totalAmount: 50000, installments: 1 } });
                await sleep(400);
            }),
            sleep(100).then(() => moveStudent(s, schoolB)),
        ]);
        expect(creation.status).toBe("fulfilled");
        expect(move.status).toBe("rejected");
        expect(await schoolOf(s, f)).toEqual([schoolA, schoolA]);
    });

    it("course : changement d'école en cours puis création de plan → la création attend et est refusée", async () => {
        const s = await newStudent();
        const f = await newFee();
        const [move, creation] = await Promise.allSettled([
            prisma.$transaction(async (tx) => {
                await tx.fee.update({ where: { id: f }, data: { schoolId: schoolB } });
                await sleep(400);
            }),
            sleep(100).then(() => prisma.paymentPlan.create({ data: { studentId: s, feeId: f, totalAmount: 50000, installments: 1 } })),
        ]);
        expect(move.status).toBe("fulfilled");
        expect(creation.status).toBe("rejected");
        expect(await prisma.paymentPlan.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });
});
