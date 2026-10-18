import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, sessionFor, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { POST as cashPayment } from "@/app/api/payments/cash/route";

/**
 * Encaissement au guichet (2026-10-18) — toute requête invalide répondait
 * 500 : l'interception générique de la route avalait l'erreur de validation
 * (et l'erreur de lecture du JSON) au lieu de la laisser convertir en 400 par
 * createApiHandler. Les contrôles d'école, de rôle et de plafond (lots 3b,
 * 3f, S1) restent en place ; aucune écriture après un rejet.
 */
let A: TenantGraph;
let B: TenantGraph;
let accountantA: string;
let feeA: string;
let feeB: string;

const paymentsOf = (studentId: string) => prisma.payment.count({ where: { studentId } });
const post = (body: unknown, raw?: string) =>
    callRoute(cashPayment, { method: "POST", path: "/api/payments/cash", ...(raw !== undefined ? { rawBody: raw, headers: { "content-type": "application/json" } } : { body }) });

beforeAll(async () => {
    [A, B] = [await seedTenantGraph("CASH-A"), await seedTenantGraph("CASH-B")];
    accountantA = (await prisma.user.create({
        data: { email: `${uniqueCode("cash-compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "Guichet", role: "ACCOUNTANT", schoolId: A.schoolId },
    })).id;
    feeA = (await prisma.fee.findFirstOrThrow({ where: { schoolId: A.schoolId }, select: { id: true } })).id;
    feeB = (await prisma.fee.findFirstOrThrow({ where: { schoolId: B.schoolId }, select: { id: true } })).id;
});

describe("Requêtes invalides : 400, jamais 500, aucune écriture", () => {
    it("corps absent, JSON illisible, champs obligatoires absents, types incorrects", async () => {
        actAs(sessionFor("ACCOUNTANT", A.schoolId, accountantA));
        const before = await paymentsOf(A.ids.student);
        const cases: Array<[string, unknown, string?]> = [
            ["corps absent", undefined, ""],
            ["JSON illisible", undefined, "{ montant: "],
            ["objet vide", {}],
            ["élève absent", { feeId: feeA, amount: 1000, method: "CASH" }],
            ["frais absent", { studentId: A.ids.student, amount: 1000, method: "CASH" }],
            ["mode absent", { studentId: A.ids.student, feeId: feeA, amount: 1000 }],
            ["identifiant non valide", { studentId: "pas-un-id", feeId: feeA, amount: 1000, method: "CASH" }],
            ["montant texte", { studentId: A.ids.student, feeId: feeA, amount: "mille", method: "CASH" }],
            ["mode inconnu", { studentId: A.ids.student, feeId: feeA, amount: 1000, method: "BITCOIN" }],
            ["tableau au lieu d'objet", [1, 2, 3]],
        ];
        for (const [label, body, raw] of cases) {
            const res = await post(body, raw);
            expect(res.status, label).toBe(400);
        }
        expect(await paymentsOf(A.ids.student)).toBe(before);
    });

    it("montants nul, négatif, décimal : 400 détaillé sur le champ amount, aucune écriture", async () => {
        actAs(sessionFor("ACCOUNTANT", A.schoolId, accountantA));
        const before = await paymentsOf(A.ids.student);
        for (const amount of [0, -500, 12.5]) {
            const res = await post({ studentId: A.ids.student, feeId: feeA, amount, method: "CASH" });
            expect(res.status, String(amount)).toBe(400);
            expect(res.body).toMatchObject({ code: "VALIDATION_ERROR" });
            expect((res.body as { details: Array<{ path: string }> }).details.map((d) => d.path)).toContain("amount");
        }
        expect(await paymentsOf(A.ids.student)).toBe(before);
    });

    it("Mobile Money reçu sans référence : 400 métier (règle conservée)", async () => {
        actAs(sessionFor("ACCOUNTANT", A.schoolId, accountantA));
        const res = await post({ studentId: A.ids.student, feeId: feeA, amount: 1000, method: "MOBILE_MONEY_MTN" });
        expect(res.status).toBe(400);
    });
});

describe("Contrôles d'accès conservés", () => {
    it("rôle sans droit d'encaissement (enseignant) : 403, aucune écriture", async () => {
        actAs(sessionFor("TEACHER", A.schoolId, A.teacherUserId));
        const before = await paymentsOf(A.ids.student);
        expect((await post({ studentId: A.ids.student, feeId: feeA, amount: 1000, method: "CASH" })).status).toBe(403);
        expect(await paymentsOf(A.ids.student)).toBe(before);
    });

    it("élève et frais d'une autre école : refusé, aucune écriture", async () => {
        actAs(sessionFor("ACCOUNTANT", A.schoolId, accountantA));
        const before = await paymentsOf(B.ids.student);
        const res = await post({ studentId: B.ids.student, feeId: feeB, amount: 1000, method: "CASH" });
        expect([403, 404]).toContain(res.status);
        expect(await paymentsOf(B.ids.student)).toBe(before);
    });

    it("frais d'une autre école pour un élève de A : 403, aucune écriture", async () => {
        actAs(sessionFor("ACCOUNTANT", A.schoolId, accountantA));
        const before = await paymentsOf(A.ids.student);
        const res = await post({ studentId: A.ids.student, feeId: feeB, amount: 1000, method: "CASH" });
        expect([403, 404]).toContain(res.status);
        expect(await paymentsOf(A.ids.student)).toBe(before);
    });

    it("montant au-delà du reste dû : refusé par le plafond, aucune écriture", async () => {
        actAs(sessionFor("ACCOUNTANT", A.schoolId, accountantA));
        const before = await paymentsOf(A.ids.student);
        const res = await post({ studentId: A.ids.student, feeId: feeA, amount: 10_000_000, method: "CASH" });
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(await paymentsOf(A.ids.student)).toBe(before);
    });
});

describe("Encaissement valide", () => {
    it("comptable de A, élève et frais de A : paiement enregistré une fois, au bon montant", async () => {
        actAs(sessionFor("ACCOUNTANT", A.schoolId, accountantA));
        const before = await paymentsOf(A.ids.student);
        const res = await post({ studentId: A.ids.student, feeId: feeA, amount: 1500, method: "CASH" });
        expect(res.status).toBe(200);
        expect(await paymentsOf(A.ids.student)).toBe(before + 1);
        const created = await prisma.payment.findFirstOrThrow({ where: { studentId: A.ids.student, amount: 1500 }, orderBy: { createdAt: "desc" } });
        expect(created.feeId).toBe(feeA);
        expect(created.method).toBe("CASH");
    });
});
