import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * Lot 3f (audit paiements, P-10/P-11) — les routes de paiement vérifiaient
 * séparément que l'élève et le frais étaient accessibles, jamais qu'ils
 * relevaient de la MÊME école : un compte de plusieurs écoles (ou un parent
 * d'enfants dans deux écoles) pouvait imputer un paiement sur le frais d'une
 * autre école. Certaines routes jugeaient aussi l'élève sur l'école de son
 * compte et non sur celle de sa fiche. Seul l'appel au fournisseur est simulé.
 */
const { initiatePayment } = vi.hoisted(() => ({ initiatePayment: vi.fn() }));
vi.mock("@/lib/finance/factory", () => ({
    PaymentProviderFactory: { getProvider: () => ({ initiatePayment }) },
}));
vi.mock("@/lib/finance/providers/momo", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/finance/providers/momo")>()),
    isMomoConfigured: () => true,
}));

import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { POST as createPayment } from "@/app/api/payments/route";
import { POST as financePayment } from "@/app/api/finance/payments/route";
import { POST as initiate } from "@/app/api/payments/initiate/route";
import { PATCH as patchPayment } from "@/app/api/payments/[id]/route";

let A: string;
let B: string;
let studentA: string;
let studentB: string;
let movedStudent: string; // fiche à A, compte encore rattaché à B
let feeA: string;
let feeB: string;
let parentUser: string;
let accountantUser: string;
let rootUser: string;
let accountantB: string;

const as = (role: UserRole, active: string | null, accessible: string[], userId?: string): Session => {
    const base = sessionFor(role, active, userId);
    return { ...base, user: { ...base.user, accessibleSchoolIds: accessible } };
};
const body = (studentId: string, feeId: string, amount = 1000) => ({ studentId, feeId, amount, method: "CASH" });
const paymentsOf = (studentId: string, feeId: string) => prisma.payment.count({ where: { studentId, feeId } });

async function student(schoolOfProfile: string, schoolOfAccount: string) {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: "Scope", role: "STUDENT", schoolId: schoolOfAccount },
    });
    return (await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("MAT"), schoolId: schoolOfProfile } })).id;
}

beforeAll(async () => {
    [A, B] = [(await createSchool("SCOPE-A")).id, (await createSchool("SCOPE-B")).id];
    studentA = await student(A, A);
    studentB = await student(B, B);
    movedStudent = await student(A, B);
    feeA = (await prisma.fee.create({ data: { schoolId: A, name: "Scolarité A", amount: 50000 } })).id;
    feeB = (await prisma.fee.create({ data: { schoolId: B, name: "Scolarité B", amount: 50000 } })).id;
    const parent = await prisma.user.create({
        data: { email: `${uniqueCode("parent")}@integration.test`, password: "x", firstName: "Parent", lastName: "DeuxEcoles", role: "PARENT", schoolId: A },
    });
    const profile = await prisma.parentProfile.create({ data: { userId: parent.id } });
    await prisma.parentStudent.createMany({
        data: [
            { parentId: profile.id, studentId: studentA, relationship: "PARENT" },
            { parentId: profile.id, studentId: studentB, relationship: "PARENT" },
        ],
    });
    parentUser = parent.id;
    // Comptes réels : le paiement enregistre son auteur (clé étrangère)
    const mk = (role: UserRole, schoolId: string | null) =>
        prisma.user.create({ data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "Scope", role, schoolId } });
    accountantUser = (await mk("ACCOUNTANT", A)).id;
    rootUser = (await mk("SUPER_ADMIN", null)).id;
    accountantB = (await mk("ACCOUNTANT", B)).id;
});

beforeEach(() => {
    initiatePayment.mockReset();
    initiatePayment.mockImplementation(async () => ({ paymentUrl: "", transactionId: uniqueCode("momo-ref") }));
});

describe("Élève et frais de la même école", () => {
    it("guichet : élève et frais de A, comptable de A → enregistré", async () => {
        actAs(as("ACCOUNTANT", A, [A], accountantUser));
        const res = await callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: body(studentA, feeA) });
        expect(res.status).toBe(200);
        expect(await paymentsOf(studentA, feeA)).toBeGreaterThanOrEqual(1);
    });

    it("comptable de A et B : élève de A avec frais de B refusé sur les trois routes, aucun paiement créé", async () => {
        actAs(as("ACCOUNTANT", A, [A, B], accountantUser));
        for (const [handler, path] of [
            [cashPayment, "/api/payments/cash"],
            [createPayment, "/api/payments"],
        ] as const) {
            const res = await callRoute(handler, { method: "POST", path, body: body(studentA, feeB) });
            expect(res.status, path).toBe(403);
            expect(res.body, path).toEqual({ error: "Les frais n'appartiennent pas à l'établissement de l'élève." });
        }
        // Plateforme sans école active : seule la correspondance élève/frais protège
        actAs(as("SUPER_ADMIN", null, [], rootUser));
        const res = await callRoute(financePayment, { method: "POST", path: "/api/finance/payments", body: body(studentA, feeB) });
        expect(res.status).toBe(403);
        expect(await paymentsOf(studentA, feeB)).toBe(0);
    });

    it("comptable de A et B : élève et frais de B → accepté, l'école réellement concernée est B", async () => {
        actAs(as("ACCOUNTANT", A, [A, B], accountantUser));
        const res = await callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: body(studentB, feeB) });
        expect(res.status).toBe(200);
        expect(await paymentsOf(studentB, feeB)).toBeGreaterThanOrEqual(1);
    });

    it("comptable de A seulement : élève et frais de B refusés", async () => {
        actAs(as("ACCOUNTANT", A, [A], accountantUser));
        const res = await callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", body: body(studentB, feeB, 777) });
        // Élève de B invisible pour un compte de A (RLS) : refus sans divulgation
        expect([403, 404]).toContain(res.status);
        expect(await prisma.payment.count({ where: { studentId: studentB, feeId: feeB, amount: 777 } })).toBe(0);
    });
});

describe("Parent d'enfants dans deux écoles : paiement en ligne", () => {
    it("frais de B pour l'enfant de A : refusé, aucun essai créé ; frais de A pour l'enfant de A : accepté", async () => {
        actAs(as("PARENT", A, [A, B], parentUser));
        const crossed = await callRoute(initiate, {
            method: "POST", path: "/api/payments/initiate",
            body: { amount: 10000, feeId: feeB, studentId: studentA, provider: "MOMO", payerPhone: "0190000000" },
        });
        expect(crossed.status).toBe(403);
        expect(await paymentsOf(studentA, feeB)).toBe(0);
        expect(initiatePayment).not.toHaveBeenCalled();

        const legit = await callRoute(initiate, {
            method: "POST", path: "/api/payments/initiate",
            body: { amount: 10000, feeId: feeA, studentId: studentA, provider: "MOMO", payerPhone: "0190000000" },
        });
        expect(legit.status).toBe(200);
    });
});

describe("École de la fiche élève, pas de son compte", () => {
    it("élève dont la fiche est à A (compte encore à B) : le comptable de A l'encaisse sur un frais de A", async () => {
        actAs(as("ACCOUNTANT", A, [A], accountantUser));
        const res = await callRoute(financePayment, { method: "POST", path: "/api/finance/payments", body: body(movedStudent, feeA) });
        expect(res.status).toBe(201);
        expect(await paymentsOf(movedStudent, feeA)).toBe(1);
    });

    it("modification d'un paiement : jugée sur l'école de la fiche (A), pas du compte (B)", async () => {
        const payment = await prisma.payment.create({
            data: { studentId: movedStudent, feeId: feeA, amount: 2000, method: "CASH", status: "VERIFIED", paidAt: new Date(), reference: uniqueCode("MAN") },
        });
        actAs(as("ACCOUNTANT", A, [A], accountantUser));
        const ok = await callRoute(patchPayment, { method: "PATCH", path: `/api/payments/${payment.id}`, params: { id: payment.id }, body: { notes: "Corrigé par l'école de la fiche" } });
        expect(ok.status).toBe(200);

        actAs(as("ACCOUNTANT", B, [B], accountantB));
        const refused = await callRoute(patchPayment, { method: "PATCH", path: `/api/payments/${payment.id}`, params: { id: payment.id }, body: { notes: "Tentative de l'école du compte" } });
        expect([403, 404]).toContain(refused.status);
        expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).notes).toBe("Corrigé par l'école de la fiche");
    });
});
