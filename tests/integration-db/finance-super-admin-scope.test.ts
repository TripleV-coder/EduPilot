import { beforeAll, describe, expect, it, vi } from "vitest";

// Console root : l'e-mail de la session doit figurer dans ROOT_USER_EMAILS, lu au
// chargement de lib/security/root-access — défini avant l'import des routes.
vi.hoisted(() => {
    process.env.ROOT_USER_EMAILS = "super_admin@integration.test";
});

import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { authConfig } from "@/lib/auth/config";
import { FINANCE_SCOPE_AUDIT_ACTION } from "@/lib/finance/finance-scope";
import { GET as listFinancePayments, POST as createFinancePayment } from "@/app/api/finance/payments/route";
import { GET as listPayments } from "@/app/api/payments/route";
import { GET as listPlans } from "@/app/api/payment-plans/route";
import { GET as reconcileList, POST as reconcile } from "@/app/api/payments/reconcile/route";
import { GET as financeExport } from "@/app/api/finance/export/route";
import { GET as accountingExport } from "@/app/api/accounting/export/route";
import { GET as financeDashboard } from "@/app/api/finance/dashboard/route";
import { GET as financeStats } from "@/app/api/finance/stats/route";
import { GET as biBoard } from "@/app/api/analytics/bi/route";
import { GET as listFees, POST as createFee } from "@/app/api/fees/route";
import { PATCH as patchPayment } from "@/app/api/payments/[id]/route";
import { GET as rootFinanceSummary } from "@/app/api/root/finance/summary/route";

/**
 * S6 (2026-10-18) — vues financières du super-administrateur.
 *
 * Le super-admin n'a pas d'école propre. Sans sélection, plusieurs routes lui
 * renvoyaient les paiements, échéanciers et écritures de TOUS les
 * établissements mélangés (et le tableau BI, des indicateurs à zéro présentés
 * comme réels) ; un identifiant d'école arbitraire était accepté sans
 * vérification ; une école sélectionnée pouvait être contournée dans une
 * requête. Deux écoles (ALPHA, BRAVO), chacune avec un élève, un frais et un
 * paiement validé ; les routes sont appelées pour de vrai sur PostgreSQL, et
 * les jetons passent par les vrais callbacks Auth.js.
 */
let A: string;
let B: string;
let rootUserId: string;
let accountantA: string;
const pay = {} as Record<"A" | "B", { student: string; fee: string; payment: string }>;

const ROOT_EMAIL = "super_admin@integration.test";
const as = (role: UserRole, active: string | null, userId: string, accessible: string[] = active ? [active] : []): Session => {
    const base = sessionFor(role, active, userId);
    return { ...base, user: { ...base.user, email: role === "SUPER_ADMIN" ? ROOT_EMAIL : base.user.email, accessibleSchoolIds: accessible } };
};
const root = (active: string | null) => as("SUPER_ADMIN", active, rootUserId);
const text = (body: unknown) => (typeof body === "string" ? body : JSON.stringify(body));
const jwt = (args: Record<string, unknown>) => authConfig.callbacks!.jwt!(args as never) as Promise<JWT>;
const rootToken = (userId: string, schoolId: string | null) =>
    ({ id: userId, role: "SUPER_ADMIN", schoolId, iat: Math.floor(Date.now() / 1000) - 60 }) as JWT;

async function schoolWithPayment(label: "ALPHA" | "BRAVO") {
    const school = await createSchool(`S6-${label}`);
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("s6-eleve")}@integration.test`, password: "x", firstName: "Eleve", lastName: `${label}S6`, role: "STUDENT", schoolId: school.id },
    });
    const student = await prisma.studentProfile.create({ data: { userId: user.id, matricule: uniqueCode("S6"), schoolId: school.id } });
    const fee = await prisma.fee.create({ data: { schoolId: school.id, name: `Frais-${label}-S6`, amount: 50000 } });
    const payment = await prisma.payment.create({
        data: { studentId: student.id, feeId: fee.id, amount: 10000, method: "CASH", status: "VERIFIED", reference: uniqueCode(`REF-${label}`), paidAt: new Date() },
    });
    return { schoolId: school.id, student: student.id, fee: fee.id, payment: payment.id };
}

beforeAll(async () => {
    const a = await schoolWithPayment("ALPHA");
    const b = await schoolWithPayment("BRAVO");
    A = a.schoolId;
    B = b.schoolId;
    pay.A = a;
    pay.B = b;
    rootUserId = (await prisma.user.create({
        data: { email: `${uniqueCode("s6-root")}@integration.test`, password: "x", firstName: "Root", lastName: "S6", role: "SUPER_ADMIN" },
    })).id;
    accountantA = (await prisma.user.create({
        data: { email: `${uniqueCode("s6-compta")}@integration.test`, password: "x", firstName: "Compta", lastName: "S6", role: "ACCOUNTANT", schoolId: A },
    })).id;
});

describe("1. Super-admin avec une école sélectionnée", () => {
    it("lit les paiements, échéanciers et indicateurs de cette école seulement", async () => {
        actAs(root(A));
        for (const [handler, path] of [
            [listFinancePayments, "/api/finance/payments"],
            [listPayments, "/api/payments"],
            [reconcileList, "/api/payments/reconcile"],
        ] as const) {
            const res = await callRoute(handler, { path });
            expect(res.status, path).toBe(200);
            expect(text(res.body), path).toContain(pay.A.payment);
            expect(text(res.body), path).not.toContain(pay.B.payment);
        }
        expect((await callRoute(listPlans, { path: "/api/payment-plans" })).status).toBe(200);
        expect((await callRoute(financeDashboard, { path: "/api/finance/dashboard" })).status).toBe(200);
        expect((await callRoute(financeStats, { path: "/api/finance/stats" })).status).toBe(200);
    });
});

describe("2. Super-admin sans école sélectionnée", () => {
    it("aucune agrégation silencieuse : 400 SCHOOL_REQUIRED partout, aucun paiement renvoyé", async () => {
        actAs(root(null));
        for (const [handler, path] of [
            [listFinancePayments, "/api/finance/payments"],
            [listPayments, "/api/payments"],
            [listPlans, "/api/payment-plans"],
            [reconcileList, "/api/payments/reconcile"],
            [financeExport, "/api/finance/export"],
            [accountingExport, "/api/accounting/export"],
            [financeDashboard, "/api/finance/dashboard"],
            [financeStats, "/api/finance/stats"],
            [biBoard, "/api/analytics/bi"],
            [listFees, "/api/fees"],
        ] as const) {
            const res = await callRoute(handler, { path });
            expect(res.status, path).toBe(400);
            expect(res.body, path).toMatchObject({ code: "SCHOOL_REQUIRED" });
            expect(text(res.body), path).not.toContain(pay.A.payment);
        }
    });

    it("une école explicitement désignée et existante est acceptée (sélection explicite)", async () => {
        actAs(root(null));
        const res = await callRoute(listFinancePayments, { path: `/api/finance/payments?schoolId=${B}` });
        expect(res.status).toBe(200);
        expect(text(res.body)).toContain(pay.B.payment);
        expect(text(res.body)).not.toContain(pay.A.payment);
    });
});

describe("3. École inexistante", () => {
    it("identifiant inconnu ou malformé : 404, aucune donnée", async () => {
        actAs(root(null));
        for (const id of ["cl0000000000000000000000", "x'; DROP TABLE payments; --", "a".repeat(200)]) {
            const res = await callRoute(listFinancePayments, { path: `/api/finance/payments?schoolId=${encodeURIComponent(id)}` });
            expect(res.status, id).toBe(404);
            expect(res.body).toMatchObject({ code: "SCHOOL_NOT_FOUND" });
        }
    });

    it("changement d'école vers un identifiant inexistant : le jeton revient à la vue globale", async () => {
        const after = await jwt({ token: rootToken(rootUserId, A), trigger: "update", session: { schoolId: "cl0000000000000000000000" } });
        expect(after.schoolId).toBeNull();
    });
});

describe("4-5. École réelle hors contexte et substitution dans la requête", () => {
    it("école A sélectionnée, ?schoolId=B : 403 SCHOOL_MISMATCH en lecture et en export", async () => {
        actAs(root(A));
        for (const [handler, path] of [
            [listFinancePayments, `/api/finance/payments?schoolId=${B}`],
            [financeExport, `/api/finance/export?schoolId=${B}`],
            [accountingExport, `/api/accounting/export?schoolId=${B}`],
            [financeDashboard, `/api/finance/dashboard?schoolId=${B}`],
        ] as const) {
            const res = await callRoute(handler, { path });
            expect(res.status, path).toBe(403);
            expect(res.body, path).toMatchObject({ code: "SCHOOL_MISMATCH" });
            expect(text(res.body), path).not.toContain(pay.B.payment);
        }
    });

    it("école A sélectionnée : frais « pour B » via le corps, paiement, rapprochement et modification de B — refusés, rien écrit", async () => {
        actAs(root(A));
        const feesBefore = await prisma.fee.count({ where: { schoolId: B } });
        const paymentsBefore = await prisma.payment.count({ where: { studentId: pay.B.student } });

        const fee = await callRoute(createFee, { method: "POST", path: "/api/fees", body: { name: "Substitution S6", amount: 1000, schoolId: B } });
        expect(fee.status).toBe(403);
        const payment = await callRoute(createFinancePayment, {
            method: "POST", path: "/api/finance/payments",
            body: { studentId: pay.B.student, feeId: pay.B.fee, amount: 1000, method: "CASH" },
        });
        expect(payment.status).toBe(403);
        const reconciled = await callRoute(reconcile, { method: "POST", path: "/api/payments/reconcile", body: { paymentIds: [pay.B.payment] } });
        expect(reconciled.status).toBe(403);
        const patched = await callRoute(patchPayment, {
            method: "PATCH", path: `/api/payments/${pay.B.payment}`, params: { id: pay.B.payment }, body: { notes: "substitution" },
        });
        expect(patched.status).toBe(403);

        // 11. Aucune écriture sur refus
        expect(await prisma.fee.count({ where: { schoolId: B } })).toBe(feesBefore);
        expect(await prisma.payment.count({ where: { studentId: pay.B.student } })).toBe(paymentsBefore);
        const b = await prisma.payment.findUniqueOrThrow({ where: { id: pay.B.payment } });
        expect(b.status).toBe("VERIFIED");
        expect(b.reconciledAt).toBeNull();
        expect(b.notes ?? "").not.toContain("substitution");
    });

    it("rapprochement en masse sans école sélectionnée : refusé, aucun paiement rapproché", async () => {
        actAs(root(null));
        const res = await callRoute(reconcile, { method: "POST", path: "/api/payments/reconcile", body: { reconcileAllVerified: true } });
        expect(res.status).toBe(400);
        expect(await prisma.payment.count({ where: { id: { in: [pay.A.payment, pay.B.payment] }, reconciledAt: { not: null } } })).toBe(0);
    });
});

describe("6. Lecture, écriture et export dans l'école sélectionnée", () => {
    it("export CSV : les paiements de l'école sélectionnée uniquement", async () => {
        actAs(root(B));
        const res = await callRoute(financeExport, { path: "/api/finance/export?format=csv" });
        expect(res.status).toBe(200);
        expect(text(res.body)).toContain("Frais-BRAVO-S6");
        expect(text(res.body)).not.toContain("Frais-ALPHA-S6");
    });

    it("écriture : frais créé dans l'école sélectionnée, et nulle part ailleurs", async () => {
        actAs(root(B));
        const name = uniqueCode("Frais-S6-ecrit");
        const res = await callRoute(createFee, { method: "POST", path: "/api/fees", body: { name, amount: 2000 } });
        expect(res.status).toBe(201);
        const created = await prisma.fee.findMany({ where: { name } });
        expect(created.map((f) => f.schoolId)).toEqual([B]);
    });
});

describe("7. Agrégation explicitement globale", () => {
    it("console racine : vue plateforme identifiée comme telle, sans nom d'élève, tracée", async () => {
        actAs(root(null));
        const res = await callRoute(rootFinanceSummary, { path: "/api/root/finance/summary" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ scope: "PLATFORM" });
        expect(text(res.body)).not.toContain("ALPHAS6");
        expect(text(res.body)).not.toContain("BRAVOS6");
        expect(await prisma.auditLog.count({ where: { userId: rootUserId, action: "FINANCE_GLOBAL_VIEW" } })).toBeGreaterThanOrEqual(1);
    });

    it("refusée à tout autre rôle (comptable) : pas de contournement par la vue globale", async () => {
        actAs(as("ACCOUNTANT", A, accountantA));
        const res = await callRoute(rootFinanceSummary, { path: "/api/root/finance/summary" });
        expect(res.status).toBe(403);
    });
});

describe("8-9. Révocation et changement d'école en cours de session", () => {
    it("changement d'école A → B par le vrai callback : les listes suivantes ne montrent que B", async () => {
        actAs(root(A));
        const before = await callRoute(listPayments, { path: "/api/payments" });
        expect(text(before.body)).toContain(pay.A.payment);

        const switched = await jwt({ token: rootToken(rootUserId, A), trigger: "update", session: { schoolId: B } });
        expect(switched.schoolId).toBe(B);
        actAs(root(switched.schoolId as string));
        // Même URL, même utilisateur : la réponse en cache de A ne doit pas resservir
        const after = await callRoute(listPayments, { path: "/api/payments" });
        expect(after.status).toBe(200);
        expect(text(after.body)).toContain(pay.B.payment);
        expect(text(after.body)).not.toContain(pay.A.payment);
    });

    it("super-admin rétrogradé pendant la session : le jeton suivant perd le rôle, l'école B lui est fermée", async () => {
        const user = await prisma.user.create({
            data: { email: `${uniqueCode("s6-demote")}@integration.test`, password: "x", firstName: "Root", lastName: "Demote", role: "SUPER_ADMIN" },
        });
        await prisma.user.update({ where: { id: user.id }, data: { role: "ACCOUNTANT", schoolId: A } });
        const after = await jwt({ token: rootToken(user.id, B) });
        expect(after.role).toBe("ACCOUNTANT");
        expect(after.schoolId).toBe(A);

        actAs(as("ACCOUNTANT", after.schoolId as string, user.id, (after.accessibleSchoolIds as string[] | undefined) ?? [A]));
        const res = await callRoute(listFinancePayments, { path: `/api/finance/payments?schoolId=${B}` });
        expect(res.status).toBe(403);
        expect(text(res.body)).not.toContain(pay.B.payment);
    });
});

describe("10. Utilisateur sans droit sur l'autre école", () => {
    it("comptable de A : lecture, export et écriture sur B refusés ; son école A intacte", async () => {
        actAs(as("ACCOUNTANT", A, accountantA));
        for (const [handler, path] of [
            [listFinancePayments, `/api/finance/payments?schoolId=${B}`],
            [financeExport, `/api/finance/export?schoolId=${B}`],
            [accountingExport, `/api/accounting/export?schoolId=${B}`],
        ] as const) {
            const res = await callRoute(handler, { path });
            expect(res.status, path).toBe(403);
            expect(text(res.body), path).not.toContain(pay.B.payment);
        }
        const fees = await prisma.fee.count({ where: { schoolId: B } });
        expect((await callRoute(createFee, { method: "POST", path: "/api/fees", body: { name: "Compta S6", amount: 1000, schoolId: B } })).status).toBe(403);
        expect(await prisma.fee.count({ where: { schoolId: B } })).toBe(fees);

        // Périmètre légitime inchangé (règle I)
        const own = await callRoute(listFinancePayments, { path: "/api/finance/payments" });
        expect(own.status).toBe(200);
        expect(text(own.body)).toContain(pay.A.payment);
    });
});

describe("12. Traçabilité", () => {
    it("accès accordés et refusés du super-admin journalisés : école, opération, résultat — sans montant ni secret", async () => {
        const rows = await prisma.auditLog.findMany({ where: { userId: rootUserId, action: FINANCE_SCOPE_AUDIT_ACTION } });
        const values = rows.map((r) => r.newValues as Record<string, unknown>);
        expect(rows.some((r, i) => r.schoolId === A && values[i].outcome === "GRANTED")).toBe(true);
        expect(values.some((v) => v.outcome === "DENIED" && v.reason === "SCHOOL_MISMATCH")).toBe(true);
        expect(values.some((v) => v.outcome === "DENIED" && v.reason === "SCHOOL_NOT_FOUND")).toBe(true);
        expect(values.some((v) => v.operation === "finance:export" && v.outcome === "GRANTED")).toBe(true);
        for (const v of values) {
            expect(Object.keys(v)).toEqual(expect.arrayContaining(["operation", "outcome"]));
            expect(text(v)).not.toMatch(/amount|montant|password|token|10000|50000/i);
        }
        // Les refus ne rattachent aucune école (une école inexistante n'a pas de ligne)
        rows.filter((_, i) => values[i].outcome === "DENIED").forEach((r) => expect(r.schoolId).toBeNull());
    });

    it("un comptable dans son périmètre ne génère pas d'entrée (pas de bruit pour l'usage normal)", async () => {
        expect(await prisma.auditLog.count({ where: { userId: accountantA, action: FINANCE_SCOPE_AUDIT_ACTION } })).toBe(0);
    });
});
