import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { GET } from "@/app/api/analytics/class-comparison/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { seedAnalyticsSchool, type AnalyticsSchoolFixture } from "./fixtures/analytics-school";

/**
 * Audit du 2026-10-16 — `GET /api/analytics/class-comparison` n'exigeait aucun
 * rôle ni permission : tout compte connecté de l'école (parent, élève,
 * personnel, comptable) obtenait effectifs, moyennes, taux de réussite et
 * répartition des risques de n'importe quelle classe de son école.
 *
 * Politique alignée sur `period-comparison` (mêmes données, même besoin) :
 * permission ANALYTICS_VIEW ; un enseignant doit être autorisé sur CHACUNE des
 * classes comparées (`taughtClassIds`) ; chaque classe reste contrôlée par
 * `canAccessSchool`. Un refus ne renvoie aucune donnée, même des classes
 * autorisées de la demande.
 */
let A: AnalyticsSchoolFixture;
let classA: string;
let classB: string;
let parentUser: string;
let studentUser: string;
let staffUser: string;
let accountantUser: string;
let bothTeacherUser: string;
let networkUser: string;
let classC: string;

type Row = { classId: string; className: string; studentCount: number; averageGrade: number; passRate: number };
const as = (role: UserRole, school: string, userId: string, accessible: string[] = [school]): Session => {
    const base = sessionFor(role, school, userId);
    return { ...base, user: { ...base.user, accessibleSchoolIds: accessible } };
};
const query = (classIds: string[], year = A.yearId) => {
    const q = new URLSearchParams({ academicYearId: year });
    for (const id of classIds) q.append("classIds", id);
    return `/api/analytics/class-comparison?${q}`;
};
/** Un refus ne contient aucune statistique ni nom de classe ou d'école. */
const noStats = (body: unknown) =>
    !/averageGrade|passRate|studentCount|riskDistribution|className|schoolName|Classe-C/.test(JSON.stringify(body));

beforeAll(async () => {
    A = await seedAnalyticsSchool();
    classA = (await prisma.class.findFirstOrThrow({ where: { schoolId: A.schoolId, name: "A" }, select: { id: true } })).id;
    classB = (await prisma.class.findFirstOrThrow({ where: { schoolId: A.schoolId, name: "B" }, select: { id: true } })).id;
    const mk = (role: UserRole, schoolId: string | null) =>
        prisma.user.create({ data: { email: `${uniqueCode(role.toLowerCase())}@integration.test`, password: "x", firstName: role, lastName: "Comparaison", role, schoolId } });

    studentUser = (await prisma.studentProfile.findUniqueOrThrow({ where: { id: A.students.s1 }, select: { userId: true } })).userId;
    const parent = await mk("PARENT", A.schoolId);
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parent.id } });
    await prisma.parentStudent.create({ data: { parentId: parentProfile.id, studentId: A.students.s1, relationship: "PARENT" } });
    parentUser = parent.id;
    staffUser = (await mk("STAFF", A.schoolId)).id;
    accountantUser = (await mk("ACCOUNTANT", A.schoolId)).id;

    // Enseignant autorisé sur les deux classes : matière en A, professeur principal de B
    const both = await mk("TEACHER", A.schoolId);
    const bothProfile = await prisma.teacherProfile.create({ data: { userId: both.id, schoolId: A.schoolId } });
    const subject = await prisma.subject.create({ data: { schoolId: A.schoolId, name: "SVT", code: uniqueCode("SVT") } });
    await prisma.classSubject.create({ data: { classId: classA, subjectId: subject.id, teacherId: bothProfile.id } });
    await prisma.class.update({ where: { id: classB }, data: { mainTeacherId: bothProfile.id } });
    bothTeacherUser = both.id;

    // Réseau contenant l'école A ; école C hors réseau, avec un élève inscrit et analysé
    const org = await prisma.organization.create({ data: { name: uniqueCode("Réseau"), code: uniqueCode("ORG") } });
    await prisma.school.update({ where: { id: A.schoolId }, data: { organizationId: org.id } });
    const network = await mk("NETWORK_ADMIN", A.schoolId);
    await prisma.organizationMembership.create({ data: { organizationId: org.id, userId: network.id } });
    networkUser = network.id;

    const schoolC = (await createSchool("CCR-C")).id;
    const level = await prisma.classLevel.create({ data: { schoolId: schoolC, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
    classC = (await prisma.class.create({ data: { schoolId: schoolC, classLevelId: level.id, name: "Classe-C" } })).id;
    const yearC = await prisma.academicYear.create({ data: { schoolId: schoolC, name: uniqueCode("ANNEE-C"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true } });
    const periodC = await prisma.period.create({ data: { academicYearId: yearC.id, name: "T1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } });
    const u = await prisma.user.create({ data: { email: `${uniqueCode("elevec")}@integration.test`, password: "x", firstName: "Eleve", lastName: "C", role: "STUDENT", schoolId: schoolC } });
    const studentC = await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode("C"), schoolId: schoolC } });
    await prisma.enrollment.create({ data: { studentId: studentC.id, classId: classC, academicYearId: yearC.id } });
    await prisma.studentAnalytics.create({ data: { studentId: studentC.id, periodId: periodC.id, academicYearId: yearC.id, generalAverage: 19, riskLevel: "NONE" } });
});

describe("class-comparison — qui peut comparer les statistiques de classes", () => {
    it("parent (enfant dans la classe) : refusé, aucune statistique", async () => {
        actAs(as("PARENT", A.schoolId, parentUser));
        const res = await callRoute(GET, { path: query([classA, classB]) });
        expect(res.status).toBe(403);
        expect(noStats(res.body)).toBe(true);
    });

    it("élève de la classe : refusé, aucune statistique", async () => {
        actAs(as("STUDENT", A.schoolId, studentUser));
        const res = await callRoute(GET, { path: query([classA]) });
        expect(res.status).toBe(403);
        expect(noStats(res.body)).toBe(true);
    });

    it("personnel et comptable : refusés (pas de permission d'analyse)", async () => {
        for (const [role, id] of [["STAFF", staffUser], ["ACCOUNTANT", accountantUser]] as const) {
            actAs(as(role, A.schoolId, id));
            const res = await callRoute(GET, { path: query([classA, classB]) });
            expect(res.status, role).toBe(403);
            expect(noStats(res.body), role).toBe(true);
        }
    });

    it("enseignant autorisé sur toutes les classes comparées : statistiques réelles", async () => {
        actAs(as("TEACHER", A.schoolId, bothTeacherUser));
        const res = await callRoute(GET, { path: query([classA, classB]) });
        expect(res.status).toBe(200);
        const rows = res.body as Row[];
        const byName = Object.fromEntries(rows.map((r) => [r.className, r]));
        expect(byName.A).toMatchObject({ classId: classA, studentCount: 4, averageGrade: 10.75 });
        expect(byName.B).toMatchObject({ classId: classB, studentCount: 2, averageGrade: 12 });
    });

    it("enseignant de sa seule classe : comparaison limitée à elle", async () => {
        actAs(as("TEACHER", A.schoolId, A.teacherUserId));
        const res = await callRoute(GET, { path: query([classA]) });
        expect(res.status).toBe(200);
        expect((res.body as Row[]).map((r) => r.classId)).toEqual([classA]);
    });

    it("enseignant non autorisé sur l'une des classes : refusé, rien de l'autre non plus", async () => {
        actAs(as("TEACHER", A.schoolId, A.teacherUserId));
        const res = await callRoute(GET, { path: query([classA, classB]) });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Accès refusé à une ou plusieurs classes demandées" });
        const alone = await callRoute(GET, { path: query([classB]) });
        expect(alone.status).toBe(403);
        expect(noStats(alone.body)).toBe(true);
    });

    it("direction : deux classes de son école comparées", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: query([classA, classB]) });
        expect(res.status).toBe(200);
        expect((res.body as Row[]).map((r) => r.className).sort()).toEqual(["A", "B"]);
    });

    it("direction : classe étrangère mêlée à la sienne refusée, rien renvoyé", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: query([classA, classC]) });
        expect(res.status).toBe(403);
        expect(noStats(res.body)).toBe(true);
    });

    it("responsable de réseau : école du réseau autorisée, école hors réseau refusée", async () => {
        actAs(as("NETWORK_ADMIN", A.schoolId, networkUser, [A.schoolId]));
        const inside = await callRoute(GET, { path: query([classA, classB]) });
        expect(inside.status).toBe(200);
        expect((inside.body as Row[]).length).toBe(2);
        const outside = await callRoute(GET, { path: query([classA, classC]) });
        expect(outside.status).toBe(403);
        expect(noStats(outside.body)).toBe(true);
    });

    it("identifiants inexistants : 404 sans statistique", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(GET, { path: query([classA, "classe-inexistante"]) });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Une ou plusieurs classes sont introuvables" });
    });

    it("année d'une autre école : aucune donnée de cette école ne remonte", async () => {
        actAs(as("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const yearC = (await prisma.enrollment.findFirstOrThrow({ where: { classId: classC }, select: { academicYearId: true } })).academicYearId;
        const res = await callRoute(GET, { path: query([classA], yearC) });
        const rows = res.body as Row[];
        expect(res.status).toBe(200);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ classId: classA, studentCount: 0, averageGrade: 0 });
        expect(JSON.stringify(res.body)).not.toContain("Classe-C");
    });
});
