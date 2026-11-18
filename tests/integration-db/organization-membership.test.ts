import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { POST as addMember } from "@/app/api/organizations/members/route";
import { GET as listOrganizations } from "@/app/api/organizations/route";

/**
 * Lot S5 (audit de souveraineté, I-03) — POST /api/organizations/members :
 * tout gestionnaire ajoutait n'importe quel compte actif de la plateforme
 * (toute école, tout rôle), le droit de gestion était accordé par défaut, et
 * un gestionnaire non propriétaire pouvait rétrograder un propriétaire.
 */
let org: string;
let otherOrg: string;
let schoolA: string;
let schoolB: string;
let schoolX: string;
const users: Record<string, { id: string; role: UserRole; schoolId: string | null }> = {};

async function user(key: string, role: UserRole, schoolId: string | null, isActive = true) {
    const u = await prisma.user.create({
        data: { email: `${uniqueCode(key)}@integration.test`, password: "x", firstName: key, lastName: "S5", role, schoolId, isActive },
    });
    users[key] = { id: u.id, role, schoolId };
    return u.id;
}
const member = (organizationId: string, key: string, rights: { isOwner?: boolean; canManageSites?: boolean } = {}) =>
    prisma.organizationMembership.create({
        data: { organizationId, userId: users[key].id, isOwner: rights.isOwner ?? false, canManageSites: rights.canManageSites ?? false },
    });
const as = (key: string) => actAs(sessionFor(users[key].role, users[key].schoolId, users[key].id));
const add = (target: string, extra: Record<string, unknown> = {}, organizationId = org) =>
    callRoute(addMember, { method: "POST", path: "/api/organizations/members", body: { organizationId, userId: users[target].id, ...extra } });
const membershipOf = (key: string, organizationId = org) =>
    prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId, userId: users[key].id } } });

beforeAll(async () => {
    org = (await prisma.organization.create({ data: { name: "Réseau S5", code: uniqueCode("ORG") } })).id;
    otherOrg = (await prisma.organization.create({ data: { name: "Autre réseau", code: uniqueCode("ORG") } })).id;
    [schoolA, schoolB, schoolX] = [(await createSchool("IT-S5-A")).id, (await createSchool("IT-S5-B")).id, (await createSchool("IT-S5-X")).id];
    await prisma.school.updateMany({ where: { id: { in: [schoolA, schoolB] } }, data: { organizationId: org } });
    await prisma.school.update({ where: { id: schoolX }, data: { organizationId: otherOrg } });

    await user("owner", "SCHOOL_ADMIN", schoolA);
    await user("coOwner", "DIRECTOR", schoolB);
    await user("manager", "SCHOOL_ADMIN", schoolA);
    await user("plain", "DIRECTOR", schoolB);
    await user("directorA", "DIRECTOR", schoolA);
    await user("directorB", "DIRECTOR", schoolB);
    await user("adminA2", "SCHOOL_ADMIN", schoolA);
    await user("teacherA", "TEACHER", schoolA);
    await user("parentA", "PARENT", schoolA);
    await user("adminX", "SCHOOL_ADMIN", schoolX);
    await user("inactiveA", "SCHOOL_ADMIN", schoolA, false);
    await user("networkNoSchool", "NETWORK_ADMIN", null);
    await user("root", "SUPER_ADMIN", null);
    await member(org, "owner", { isOwner: true, canManageSites: true });
    await member(org, "manager", { canManageSites: true });
    await member(org, "plain");
});

describe("Qui peut agir", () => {
    it("compte sans adhésion (même directeur d'une école du réseau) : 403, rien créé", async () => {
        as("directorA");
        expect((await add("directorB")).status).toBe(403);
        expect(await membershipOf("directorB")).toBeNull();
    });

    it("membre simple : ne peut ni ajouter, ni s'accorder la gestion", async () => {
        as("plain");
        expect((await add("directorA")).status).toBe(403);
        expect((await add("plain", { canManageSites: true })).status).toBe(403);
        expect((await membershipOf("plain"))!.canManageSites).toBe(false);
        expect(await membershipOf("directorA")).toBeNull();
    });

    it("droits révoqués : un gestionnaire rétrogradé ne peut plus ajouter", async () => {
        await user("exManager", "SCHOOL_ADMIN", schoolA);
        await member(org, "exManager", { canManageSites: true });
        as("owner");
        expect((await add("exManager", { canManageSites: false })).status).toBe(201);
        as("exManager");
        const res = await add("adminA2");
        expect(res.status).toBe(403);
        expect(await membershipOf("adminA2")).toBeNull();
    });

    it("gestionnaire d'une organisation : aucun droit sur une autre organisation", async () => {
        as("manager");
        expect((await add("adminX", {}, otherOrg)).status).toBe(403);
        expect(await membershipOf("adminX", otherOrg)).toBeNull();
    });
});

describe("Droits accordés : jamais implicites, seulement par un propriétaire", () => {
    it("gestionnaire : ajoute un membre simple d'une autre école du réseau ; la gestion n'est pas accordée par défaut", async () => {
        as("manager");
        const res = await add("directorB");
        expect(res.status).toBe(201);
        expect(await membershipOf("directorB")).toMatchObject({ isOwner: false, canManageSites: false });
    });

    it("gestionnaire : demande de propriété ou de gestion refusée, rien créé", async () => {
        await user("candidate", "DIRECTOR", schoolA);
        as("manager");
        expect((await add("candidate", { isOwner: true })).status).toBe(403);
        expect((await add("candidate", { canManageSites: true })).status).toBe(403);
        expect(await membershipOf("candidate")).toBeNull();
    });

    it("propriétaire : accorde explicitement la gestion", async () => {
        as("owner");
        expect((await add("adminA2", { canManageSites: true })).status).toBe(201);
        expect(await membershipOf("adminA2")).toMatchObject({ canManageSites: true, isOwner: false });
    });

    it("la valeur par défaut en base n'accorde plus la gestion", async () => {
        await user("dbDefault", "DIRECTOR", schoolA);
        await prisma.$executeRawUnsafe(
            `INSERT INTO "organization_memberships" ("id", "organizationId", "userId", "updatedAt") VALUES ($1, $2, $3, now())`,
            uniqueCode("om"), org, users.dbDefault.id,
        );
        expect(await membershipOf("dbDefault")).toMatchObject({ isOwner: false, canManageSites: false });
    });
});

describe("Admissibilité : responsables d'une école du réseau", () => {
    it("compte d'une école hors du réseau : 404 (même réponse qu'un compte inexistant), rien créé", async () => {
        as("manager");
        const res = await add("adminX");
        expect(res.status).toBe(404);
        expect(await membershipOf("adminX")).toBeNull();
    });

    it("rôle non responsable (enseignant, parent) d'une école du réseau : 400, rien créé", async () => {
        as("owner");
        expect((await add("teacherA")).status).toBe(400);
        expect((await add("parentA")).status).toBe(400);
        expect(await membershipOf("teacherA")).toBeNull();
        expect(await membershipOf("parentA")).toBeNull();
    });

    it("compte inactif : 404", async () => {
        as("owner");
        expect((await add("inactiveA")).status).toBe(404);
    });

    it("NETWORK_ADMIN sans école : refusé à un propriétaire, accepté par SUPER_ADMIN", async () => {
        as("owner");
        expect((await add("networkNoSchool")).status).toBe(404);
        as("root");
        expect((await add("networkNoSchool")).status).toBe(201);
    });
});

describe("Propriétaires protégés", () => {
    it("gestionnaire : ne peut ni rétrograder un propriétaire ni modifier un autre gestionnaire", async () => {
        as("manager");
        expect((await add("owner", { isOwner: false, canManageSites: false })).status).toBe(403);
        expect(await membershipOf("owner")).toMatchObject({ isOwner: true, canManageSites: true });
        expect((await add("adminA2", { canManageSites: false })).status).toBe(403);
        expect((await membershipOf("adminA2"))!.canManageSites).toBe(true);
    });

    it("dernier propriétaire : jamais rétrogradé (409), même par lui-même ou par SUPER_ADMIN", async () => {
        as("owner");
        expect((await add("owner", { isOwner: false, canManageSites: true })).status).toBe(409);
        as("root");
        expect((await add("owner", { isOwner: false })).status).toBe(409);
        expect((await membershipOf("owner"))!.isOwner).toBe(true);
    });

    it("avec deux propriétaires : l'un peut rétrograder l'autre", async () => {
        as("owner");
        expect((await add("coOwner", { isOwner: true, canManageSites: true })).status).toBe(201);
        as("coOwner");
        expect((await add("owner", { isOwner: false, canManageSites: true })).status).toBe(201);
        expect(await membershipOf("owner")).toMatchObject({ isOwner: false, canManageSites: true });
        // Remise en état pour la suite
        expect((await add("owner", { isOwner: true, canManageSites: true })).status).toBe(201);
    });

    // Le harnais n'a qu'une session à la fois : la requête concurrente est
    // simulée par une transaction qui prend le même verrou d'organisation
    it("courses : propriétaire rétrogradé pendant qu'il rétrograde l'autre → la route attend, relit ses droits, refuse ; un propriétaire reste", async () => {
        const raceOrg = (await prisma.organization.create({ data: { name: "Course", code: uniqueCode("ORG") } })).id;
        const raceSchool = (await createSchool("IT-S5-R")).id;
        await prisma.school.update({ where: { id: raceSchool }, data: { organizationId: raceOrg } });
        await user("raceOwner1", "SCHOOL_ADMIN", raceSchool);
        await user("raceOwner2", "DIRECTOR", raceSchool);
        await member(raceOrg, "raceOwner1", { isOwner: true, canManageSites: true });
        await member(raceOrg, "raceOwner2", { isOwner: true, canManageSites: true });
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const [concurrent, route] = await Promise.allSettled([
            prisma.$transaction(async (tx) => {
                await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`organization-membership:${raceOrg}`}))::text`;
                await tx.organizationMembership.update({
                    where: { organizationId_userId: { organizationId: raceOrg, userId: users.raceOwner2.id } },
                    data: { isOwner: false },
                });
                await sleep(400);
            }),
            sleep(100).then(() => {
                as("raceOwner2");
                return callRoute(addMember, {
                    method: "POST", path: "/api/organizations/members",
                    body: { organizationId: raceOrg, userId: users.raceOwner1.id, isOwner: false, canManageSites: true },
                });
            }),
        ]);

        expect(concurrent.status).toBe("fulfilled");
        expect(route.status === "fulfilled" && route.value.status).toBe(403);
        expect(await prisma.organizationMembership.count({ where: { organizationId: raceOrg, isOwner: true } })).toBe(1);
        expect((await membershipOf("raceOwner1", raceOrg))!.isOwner).toBe(true);
    });
});

describe("Routes voisines", () => {
    it("GET /api/organizations : un membre simple est refusé (403), sans aucune donnée d'organisation", async () => {
        as("plain");
        const res = await callRoute(listOrganizations, { method: "GET", path: "/api/organizations" });
        expect(res.status).toBe(403);
        expect(JSON.stringify(res.body)).not.toContain(org);
    });

    it("GET /api/organizations : un gestionnaire ne voit que son organisation", async () => {
        as("manager");
        const res = await callRoute(listOrganizations, { method: "GET", path: "/api/organizations" });
        expect(res.status).toBe(200);
        const text = JSON.stringify(res.body);
        expect(text).toContain(org);
        expect(text).not.toContain(otherOrg);
    });
});
