import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { GET } from "@/app/api/analytics/period-comparison/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { seedAnalyticsSchool, type AnalyticsSchoolFixture } from "./fixtures/analytics-school";

/**
 * Audit du 2026-10-16 — `GET /api/analytics/period-comparison` lisait le nom
 * d'une période par son seul identifiant : avec une classe autorisée et une
 * période d'une autre école, ce nom était renvoyé. L'année fournie n'était pas
 * non plus rattachée à l'école de la classe.
 *
 * École A : fixture d'analyse (classe « A », T1/T2 avec analyses).
 * École B : une classe, une année et deux périodes aux noms reconnaissables.
 */
let A: AnalyticsSchoolFixture;
let classA: string;
let schoolB: string;
let classB: string;
let yearB: string;
let periodB1: string;
let periodB2: string;
const B_NAMES = ["PERIODE-B-COMPARAISON-1", "PERIODE-B-COMPARAISON-2"];

type Row = { periodId: string; periodName: string; studentCount: number; schoolId: string };
const url = (params: Record<string, string | string[]>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) for (const value of [v].flat()) q.append(k, value);
    return `/api/analytics/period-comparison?${q}`;
};
const leaksB = (body: unknown) => {
    const text = JSON.stringify(body);
    return B_NAMES.some((n) => text.includes(n)) || text.includes(periodB1) || text.includes(periodB2) || text.includes(yearB);
};
function multiSchoolAdmin(active: string): Session {
    const base = sessionFor("SCHOOL_ADMIN", active, A.adminId);
    return { ...base, user: { ...base.user, accessibleSchoolIds: [A.schoolId, schoolB] } };
}

beforeAll(async () => {
    A = await seedAnalyticsSchool();
    classA = (await prisma.class.findFirstOrThrow({ where: { schoolId: A.schoolId, name: "A" }, select: { id: true } })).id;
    schoolB = (await createSchool("PCS-B")).id;
    const level = await prisma.classLevel.create({ data: { schoolId: schoolB, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
    classB = (await prisma.class.create({ data: { schoolId: schoolB, classLevelId: level.id, name: "Classe-B" } })).id;
    yearB = (await prisma.academicYear.create({
        data: { schoolId: schoolB, name: uniqueCode("ANNEE-B"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
    })).id;
    periodB1 = (await prisma.period.create({ data: { academicYearId: yearB, name: B_NAMES[0], type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } })).id;
    periodB2 = (await prisma.period.create({ data: { academicYearId: yearB, name: B_NAMES[1], type: "TRIMESTER", startDate: new Date("2026-01-05"), endDate: new Date("2026-03-30"), sequence: 2 } })).id;
});

describe("period-comparison — année et périodes de l'école de la classe seulement", () => {
    it("périodes de A : noms et résultats de A", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: url({ academicYearId: A.yearId, classId: classA, periodIds: [A.t1Id, A.t2Id] }) });
        const rows = res.body as Row[];
        expect(res.status).toBe(200);
        expect(rows.map((r) => [r.periodId, r.periodName])).toEqual([[A.t1Id, "T1"], [A.t2Id, "T2"]]);
        expect(rows.every((r) => r.schoolId === A.schoolId)).toBe(true);
        expect(rows.some((r) => r.studentCount > 0)).toBe(true);
    });

    it("période de B avec classe et année de A : refusée, rien de B", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: url({ academicYearId: A.yearId, classId: classA, periodIds: [periodB1] }) });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Période introuvable" });
        expect(leaksB(res.body)).toBe(false);
    });

    it("mélange période de A + période de B : refusé en entier", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: url({ academicYearId: A.yearId, classId: classA, periodIds: [A.t1Id, periodB2] }) });
        expect(res.status).toBe(404);
        expect(leaksB(res.body)).toBe(false);
    });

    it("année de B avec la classe de A : refusée", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: url({ academicYearId: yearB, classId: classA, periodIds: [periodB1] }) });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Année scolaire introuvable" });
        expect(leaksB(res.body)).toBe(false);
    });

    it("période inexistante : même réponse (404)", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: url({ academicYearId: A.yearId, classId: classA, periodIds: ["periode-inexistante"] }) });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Période introuvable" });
    });

    it("classe de B pour un compte limité à A : refusée (403), rien de B", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: url({ academicYearId: yearB, classId: classB, periodIds: [periodB1] }) });
        expect(res.status).toBe(403);
        expect(leaksB(res.body)).toBe(false);
    });

    it("compte rattaché à A et B : la classe et les périodes de B restent accessibles", async () => {
        actAs(multiSchoolAdmin(schoolB));
        const res = await callRoute(GET, { path: url({ academicYearId: yearB, classId: classB, periodIds: [periodB1, periodB2] }) });
        const rows = res.body as Row[];
        expect(res.status).toBe(200);
        expect(rows.map((r) => r.periodName)).toEqual(B_NAMES);
    });

    it("sans année : année courante de l'école de la classe (comportement inchangé)", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: url({ classId: classA, periodIds: [A.t1Id] }) });
        expect(res.status).toBe(200);
        expect((res.body as Row[])[0].periodName).toBe("T1");
    });
});
