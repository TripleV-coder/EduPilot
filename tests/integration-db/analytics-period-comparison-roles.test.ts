import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { GET } from "@/app/api/analytics/period-comparison/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { seedAnalyticsSchool, type AnalyticsSchoolFixture } from "./fixtures/analytics-school";

/**
 * Audit du 2026-10-16 — `GET /api/analytics/period-comparison` n'exigeait aucun
 * rôle ni permission : tout compte connecté (parent, élève) obtenait moyennes,
 * taux de réussite et répartitions de toute classe de son école.
 *
 * Politique (mécanismes existants) : permission ANALYTICS_VIEW (direction,
 * réseau, plateforme, enseignants) ; un enseignant n'accède qu'à ses classes
 * (matière ou professeur principal, `taughtClassIds`) ; l'école de la classe
 * reste contrôlée par `canAccessSchool`.
 */
let A: AnalyticsSchoolFixture;
let classA: string;
let classB: string;
let parentUser: string;
let studentUser: string;
let staffUser: string;
let networkUser: string;
let schoolC: string;
let classC: string;
let yearC: string;
let periodC: string;

type Row = { periodId: string; periodName: string; averageGrade: number; studentCount: number };
const as = (role: UserRole, school: string, userId: string, accessible: string[] = [school]): Session => {
    const base = sessionFor(role, school, userId);
    return { ...base, user: { ...base.user, accessibleSchoolIds: accessible } };
};
const query = (classId: string, year: string, periods: string[]) => {
    const q = new URLSearchParams({ academicYearId: year, classId });
    for (const p of periods) q.append("periodIds", p);
    return `/api/analytics/period-comparison?${q}`;
};
const classAStats = () => query(classA, A.yearId, [A.t1Id, A.t2Id]);
/** Un refus ne contient aucune statistique ni nom de période. */
const noStats = (body: unknown) => !/averageGrade|passRate|periodName|studentCount/.test(JSON.stringify(body));

beforeAll(async () => {
    A = await seedAnalyticsSchool();
    classA = (await prisma.class.findFirstOrThrow({ where: { schoolId: A.schoolId, name: "A" }, select: { id: true } })).id;
    classB = (await prisma.class.findFirstOrThrow({ where: { schoolId: A.schoolId, name: "B" }, select: { id: true } })).id;
    const mk = (role: UserRole, schoolId: string | null) =>
        prisma.user.create({ data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "Roles", role, schoolId } });

    const s1 = await prisma.studentProfile.findUniqueOrThrow({ where: { id: A.students.s1 }, select: { userId: true } });
    studentUser = s1.userId;
    const parent = await mk("PARENT", A.schoolId);
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parent.id } });
    await prisma.parentStudent.create({ data: { parentId: parentProfile.id, studentId: A.students.s1, relationship: "PARENT" } });
    parentUser = parent.id;
    staffUser = (await mk("STAFF", A.schoolId)).id;

    // Réseau contenant l'école A ; école C hors réseau
    const org = await prisma.organization.create({ data: { name: uniqueCode("Réseau"), code: uniqueCode("ORG") } });
    await prisma.school.update({ where: { id: A.schoolId }, data: { organizationId: org.id } });
    const network = await mk("NETWORK_ADMIN", A.schoolId);
    await prisma.organizationMembership.create({ data: { organizationId: org.id, userId: network.id } });
    networkUser = network.id;

    schoolC = (await createSchool("PCR-C")).id;
    const level = await prisma.classLevel.create({ data: { schoolId: schoolC, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
    classC = (await prisma.class.create({ data: { schoolId: schoolC, classLevelId: level.id, name: "Classe-C" } })).id;
    yearC = (await prisma.academicYear.create({ data: { schoolId: schoolC, name: uniqueCode("ANNEE-C"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true } })).id;
    periodC = (await prisma.period.create({ data: { academicYearId: yearC, name: "PERIODE-C-ROLES", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } })).id;
});

describe("period-comparison — qui peut consulter les statistiques d'une classe", () => {
    it("parent (enfant dans la classe) : refusé, aucune statistique", async () => {
        actAs(as("PARENT", A.schoolId, parentUser));
        const res = await callRoute(GET, { path: classAStats() });
        expect(res.status).toBe(403);
        expect(noStats(res.body)).toBe(true);
    });

    it("élève de la classe : refusé, aucune statistique", async () => {
        actAs(as("STUDENT", A.schoolId, studentUser));
        const res = await callRoute(GET, { path: classAStats() });
        expect(res.status).toBe(403);
        expect(noStats(res.body)).toBe(true);
    });

    it("personnel (vie scolaire) : refusé (pas de permission d'analyse)", async () => {
        actAs(as("STAFF", A.schoolId, staffUser));
        const res = await callRoute(GET, { path: classAStats() });
        expect(res.status).toBe(403);
        expect(noStats(res.body)).toBe(true);
    });

    it("enseignant de la classe : statistiques de sa classe", async () => {
        actAs(as("TEACHER", A.schoolId, A.teacherUserId));
        const res = await callRoute(GET, { path: classAStats() });
        const rows = res.body as Row[];
        expect(res.status).toBe(200);
        expect(rows.map((r) => r.periodName)).toEqual(["T1", "T2"]);
        expect(rows.some((r) => r.studentCount > 0)).toBe(true);
    });

    it("enseignant d'une autre classe de la même école : refusé", async () => {
        actAs(as("TEACHER", A.schoolId, A.teacherUserId));
        const res = await callRoute(GET, { path: query(classB, A.yearId, [A.t1Id]) });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Accès refusé à cette classe" });
    });

    it("direction : statistiques de toute classe de son école", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const a = await callRoute(GET, { path: classAStats() });
        const b = await callRoute(GET, { path: query(classB, A.yearId, [A.t1Id]) });
        expect(a.status).toBe(200);
        expect((a.body as Row[]).map((r) => r.periodName)).toEqual(["T1", "T2"]);
        expect(b.status).toBe(200);
    });

    it("direction : classe d'une école étrangère refusée, rien de C", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: query(classC, yearC, [periodC]) });
        expect(res.status).toBe(403);
        expect(JSON.stringify(res.body)).not.toContain("PERIODE-C-ROLES");
    });

    it("responsable de réseau : école du réseau autorisée, école hors réseau refusée", async () => {
        actAs(as("NETWORK_ADMIN", A.schoolId, networkUser, [A.schoolId]));
        const inside = await callRoute(GET, { path: classAStats() });
        expect(inside.status).toBe(200);
        expect((inside.body as Row[]).length).toBe(2);
        const outside = await callRoute(GET, { path: query(classC, yearC, [periodC]) });
        expect(outside.status).toBe(403);
        expect(JSON.stringify(outside.body)).not.toContain("PERIODE-C-ROLES");
    });

    it("identifiants inexistants : classe 404, période 404", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const noClass = await callRoute(GET, { path: query("classe-inexistante", A.yearId, [A.t1Id]) });
        expect(noClass.status).toBe(404);
        expect(noClass.body).toEqual({ error: "Classe introuvable" });
        const noPeriod = await callRoute(GET, { path: query(classA, A.yearId, ["periode-inexistante"]) });
        expect(noPeriod.status).toBe(404);
        expect(noPeriod.body).toEqual({ error: "Période introuvable" });
    });
});
