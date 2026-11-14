import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { getAccessibleSchoolIdsForUser } from "@/lib/auth/school-access";
import { GET as listStudents } from "@/app/api/students/route";
import { GET as getStudent } from "@/app/api/students/[id]/route";
import { GET as financeDashboard } from "@/app/api/finance/dashboard/route";
import { GET as organizationOverview } from "@/app/api/analytics/organization/overview/route";

/**
 * Lot S5, périmètre des écoles (décision métier 2026-10-18) — l'adhésion à une
 * organisation ajoutait toutes ses écoles au périmètre de tout membre, quel
 * que soit son rôle : un SCHOOL_ADMIN propriétaire d'un réseau administrait
 * les écoles voisines. Désormais seul NETWORK_ADMIN reçoit les écoles de ses
 * organisations. La session est construite à partir du périmètre réellement
 * calculé en base, comme à la connexion.
 */
let orgA: string;
let orgB: string;
let schoolA1: string;
let schoolA2: string;
let schoolB1: string;
let studentA2: string;
const users: Record<string, { id: string; role: UserRole; schoolId: string | null }> = {};

async function user(key: string, role: UserRole, schoolId: string | null) {
    const u = await prisma.user.create({
        data: { email: `${uniqueCode(key)}@integration.test`, password: "x", firstName: key, lastName: "Scope", role, schoolId },
    });
    users[key] = { id: u.id, role, schoolId };
}
const join = (organizationId: string, key: string, rights: { isOwner?: boolean; canManageSites?: boolean } = {}) =>
    prisma.organizationMembership.create({ data: { organizationId, userId: users[key].id, isOwner: rights.isOwner ?? false, canManageSites: rights.canManageSites ?? false } });
const scopeOf = (key: string) =>
    getAccessibleSchoolIdsForUser({ userId: users[key].id, role: users[key].role, primarySchoolId: users[key].schoolId });
/** Session telle que construite à la connexion : périmètre recalculé en base. */
async function sessionOf(key: string): Promise<Session> {
    const base = sessionFor(users[key].role, users[key].schoolId, users[key].id);
    return { ...base, user: { ...base.user, accessibleSchoolIds: await scopeOf(key) } } as Session;
}

beforeAll(async () => {
    orgA = (await prisma.organization.create({ data: { name: "Réseau A", code: uniqueCode("ORG") } })).id;
    orgB = (await prisma.organization.create({ data: { name: "Réseau B", code: uniqueCode("ORG") } })).id;
    [schoolA1, schoolA2, schoolB1] = [(await createSchool("IT-SC-A1")).id, (await createSchool("IT-SC-A2")).id, (await createSchool("IT-SC-B1")).id];
    await prisma.school.updateMany({ where: { id: { in: [schoolA1, schoolA2] } }, data: { organizationId: orgA } });
    await prisma.school.update({ where: { id: schoolB1 }, data: { organizationId: orgB } });
    // La vue consolidée exige une année active dans l'organisation
    for (const schoolId of [schoolA1, schoolA2]) {
        await prisma.academicYear.create({ data: { schoolId, name: uniqueCode("AN"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true } });
    }
    const pupil = await prisma.user.create({
        data: { email: `${uniqueCode("eleve")}@integration.test`, password: "x", firstName: "Voisin", lastName: "Secret", role: "STUDENT", schoolId: schoolA2 },
    });
    studentA2 = (await prisma.studentProfile.create({ data: { userId: pupil.id, matricule: uniqueCode("MAT"), schoolId: schoolA2 } })).id;

    await user("ownerAdmin", "SCHOOL_ADMIN", schoolA1);
    await user("director", "DIRECTOR", schoolA1);
    await user("plainAccountant", "ACCOUNTANT", schoolA1);
    await user("network", "NETWORK_ADMIN", schoolA1);
    await user("multiNetwork", "NETWORK_ADMIN", schoolA1);
    await join(orgA, "ownerAdmin", { isOwner: true, canManageSites: true });
    await join(orgA, "director", { canManageSites: true });
    await join(orgA, "plainAccountant");
    await join(orgA, "network");
    await join(orgA, "multiNetwork");
    await join(orgB, "multiNetwork");
});

describe("Périmètre calculé", () => {
    it("SCHOOL_ADMIN propriétaire du réseau, DIRECTOR gestionnaire, membre simple : leur école seulement", async () => {
        expect(await scopeOf("ownerAdmin")).toEqual([schoolA1]);
        expect(await scopeOf("director")).toEqual([schoolA1]);
        expect(await scopeOf("plainAccountant")).toEqual([schoolA1]);
    });

    it("NETWORK_ADMIN : les écoles de son réseau, pas celles d'un autre réseau", async () => {
        expect((await scopeOf("network")).sort()).toEqual([schoolA1, schoolA2].sort());
    });

    it("NETWORK_ADMIN membre de deux réseaux : les deux, par adhésions explicites", async () => {
        expect((await scopeOf("multiNetwork")).sort()).toEqual([schoolA1, schoolA2, schoolB1].sort());
    });

    it("révocation : un NETWORK_ADMIN retiré du réseau perd l'école voisine", async () => {
        await user("revoked", "NETWORK_ADMIN", schoolA1);
        const m = await join(orgA, "revoked");
        expect(await scopeOf("revoked")).toContain(schoolA2);
        await prisma.organizationMembership.delete({ where: { id: m.id } });
        expect(await scopeOf("revoked")).toEqual([schoolA1]);
    });
});

describe("Effets réels sur les routes", () => {
    it("SCHOOL_ADMIN propriétaire : liste, détail et finances de l'école voisine refusés ; sa propre école accessible", async () => {
        actAs(await sessionOf("ownerAdmin"));
        expect((await callRoute(listStudents, { method: "GET", path: `/api/students?schoolId=${schoolA2}` })).status).toBe(403);
        const detail = await callRoute(getStudent, { method: "GET", path: `/api/students/${studentA2}`, params: { id: studentA2 } });
        expect([403, 404]).toContain(detail.status);
        expect(JSON.stringify(detail.body)).not.toContain("Secret");
        expect((await callRoute(financeDashboard, { method: "GET", path: `/api/finance/dashboard?schoolId=${schoolA2}` })).status).toBe(403);
        expect((await callRoute(listStudents, { method: "GET", path: `/api/students?schoolId=${schoolA1}` })).status).toBe(200);
    });

    it("SCHOOL_ADMIN propriétaire : vue consolidée du réseau refusée (données des écoles voisines)", async () => {
        actAs(await sessionOf("ownerAdmin"));
        expect((await callRoute(organizationOverview, { method: "GET", path: `/api/analytics/organization/overview?organizationId=${orgA}` })).status).toBe(403);
    });

    it("DIRECTOR gestionnaire : détail d'un élève de l'école voisine refusé", async () => {
        actAs(await sessionOf("director"));
        const detail = await callRoute(getStudent, { method: "GET", path: `/api/students/${studentA2}`, params: { id: studentA2 } });
        expect([403, 404]).toContain(detail.status);
        expect(JSON.stringify(detail.body)).not.toContain("Secret");
    });

    it("NETWORK_ADMIN : élève de l'école voisine de son réseau lisible ; vue consolidée de SON réseau seulement", async () => {
        actAs(await sessionOf("network"));
        const detail = await callRoute(getStudent, { method: "GET", path: `/api/students/${studentA2}`, params: { id: studentA2 } });
        expect(detail.status).toBe(200);
        expect((await callRoute(organizationOverview, { method: "GET", path: `/api/analytics/organization/overview?organizationId=${orgA}` })).status).toBe(200);
        expect((await callRoute(organizationOverview, { method: "GET", path: `/api/analytics/organization/overview?organizationId=${orgB}` })).status).toBe(403);
    });

    it("schoolId falsifié dans la requête : n'étend jamais le périmètre", async () => {
        actAs(await sessionOf("director"));
        expect((await callRoute(listStudents, { method: "GET", path: `/api/students?schoolId=${schoolB1}` })).status).toBe(403);
    });
});
