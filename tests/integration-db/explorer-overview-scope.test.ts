import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { GET as overview } from "@/app/api/explorer/overview/route";

/**
 * Sécurité HTTP (2026-10-18) — /api/explorer/overview renvoyait à tout
 * utilisateur connecté les comptages de toute la plateforme (écoles, classes,
 * enseignants ne sont pas sous RLS). Désormais : ses écoles seulement ;
 * SUPER_ADMIN garde la vue globale.
 */
let schoolA: string;
let schoolB: string;

beforeAll(async () => {
    [schoolA, schoolB] = [(await createSchool("IT-EXP-A")).id, (await createSchool("IT-EXP-B")).id];
    const level = await prisma.classLevel.create({ data: { schoolId: schoolB, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
    for (let i = 0; i < 3; i++) await prisma.class.create({ data: { schoolId: schoolB, classLevelId: level.id, name: uniqueCode("B") } });
});

describe("explorer/overview : comptages limités au périmètre", () => {
    it("SCHOOL_ADMIN de A : une école, aucune classe de B comptée", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", schoolA));
        const res = await callRoute(overview, { method: "GET", path: "/api/explorer/overview" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ schools: 1, classes: 0 });
    });

    it("SUPER_ADMIN : vue globale (au moins les deux écoles et les classes de B)", async () => {
        actAs(sessionFor("SUPER_ADMIN", null));
        const res = await callRoute(overview, { method: "GET", path: "/api/explorer/overview" });
        const body = res.body as { schools: number; classes: number };
        expect(body.schools).toBeGreaterThanOrEqual(2);
        expect(body.classes).toBeGreaterThanOrEqual(3);
    });
});
