import { beforeAll, describe, expect, it, vi } from "vitest";

// Console root : l'e-mail de la session doit figurer dans ROOT_USER_EMAILS, lu au
// chargement de lib/security/root-access — défini avant l'import des routes.
vi.hoisted(() => {
    process.env.ROOT_USER_EMAILS = "super_admin@integration.test";
});

import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, sessionFor, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { GET as listStudents } from "@/app/api/students/route";
import { GET as getStudent, PATCH as patchStudent, DELETE as deleteStudent } from "@/app/api/students/[id]/route";
import { GET as rootSummary } from "@/app/api/root/analytics/summary/route";

/**
 * Élèves et super-administrateur (2026-10-18) — `GET /api/students` ne
 * filtrait aucune école pour le super-admin : avec une école sélectionnée ou
 * un ?schoolId=, il recevait les élèves de TOUS les établissements, paginés
 * ensemble. Les autres rôles voyaient leur ?schoolId= ignoré au profit de
 * l'école active. Désormais même règle que les finances (S6) : école choisie,
 * vérifiée, jamais substituée ; la console racine reste la vue globale.
 */
let A: TenantGraph;
let B: TenantGraph;
let rootId: string;
let matriculeA: string;
let matriculeB: string;

const as = (role: UserRole, active: string | null, userId: string, accessible: string[] = active ? [active] : []): Session => {
    const base = sessionFor(role, active, userId);
    return { ...base, user: { ...base.user, email: role === "SUPER_ADMIN" ? "super_admin@integration.test" : base.user.email, accessibleSchoolIds: accessible } };
};
const root = (active: string | null) => as("SUPER_ADMIN", active, rootId);
const text = (body: unknown) => JSON.stringify(body);
type Page = { data: Array<{ id: string; user: { schoolId: string } }>; pagination: { nextCursor: string | null } };

/** Toutes les pages d'une liste (curseur), pour vérifier qu'aucune ne mélange les écoles. */
async function allPages(query: string) {
    const rows: Page["data"] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 200; i++) {
        const res = await callRoute(listStudents, { path: `/api/students?limit=2&${query}${cursor ? `&cursor=${cursor}` : ""}` });
        expect(res.status).toBe(200);
        const page = res.body as Page;
        rows.push(...page.data);
        cursor = page.pagination.nextCursor;
        if (!cursor) break;
    }
    return rows;
}

beforeAll(async () => {
    [A, B] = [await seedTenantGraph("STU-A"), await seedTenantGraph("STU-B")];
    // Quelques élèves de plus, inscrits dans l'année courante (la liste lit
    // par défaut les inscriptions de l'année courante), pour la pagination
    for (const g of [A, B]) {
        const year = await prisma.academicYear.findFirstOrThrow({ where: { schoolId: g.schoolId, isCurrent: true }, select: { id: true } });
        for (let i = 0; i < 3; i++) {
            const u = await prisma.user.create({
                data: { email: `${uniqueCode("stu-extra")}@integration.test`, password: "x", firstName: "Extra", lastName: `N${i}`, role: "STUDENT", schoolId: g.schoolId },
            });
            const profile = await prisma.studentProfile.create({ data: { userId: u.id, schoolId: g.schoolId, matricule: uniqueCode("EXT") } });
            await prisma.enrollment.create({ data: { studentId: profile.id, classId: g.ids.class, academicYearId: year.id } });
        }
    }
    matriculeA = (await prisma.studentProfile.findUniqueOrThrow({ where: { id: A.ids.student } })).matricule!;
    matriculeB = (await prisma.studentProfile.findUniqueOrThrow({ where: { id: B.ids.student } })).matricule!;
    rootId = (await prisma.user.create({
        data: { email: `${uniqueCode("stu-root")}@integration.test`, password: "x", firstName: "Root", lastName: "Eleves", role: "SUPER_ADMIN" },
    })).id;
});

describe("Liste des élèves — super-admin", () => {
    it("école A sélectionnée : toutes les pages ne contiennent que des élèves de A", async () => {
        actAs(root(A.schoolId));
        const rows = await allPages("");
        expect(rows.length).toBeGreaterThanOrEqual(4);
        expect(rows.map((r) => r.id)).toContain(A.ids.student);
        expect(new Set(rows.map((r) => r.user.schoolId))).toEqual(new Set([A.schoolId]));
    });

    it("recherche du matricule d'un élève de B depuis A : aucun résultat", async () => {
        actAs(root(A.schoolId));
        const res = await callRoute(listStudents, { path: `/api/students?search=${encodeURIComponent(matriculeB)}` });
        expect(res.status).toBe(200);
        expect((res.body as Page).data).toEqual([]);
        // Le même filtre trouve bien l'élève de A (la recherche fonctionne)
        const own = await callRoute(listStudents, { path: `/api/students?search=${encodeURIComponent(matriculeA)}` });
        expect((own.body as Page).data.map((r) => r.id)).toEqual([A.ids.student]);
    });

    it("école B demandée alors que A est sélectionnée : 403 SCHOOL_MISMATCH, aucune donnée", async () => {
        actAs(root(A.schoolId));
        const res = await callRoute(listStudents, { path: `/api/students?schoolId=${B.schoolId}` });
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: "SCHOOL_MISMATCH" });
        expect(text(res.body)).not.toContain(B.ids.student);
    });

    it("aucune école sélectionnée : 400 SCHOOL_REQUIRED (plus de liste de toutes les écoles)", async () => {
        actAs(root(null));
        const res = await callRoute(listStudents, { path: "/api/students" });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: "SCHOOL_REQUIRED" });
        expect(text(res.body)).not.toContain(A.ids.student);
    });

    it("identifiant d'école inexistant ou malformé : 404", async () => {
        actAs(root(null));
        for (const id of ["cl0000000000000000000000", "x' OR 1=1 --"]) {
            const res = await callRoute(listStudents, { path: `/api/students?schoolId=${encodeURIComponent(id)}` });
            expect(res.status, id).toBe(404);
        }
    });

    it("sans école active, une école désignée explicitement : ses élèves seulement", async () => {
        actAs(root(null));
        const rows = await allPages(`schoolId=${B.schoolId}`);
        expect(rows.map((r) => r.id)).toContain(B.ids.student);
        expect(new Set(rows.map((r) => r.user.schoolId))).toEqual(new Set([B.schoolId]));
    });

    it("accès journalisés (opération, résultat) sans donnée d'élève", async () => {
        const rows = await prisma.auditLog.findMany({ where: { userId: rootId, action: "SCHOOL_SCOPE_ACCESS", entity: "STUDENTS" } });
        const values = rows.map((r) => r.newValues as Record<string, unknown>);
        expect(values.some((v) => v.operation === "students:list" && v.outcome === "GRANTED")).toBe(true);
        expect(values.some((v) => v.outcome === "DENIED" && v.reason === "SCHOOL_MISMATCH")).toBe(true);
        expect(text(values)).not.toContain(matriculeA);
    });
});

describe("Vue explicitement globale (console racine)", () => {
    it("accueil de la console racine : effectifs de toutes les écoles, sans liste nominative", async () => {
        actAs(root(null));
        const res = await callRoute(rootSummary, { path: "/api/root/analytics/summary" });
        expect(res.status).toBe(200);
        expect(text(res.body)).not.toContain(matriculeA);
        expect(text(res.body)).not.toContain(matriculeB);
    });

    it("fiche d'un élève sans école sélectionnée : 400, aucune donnée (la console ne contourne pas la sélection)", async () => {
        actAs(root(null));
        const res = await callRoute(getStudent, { path: `/api/students/${B.ids.student}`, params: { id: B.ids.student } });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: "SCHOOL_REQUIRED" });
        expect(text(res.body)).not.toContain(matriculeB);
        expect(text(res.body)).not.toContain(B.ids.student);
    });

    it("identifiant inexistant : sans école, même 400 (aucun indice d'existence) ; avec école, 404", async () => {
        const missing = "cl0000000000000000000000";
        actAs(root(null));
        const unselected = await callRoute(getStudent, { path: `/api/students/${missing}`, params: { id: missing } });
        const existingUnselected = await callRoute(getStudent, { path: `/api/students/${B.ids.student}`, params: { id: B.ids.student } });
        expect(unselected.status).toBe(400);
        expect(unselected.body).toEqual(existingUnselected.body);
        actAs(root(A.schoolId));
        expect((await callRoute(getStudent, { path: `/api/students/${missing}`, params: { id: missing } })).status).toBe(404);
    });
});

describe("Fiche individuelle — super-admin dans une école", () => {
    it("école A sélectionnée : fiche de A lisible, fiche de B refusée sans fuite", async () => {
        actAs(root(A.schoolId));
        const own = await callRoute(getStudent, { path: `/api/students/${A.ids.student}`, params: { id: A.ids.student } });
        expect(own.status).toBe(200);
        expect(text(own.body)).toContain(matriculeA);
        const other = await callRoute(getStudent, { path: `/api/students/${B.ids.student}`, params: { id: B.ids.student } });
        expect(other.status).toBe(403);
        expect(text(other.body)).not.toContain(matriculeB);
    });

    it("modification et suppression d'un élève de B depuis A, ou sans école : refusées, rien d'écrit", async () => {
        const before = await prisma.user.findFirstOrThrow({ where: { studentProfile: { id: B.ids.student } } });
        actAs(root(A.schoolId));
        const patched = await callRoute(patchStudent, { method: "PATCH", path: `/api/students/${B.ids.student}`, params: { id: B.ids.student }, body: { firstName: "Intrus" } });
        expect(patched.status).toBe(403);
        const deleted = await callRoute(deleteStudent, { method: "DELETE", path: `/api/students/${B.ids.student}`, params: { id: B.ids.student } });
        expect(deleted.status).toBe(403);
        actAs(root(null));
        const unselected = await callRoute(patchStudent, { method: "PATCH", path: `/api/students/${B.ids.student}`, params: { id: B.ids.student }, body: { firstName: "Intrus" } });
        expect(unselected.status).toBe(400);
        const after = await prisma.user.findFirstOrThrow({ where: { studentProfile: { id: B.ids.student } } });
        expect(after.firstName).toBe(before.firstName);
        expect(after.isActive).toBe(true);
    });
});

describe("Autres rôles", () => {
    it("administrateur de A : fiche de son élève lisible, fiche d'un élève de B refusée sans fuite (inchangé)", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const own = await callRoute(getStudent, { path: `/api/students/${A.ids.student}`, params: { id: A.ids.student } });
        expect(own.status).toBe(200);
        expect(text(own.body)).toContain(matriculeA);
        const other = await callRoute(getStudent, { path: `/api/students/${B.ids.student}`, params: { id: B.ids.student } });
        expect([403, 404]).toContain(other.status);
        expect(text(other.body)).not.toContain(matriculeB);
    });

    it("administrateur de A : ?schoolId=B refusé ; sa liste ne contient que A (inchangé)", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(listStudents, { path: `/api/students?schoolId=${B.schoolId}` });
        expect(res.status).toBe(403);
        expect(text(res.body)).not.toContain(B.ids.student);
        const rows = await allPages("");
        expect(new Set(rows.map((r) => r.user.schoolId))).toEqual(new Set([A.schoolId]));
    });

    it("compte de deux écoles : ?schoolId= de l'autre école accessible est respecté (n'est plus ignoré)", async () => {
        const multi = await prisma.user.create({
            data: { email: `${uniqueCode("stu-net")}@integration.test`, password: "x", firstName: "Net", lastName: "Admin", role: "NETWORK_ADMIN", schoolId: A.schoolId },
        });
        actAs(as("NETWORK_ADMIN", A.schoolId, multi.id, [A.schoolId, B.schoolId]));
        const rows = await allPages(`schoolId=${B.schoolId}`);
        expect(rows.map((r) => r.id)).toContain(B.ids.student);
        expect(new Set(rows.map((r) => r.user.schoolId))).toEqual(new Set([B.schoolId]));
    });
});
