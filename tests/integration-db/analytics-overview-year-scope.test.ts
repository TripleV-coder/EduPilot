import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { GET } from "@/app/api/analytics/school/overview/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { seedAnalyticsSchool, type AnalyticsSchoolFixture } from "./fixtures/analytics-school";

/**
 * Audit du 2026-10-16 — `GET /api/analytics/school/overview` acceptait un
 * `academicYearId` (et un `periodId`) d'une autre école : réponse 200 avec les
 * périodes de cette école (identifiants, noms, ordres). Reproduit dans Chrome.
 * Les données d'élèves restaient celles de l'école de la requête.
 *
 * École A : fixture d'analyse (6 élèves, année courante, T1/T2).
 * École B : une année et deux périodes aux noms reconnaissables.
 */
let A: AnalyticsSchoolFixture;
let schoolB: string;
let yearB: string;
let periodB1: string;
const B_PERIODS = ["PERIODE-B-ETRANGERE-1", "PERIODE-B-ETRANGERE-2"];

type Body = { error?: string; periods?: Array<{ id: string; name: string }>; overview?: { totalStudents: number } };

function multiSchoolAdmin(active: string): Session {
    const base = sessionFor("SCHOOL_ADMIN", active, A.adminId);
    return { ...base, user: { ...base.user, accessibleSchoolIds: [A.schoolId, schoolB] } };
}

beforeAll(async () => {
    A = await seedAnalyticsSchool();
    schoolB = (await createSchool("OVY-B")).id;
    const year = await prisma.academicYear.create({
        data: { schoolId: schoolB, name: uniqueCode("ANNEE-B-ETRANGERE"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
    });
    yearB = year.id;
    periodB1 = (await prisma.period.create({
        data: { academicYearId: yearB, name: B_PERIODS[0], type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 },
    })).id;
    await prisma.period.create({
        data: { academicYearId: yearB, name: B_PERIODS[1], type: "TRIMESTER", startDate: new Date("2026-01-05"), endDate: new Date("2026-03-30"), sequence: 2 },
    });
});

const leaksB = (body: unknown) => {
    const text = JSON.stringify(body);
    return B_PERIODS.some((name) => text.includes(name)) || text.includes(periodB1) || text.includes(yearB);
};

describe("overview — l'année et la période doivent appartenir à l'école de la requête", () => {
    it("A. année de A : périodes de A, totaux de A", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: `/api/analytics/school/overview?academicYearId=${A.yearId}` });
        const body = res.body as Body;
        expect(res.status).toBe(200);
        expect(body.periods?.map((p) => p.id)).toEqual([A.t1Id, A.t2Id]);
        expect(body.overview?.totalStudents).toBe(6);
        expect(leaksB(body)).toBe(false);
    });

    it("B/C. année de B : refusée (404), aucune période de B renvoyée", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: `/api/analytics/school/overview?academicYearId=${yearB}` });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Année scolaire introuvable" });
        expect(leaksB(res.body)).toBe(false);
    });

    it("B/C. période de B avec l'année de A : refusée, rien de B", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: `/api/analytics/school/overview?academicYearId=${A.yearId}&periodId=${periodB1}` });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Période introuvable" });
        expect(leaksB(res.body)).toBe(false);
    });

    it("D. requête sans année : comportement inchangé (année courante de A, 6 élèves)", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: "/api/analytics/school/overview" });
        const body = res.body as Body;
        expect(res.status).toBe(200);
        expect(body.overview?.totalStudents).toBe(6);
        expect(body.periods?.map((p) => p.id)).toEqual([A.t1Id, A.t2Id]);
    });

    it("E. année inexistante : même réponse qu'une année étrangère (404)", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: "/api/analytics/school/overview?academicYearId=annee-qui-n-existe-pas" });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Année scolaire introuvable" });
    });

    it("F. contrôle central : ?schoolId=B refusé pour un compte limité à A", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: `/api/analytics/school/overview?schoolId=${schoolB}&academicYearId=${yearB}` });
        expect(res.status).toBe(403);
        expect(leaksB(res.body)).toBe(false);
    });

    it("F. compte rattaché à A et B, école active B : l'année de B est acceptée", async () => {
        actAs(multiSchoolAdmin(schoolB));
        const res = await callRoute(GET, { path: `/api/analytics/school/overview?academicYearId=${yearB}` });
        const body = res.body as Body;
        expect(res.status).toBe(200);
        expect(body.periods?.map((p) => p.name)).toEqual(B_PERIODS);
    });

    it("F. même compte, école active B : l'année de A n'est pas mêlée à la vue de B", async () => {
        actAs(multiSchoolAdmin(schoolB));
        const res = await callRoute(GET, { path: `/api/analytics/school/overview?academicYearId=${A.yearId}` });
        expect(res.status).toBe(404);
    });

    it("F. même compte, ?schoolId=A explicite avec l'année de A : accepté", async () => {
        actAs(multiSchoolAdmin(schoolB));
        const res = await callRoute(GET, { path: `/api/analytics/school/overview?schoolId=${A.schoolId}&academicYearId=${A.yearId}` });
        const body = res.body as Body;
        expect(res.status).toBe(200);
        expect(body.overview?.totalStudents).toBe(6);
    });
});
