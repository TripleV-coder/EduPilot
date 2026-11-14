import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import appDb from "@/lib/prisma";
import { actAs, callRoute, sessionFor, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { authConfig } from "@/lib/auth/config";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";
import { runWithDbContext } from "@/lib/db/db-context";
import { dbContextForSession } from "@/lib/db/session-db-context";
import { GET as listStudents } from "@/app/api/students/route";
import { GET as getStudent } from "@/app/api/students/[id]/route";
import { GET as listGrades } from "@/app/api/grades/route";
import { GET as getGrade } from "@/app/api/grades/[id]/route";
import { GET as listFinancePayments } from "@/app/api/finance/payments/route";
import { GET as financeExport } from "@/app/api/finance/export/route";
import { POST as createFee } from "@/app/api/fees/route";
import { POST as cashPayment } from "@/app/api/payments/cash/route";
import { PATCH as patchPayment } from "@/app/api/payments/[id]/route";

/**
 * Contrôle de S5 (2026-10-18) sur les DONNÉES réellement servies, et non sur
 * le seul tableau des écoles accessibles. Réseau A = écoles A1, A2 ; réseau
 * B = école B1. Chaque école a un élève, une note, un frais et un paiement
 * (fixture tenant-graph). Les sessions sont construites à partir du périmètre
 * recalculé en base, ou produites par les vrais callbacks Auth.js.
 *
 * Complète organization-school-scope.test.ts (périmètre calculé, élèves,
 * tableau de bord financier, vue consolidée).
 */
let A1: TenantGraph;
let A2: TenantGraph;
let B1: TenantGraph;
let orgA: string;
let orgB: string;
const users: Record<string, { id: string; role: UserRole; schoolId: string | null }> = {};

async function user(key: string, role: UserRole, schoolId: string | null) {
    const u = await prisma.user.create({
        data: { email: `${uniqueCode(key)}@integration.test`, password: "x", firstName: key, lastName: "S5", role, schoolId },
    });
    users[key] = { id: u.id, role, schoolId };
}
const join = (organizationId: string, key: string, rights: { isOwner?: boolean; canManageSites?: boolean } = {}) =>
    prisma.organizationMembership.create({ data: { organizationId, userId: users[key].id, isOwner: rights.isOwner ?? false, canManageSites: rights.canManageSites ?? false } });
const scopeOf = (key: string) =>
    getAccessibleSchoolIdsForUser({ userId: users[key].id, role: users[key].role, primarySchoolId: users[key].schoolId });
async function sessionOf(key: string, active = users[key].schoolId): Promise<Session> {
    const base = sessionFor(users[key].role, active, users[key].id);
    return { ...base, user: { ...base.user, accessibleSchoolIds: await scopeOf(key) } } as Session;
}
const text = (body: unknown) => JSON.stringify(body);
const jwt = (args: Record<string, unknown>) => authConfig.callbacks!.jwt!(args as never) as Promise<JWT>;
const toSession = async (token: JWT): Promise<Session> =>
    (await authConfig.callbacks!.session!({
        session: { user: {}, expires: new Date(Date.now() + 3_600_000).toISOString() },
        token,
    } as never)) as Session;
const loginToken = (key: string, accessible: string[]) =>
    ({
        id: users[key].id, role: users[key].role, schoolId: users[key].schoolId, primarySchoolId: users[key].schoolId,
        accessibleSchoolIds: accessible, iat: Math.floor(Date.now() / 1000) - 60,
    }) as JWT;

/** Tentatives d'accès d'une session à l'école `target` : aucune donnée, aucune écriture. */
async function expectNoAccess(session: Session, target: TenantGraph) {
    actAs(session);
    const students = await callRoute(listStudents, { path: `/api/students?schoolId=${target.schoolId}` });
    expect(students.status).toBe(403);

    const grades = await callRoute(listGrades, { path: `/api/grades?studentId=${target.ids.student}` });
    expect(text(grades.body)).not.toContain(target.ids.grade);
    const grade = await callRoute(getGrade, { path: `/api/grades/${target.ids.grade}`, params: { id: target.ids.grade } });
    expect([403, 404]).toContain(grade.status);

    for (const [handler, path] of [
        [listFinancePayments, `/api/finance/payments?schoolId=${target.schoolId}`],
        [financeExport, `/api/finance/export?schoolId=${target.schoolId}`],
    ] as const) {
        const res = await callRoute(handler, { path });
        expect(res.status, path).toBe(403);
        expect(text(res.body), path).not.toContain(target.ids.payment);
    }

    const feeIds = (await prisma.fee.findMany({ where: { schoolId: target.schoolId }, select: { id: true } })).map((f) => f.id);
    const before = {
        fees: feeIds.length,
        payments: await prisma.payment.count({ where: { studentId: target.ids.student } }),
        payment: await prisma.payment.findUniqueOrThrow({ where: { id: target.ids.payment } }),
    };
    const fee = await callRoute(createFee, { method: "POST", path: "/api/fees", body: { name: uniqueCode("Intrus"), amount: 1000, schoolId: target.schoolId } });
    expect(fee.status).toBe(403);
    const cash = await callRoute(cashPayment, {
        method: "POST", path: "/api/payments/cash",
        body: { studentId: target.ids.student, feeId: feeIds[0], amount: 1000, method: "CASH" },
    });
    expect([400, 403, 404]).toContain(cash.status);
    const patched = await callRoute(patchPayment, {
        method: "PATCH", path: `/api/payments/${target.ids.payment}`, params: { id: target.ids.payment }, body: { notes: "intrusion" },
    });
    expect([403, 404]).toContain(patched.status);

    expect(await prisma.fee.count({ where: { schoolId: target.schoolId } })).toBe(before.fees);
    expect(await prisma.payment.count({ where: { studentId: target.ids.student } })).toBe(before.payments);
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: target.ids.payment } })).toEqual(before.payment);
}

async function expectOwnAccess(session: Session, own: TenantGraph) {
    actAs(session);
    const students = await callRoute(listStudents, { path: `/api/students?schoolId=${own.schoolId}` });
    expect(students.status).toBe(200);
    expect(text(students.body)).toContain(own.ids.student);
    const grades = await callRoute(listGrades, { path: `/api/grades?studentId=${own.ids.student}` });
    expect(grades.status).toBe(200);
    expect(text(grades.body)).toContain(own.ids.grade);
    const payments = await callRoute(listFinancePayments, { path: `/api/finance/payments?schoolId=${own.schoolId}` });
    expect(payments.status).toBe(200);
    expect(text(payments.body)).toContain(own.ids.payment);
}

beforeAll(async () => {
    [A1, A2, B1] = [await seedTenantGraph("S5D-A1"), await seedTenantGraph("S5D-A2"), await seedTenantGraph("S5D-B1")];
    orgA = (await prisma.organization.create({ data: { name: "Réseau A", code: uniqueCode("ORG") } })).id;
    orgB = (await prisma.organization.create({ data: { name: "Réseau B", code: uniqueCode("ORG") } })).id;
    await prisma.school.updateMany({ where: { id: { in: [A1.schoolId, A2.schoolId] } }, data: { organizationId: orgA } });
    await prisma.school.update({ where: { id: B1.schoolId }, data: { organizationId: orgB } });

    // Adhésions « historiques » trop privilégiées : propriétaire + gestion
    await user("schoolAdmin", "SCHOOL_ADMIN", A1.schoolId);
    await user("director", "DIRECTOR", A1.schoolId);
    await user("network", "NETWORK_ADMIN", A1.schoolId);
    await user("multiOrgAdmin", "SCHOOL_ADMIN", A1.schoolId);
    await join(orgA, "schoolAdmin", { isOwner: true, canManageSites: true });
    await join(orgA, "director", { canManageSites: true });
    await join(orgA, "network");
    // Adhésion à un second réseau, créée hors de l'API (donnée héritée)
    await join(orgA, "multiOrgAdmin", { isOwner: true, canManageSites: true });
    await join(orgB, "multiOrgAdmin", { isOwner: true, canManageSites: true });
});

describe("SCHOOL_ADMIN propriétaire et gestionnaire de son réseau", () => {
    it("sa propre école : élèves, notes et paiements lisibles", async () => {
        await expectOwnAccess(await sessionOf("schoolAdmin"), A1);
    });

    it("école voisine du même réseau : ni élèves, ni notes, ni finances, ni export ; aucune écriture", async () => {
        await expectNoAccess(await sessionOf("schoolAdmin"), A2);
    });
});

describe("DIRECTOR gestionnaire du réseau", () => {
    it("sa propre école lisible ; école voisine fermée, aucune écriture", async () => {
        await expectOwnAccess(await sessionOf("director"), A1);
        await expectNoAccess(await sessionOf("director"), A2);
    });
});

describe("NETWORK_ADMIN", () => {
    it("son réseau : élèves, notes et paiements de l'école voisine lisibles (école voisine choisie comme école active)", async () => {
        await expectOwnAccess(await sessionOf("network"), A1);
        await expectOwnAccess(await sessionOf("network", A2.schoolId), A2);
    });

    it("autre réseau : fermé, aucune écriture", async () => {
        await expectNoAccess(await sessionOf("network"), B1);
    });
});

describe("Membre de plusieurs organisations (adhésions héritées)", () => {
    it("SCHOOL_ADMIN propriétaire de deux réseaux : son école seulement, aucune école des deux réseaux", async () => {
        expect(await scopeOf("multiOrgAdmin")).toEqual([A1.schoolId]);
        await expectNoAccess(await sessionOf("multiOrgAdmin"), A2);
        await expectNoAccess(await sessionOf("multiOrgAdmin"), B1);
    });
});

describe("Révocation et changement de rôle pendant une session ouverte (vrais callbacks)", () => {
    it("NETWORK_ADMIN rétrogradé SCHOOL_ADMIN : le jeton suivant perd le réseau, l'école voisine se ferme", async () => {
        await user("demoted", "NETWORK_ADMIN", A1.schoolId);
        await join(orgA, "demoted");
        const token = loginToken("demoted", await scopeOf("demoted"));
        expect(token.accessibleSchoolIds).toContain(A2.schoolId);

        await prisma.user.update({ where: { id: users.demoted.id }, data: { role: "SCHOOL_ADMIN" } });
        const after = await jwt({ token: { ...token } });
        expect(after.role).toBe("SCHOOL_ADMIN");
        expect(after.accessibleSchoolIds).toEqual([A1.schoolId]);
        await expectNoAccess(await toSession(after), A2);
    });

    it("SCHOOL_ADMIN promu NETWORK_ADMIN : le réseau s'ouvre à la requête suivante (le marqueur fonctionne dans les deux sens)", async () => {
        await user("promoted", "SCHOOL_ADMIN", A1.schoolId);
        await join(orgA, "promoted", { isOwner: true });
        const token = loginToken("promoted", await scopeOf("promoted"));
        expect(token.accessibleSchoolIds).toEqual([A1.schoolId]);
        await prisma.user.update({ where: { id: users.promoted.id }, data: { role: "NETWORK_ADMIN" } });
        const after = await jwt({ token: { ...token } });
        expect([...(after.accessibleSchoolIds as string[])].sort()).toEqual([A1.schoolId, A2.schoolId].sort());
    });

    it("adhésion retirée : le jeton suivant (cache compris) perd le réseau", async () => {
        await user("removed", "NETWORK_ADMIN", A1.schoolId);
        const membership = await join(orgA, "removed");
        const token = loginToken("removed", await scopeOf("removed"));
        await jwt({ token: { ...token } }); // calcul mis en cache sur cette instance
        await prisma.organizationMembership.delete({ where: { id: membership.id } });
        const after = await jwt({ token: { ...token } });
        expect(after.accessibleSchoolIds).toEqual([A1.schoolId]);
        await expectNoAccess(await toSession(after), A2);
    });
});

describe("Dernier rempart : la RLS PostgreSQL suit le même périmètre", () => {
    it("requête sans filtre d'école (oubli dans une route) : seuls les paiements du périmètre sont visibles", async () => {
        const ids = [A1.ids.payment, A2.ids.payment, B1.ids.payment];
        const visible = async (session: Session) =>
            (await runWithDbContext(dbContextForSession(session), () =>
                appDb.payment.findMany({ where: { id: { in: ids } }, select: { id: true } }),
            )).map((r) => r.id).sort();
        expect(await visible(await sessionOf("schoolAdmin"))).toEqual([A1.ids.payment]);
        expect(await visible(await sessionOf("director"))).toEqual([A1.ids.payment]);
        expect(await visible(await sessionOf("multiOrgAdmin"))).toEqual([A1.ids.payment]);
        expect(await visible(await sessionOf("network"))).toEqual([A1.ids.payment, A2.ids.payment].sort());
    });
});

describe("SUPER_ADMIN : pas de régression", () => {
    it("école sélectionnée : élèves, notes et paiements de cette école lisibles, rien d'une autre", async () => {
        const root = (await prisma.user.create({
            data: { email: `${uniqueCode("s5d-root")}@integration.test`, password: "x", firstName: "Root", lastName: "S5", role: "SUPER_ADMIN" },
        })).id;
        actAs(sessionFor("SUPER_ADMIN", A2.schoolId, root));
        // Fiche de l'élève (et non la liste : pour le super-admin, /api/students
        // ignore l'école et liste tous les établissements — constat hors S5, signalé)
        const student = await callRoute(getStudent, { path: `/api/students/${A2.ids.student}`, params: { id: A2.ids.student } });
        expect(student.status).toBe(200);
        expect(text((await callRoute(listGrades, { path: `/api/grades?studentId=${A2.ids.student}` })).body)).toContain(A2.ids.grade);
        const payments = await callRoute(listFinancePayments, { path: "/api/finance/payments" });
        expect(payments.status).toBe(200);
        expect(text(payments.body)).toContain(A2.ids.payment);
        expect(text(payments.body)).not.toContain(B1.ids.payment);
    });
});
