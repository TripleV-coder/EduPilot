import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import appDb from "@/lib/prisma";
import { runAsSystem } from "@/lib/db/db-context";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { POST as createPayment } from "@/app/api/payments/route";

/**
 * Lot S1 (audit de souveraineté, D-01/D-02) — la base ne garantissait pas que
 * l'élève et le frais d'un paiement relèvent du même établissement : seules
 * les routes le vérifiaient (lot 3f). Et l'école d'un élève ou d'un frais
 * ayant des paiements (sans plan) restait modifiable, mêlant les finances de
 * deux écoles.
 */
let schoolA: string;
let schoolB: string;
let accountantA: Session;
let superAdmin: Session;

async function newStudent(schoolId = schoolA) {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "S1", role: "STUDENT", schoolId },
    });
    return (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId } })).id;
}
const newFee = async (schoolId = schoolA) =>
    (await prisma.fee.create({ data: { schoolId, name: `Frais ${uniqueCode("F")}`, amount: 50000 } })).id;
const paymentRow = (studentId: string, feeId: string, status: "VERIFIED" | "PENDING" | "CANCELLED" = "VERIFIED") =>
    prisma.payment.create({ data: { studentId, feeId, amount: 10000, method: "CASH", status } });
const cash = (studentId: string, feeId: string) =>
    callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: { studentId, feeId, amount: 10000, method: "CASH" } });
const schoolOf = async (studentId: string, feeId: string) => [
    (await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId } })).schoolId,
    (await prisma.fee.findUniqueOrThrow({ where: { id: feeId } })).schoolId,
];
const sameSchoolRefused = /même établissement/;
const moveRefused = /Rattachement scolaire non modifiable/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Paiement créé hors application, garde-fous désactivés : simule un paiement historique incohérent. */
async function historicalPayment(studentId: string, feeId: string) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "payments" DISABLE TRIGGER USER`);
    try {
        return await paymentRow(studentId, feeId, "PENDING");
    } finally {
        await prisma.$executeRawUnsafe(`ALTER TABLE "payments" ENABLE TRIGGER USER`);
    }
}

beforeAll(async () => {
    [schoolA, schoolB] = [(await createSchool("IT-S1-A")).id, (await createSchool("IT-S1-B")).id];
    const user = (role: "ACCOUNTANT" | "SUPER_ADMIN", schoolId: string | null) =>
        prisma.user.create({ data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "S1", role, schoolId } });
    accountantA = sessionFor("ACCOUNTANT", schoolA, (await user("ACCOUNTANT", schoolA)).id);
    superAdmin = sessionFor("SUPER_ADMIN", null, (await user("SUPER_ADMIN", null)).id);
});
beforeEach(() => actAs(accountantA));

describe("Paiement : élève et frais du même établissement", () => {
    it("paiement normal (même école) : accepté au guichet", async () => {
        const s = await newStudent();
        const f = await newFee();
        expect((await cash(s, f)).status).toBe(200);
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(1);
    });

    it("SUPER_ADMIN : paiement entre deux écoles refusé par l'API, aucun paiement", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        actAs(superAdmin);
        expect((await callRoute(createPayment, { method: "POST", path: "/api/payments", body: { studentId: s, feeId: f, amount: 10000, method: "CASH" } })).status).toBe(403);
        expect((await cash(s, f)).status).toBe(403);
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });

    it("route défaillante en contexte SUPER_ADMIN (RLS contournée) : la base refuse", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        await expect(
            runAsSystem("test:s1", () => appDb.payment.create({ data: { studentId: s, feeId: f, amount: 10000, method: "CASH", status: "VERIFIED" } })),
        ).rejects.toThrow(sameSchoolRefused);
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });

    it("création SQL directe d'un paiement entre deux écoles : refusée", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        await expect(paymentRow(s, f)).rejects.toThrow(sameSchoolRefused);
        await expect(prisma.$executeRawUnsafe(
            `INSERT INTO "payments" ("id", "studentId", "feeId", "amount", "method", "status", "updatedAt") VALUES ($1, $2, $3, 10000, 'CASH', 'VERIFIED', now())`,
            uniqueCode("pay"), s, f,
        )).rejects.toThrow(sameSchoolRefused);
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });

    it("changement d'élève ou de frais vers une autre école : refusé ; vers la même école : accepté", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolA);
        const p = await paymentRow(s, f);
        const foreignStudent = await newStudent(schoolB);
        const foreignFee = await newFee(schoolB);
        await expect(prisma.payment.update({ where: { id: p.id }, data: { studentId: foreignStudent } })).rejects.toThrow(sameSchoolRefused);
        await expect(prisma.payment.update({ where: { id: p.id }, data: { feeId: foreignFee } })).rejects.toThrow(sameSchoolRefused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "payments" SET "feeId" = $1 WHERE "id" = $2`, foreignFee, p.id)).rejects.toThrow(sameSchoolRefused);
        const sibling = await newStudent(schoolA);
        await prisma.payment.update({ where: { id: p.id }, data: { studentId: sibling } });
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).studentId).toBe(sibling);
    });
});

describe("Changement d'école d'un élève ou d'un frais ayant des paiements", () => {
    it("élève ou frais avec un paiement (sans plan) : changement refusé, Prisma et SQL direct", async () => {
        const s = await newStudent();
        const f = await newFee();
        await paymentRow(s, f);
        await expect(prisma.studentProfile.update({ where: { id: s }, data: { schoolId: schoolB } })).rejects.toThrow(moveRefused);
        await expect(prisma.fee.update({ where: { id: f }, data: { schoolId: schoolB } })).rejects.toThrow(moveRefused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "student_profiles" SET "schoolId" = $1 WHERE "id" = $2`, schoolB, s)).rejects.toThrow(moveRefused);
        await expect(prisma.$executeRawUnsafe(`UPDATE "fees" SET "schoolId" = $1 WHERE "id" = $2`, schoolB, f)).rejects.toThrow(moveRefused);
        expect(await schoolOf(s, f)).toEqual([schoolA, schoolA]);
    });

    it("tous les statuts comptent : annulé et supprimé logiquement bloquent aussi", async () => {
        const s1 = await newStudent();
        await paymentRow(s1, await newFee(), "CANCELLED");
        await expect(prisma.studentProfile.update({ where: { id: s1 }, data: { schoolId: schoolB } })).rejects.toThrow(moveRefused);
        const s2 = await newStudent();
        const p = await paymentRow(s2, await newFee());
        await prisma.payment.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
        await expect(prisma.studentProfile.update({ where: { id: s2 }, data: { schoolId: schoolB } })).rejects.toThrow(moveRefused);
    });

    it("sans paiement ni plan : changement autorisé ; autres champs et même école toujours modifiables", async () => {
        const s = await newStudent();
        const f = await newFee();
        await prisma.studentProfile.update({ where: { id: s }, data: { schoolId: schoolB } });
        await prisma.fee.update({ where: { id: f }, data: { schoolId: schoolB } });
        expect(await schoolOf(s, f)).toEqual([schoolB, schoolB]);

        const paid = await newStudent();
        const paidFee = await newFee();
        await paymentRow(paid, paidFee);
        await prisma.studentProfile.update({ where: { id: paid }, data: { address: "Porto-Novo", schoolId: schoolA } });
        await prisma.fee.update({ where: { id: paidFee }, data: { name: `Frais ${uniqueCode("R")}` } });
    });
});

describe("Paiements historiques incohérents", () => {
    it("conservés ; statut, notes et rapprochement modifiables ; école de l'élève toujours figée", async () => {
        const s = await newStudent(schoolA);
        const f = await newFee(schoolB);
        const legacy = await historicalPayment(s, f);
        await prisma.payment.update({ where: { id: legacy.id }, data: { status: "CANCELLED", cancellationSource: "MANUAL", notes: "Examen" } });
        await prisma.$executeRawUnsafe(`UPDATE "payments" SET "status" = 'VERIFIED', "paidAt" = now() WHERE "id" = $1`, legacy.id);
        const after = await prisma.payment.findUniqueOrThrow({ where: { id: legacy.id } });
        expect([after.studentId, after.feeId, after.status, after.notes]).toEqual([s, f, "VERIFIED", "Examen"]);
        await expect(prisma.studentProfile.update({ where: { id: s }, data: { schoolId: schoolB } })).rejects.toThrow(moveRefused);
        await expect(prisma.fee.update({ where: { id: f }, data: { schoolId: schoolA } })).rejects.toThrow(moveRefused);
        expect(await schoolOf(s, f)).toEqual([schoolA, schoolB]);
    });
});

describe("Courses concurrentes (PostgreSQL)", () => {
    it("paiement en cours puis changement d'école de l'élève : le changement attend et est refusé", async () => {
        const s = await newStudent();
        const f = await newFee();
        const [creation, move] = await Promise.allSettled([
            prisma.$transaction(async (tx) => {
                await tx.payment.create({ data: { studentId: s, feeId: f, amount: 10000, method: "CASH", status: "VERIFIED" } });
                await sleep(400);
            }),
            sleep(100).then(() => prisma.studentProfile.update({ where: { id: s }, data: { schoolId: schoolB } })),
        ]);
        expect(creation.status).toBe("fulfilled");
        expect(move.status).toBe("rejected");
        expect(await schoolOf(s, f)).toEqual([schoolA, schoolA]);
    });

    it("paiement en cours puis changement d'école du frais : le changement attend et est refusé", async () => {
        const s = await newStudent();
        const f = await newFee();
        const [creation, move] = await Promise.allSettled([
            prisma.$transaction(async (tx) => {
                await tx.payment.create({ data: { studentId: s, feeId: f, amount: 10000, method: "CASH", status: "VERIFIED" } });
                await sleep(400);
            }),
            sleep(100).then(() => prisma.fee.update({ where: { id: f }, data: { schoolId: schoolB } })),
        ]);
        expect(creation.status).toBe("fulfilled");
        expect(move.status).toBe("rejected");
        expect(await schoolOf(s, f)).toEqual([schoolA, schoolA]);
    });

    it("changement d'école de l'élève en cours puis paiement : le paiement attend et est refusé", async () => {
        const s = await newStudent();
        const f = await newFee();
        const [move, creation] = await Promise.allSettled([
            prisma.$transaction(async (tx) => {
                await tx.studentProfile.update({ where: { id: s }, data: { schoolId: schoolB } });
                await sleep(400);
            }),
            sleep(100).then(() => paymentRow(s, f)),
        ]);
        expect(move.status).toBe("fulfilled");
        expect(creation.status).toBe("rejected");
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });

    it("changement d'école du frais en cours puis paiement : le paiement attend et est refusé", async () => {
        const s = await newStudent();
        const f = await newFee();
        const [move, creation] = await Promise.allSettled([
            prisma.$transaction(async (tx) => {
                await tx.fee.update({ where: { id: f }, data: { schoolId: schoolB } });
                await sleep(400);
            }),
            sleep(100).then(() => paymentRow(s, f)),
        ]);
        expect(move.status).toBe("fulfilled");
        expect(creation.status).toBe("rejected");
        expect(await prisma.payment.count({ where: { studentId: s, feeId: f } })).toBe(0);
    });
});
