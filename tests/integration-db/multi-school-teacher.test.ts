import { beforeAll, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import prisma from "./owner-db";
import { actAs, callRoute, sessionFor } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { authConfig } from "@/lib/auth/config";
import { ALL_MODULE_IDS } from "@/lib/modules/catalog";
import { detachTeacherFromSchool } from "@/lib/teachers/school-membership";
import { GET as listClasses } from "@/app/api/classes/route";
import { GET as getClass } from "@/app/api/classes/[id]/route";
import { GET as listGrades } from "@/app/api/grades/route";
import { PATCH as patchGrade } from "@/app/api/grades/[id]/route";
import { GET as listStudents } from "@/app/api/students/route";
import { GET as biBoard } from "@/app/api/analytics/bi/route";

/**
 * Audit multi-écoles du 2026-10-15 — parcours d'un enseignant de deux écoles.
 *
 * Trois écoles aux valeurs immédiatement reconnaissables :
 *   A « ALPHA » (note 11), B « BRAVO » (note 17), C « CHARLIE » (note 3).
 * L'enseignant enseigne en A et en B, n'a aucun droit en C. Chaque test
 * vérifie le CONTENU renvoyé et l'état réel de la base, pas seulement le statut.
 *
 * Les anomalies du rapport docs/audit-2026-10-15/07-multi-ecoles-et-cache.md
 * étaient décrites par des tests `it.fails` ; toutes sont désormais corrigées
 * et ces témoins sont devenus des tests de régression (MS-02 : 2026-10-18).
 */
let A: TenantGraph;
let B: TenantGraph;
let C: TenantGraph;
let teacherUserId: string;
let colleagueClassId: string;

function teacherSession(activeSchoolId: string, accessible: string[]): Session {
    const base = sessionFor("TEACHER", activeSchoolId, teacherUserId);
    return { ...base, user: { ...base.user, primarySchoolId: A.schoolId, accessibleSchoolIds: accessible } };
}

const classNames = (body: unknown) => ((body as { data?: Array<{ name: string }> }).data ?? []).map((c) => c.name);
function gradeValues(body: unknown): number[] {
    const b = body as { data?: unknown[]; grades?: unknown[] };
    const rows = Array.isArray(body) ? body : (b.data ?? b.grades ?? []);
    return (rows as Array<{ value: unknown }>).map((g) => Number(g.value)).sort((x, y) => x - y);
}
async function gradeValue(id: string) {
    return Number((await prisma.grade.findUniqueOrThrow({ where: { id } })).value);
}
const jwt = () => authConfig.callbacks!.jwt!;
const tokenFor = (schoolId: string, accessible: string[]) =>
    ({ id: teacherUserId, role: "TEACHER", schoolId, primarySchoolId: A.schoolId, accessibleSchoolIds: accessible, iat: Math.floor(Date.now() / 1000) }) as JWT;

beforeAll(async () => {
    [A, B, C] = await Promise.all([seedTenantGraph("MS-A"), seedTenantGraph("MS-B"), seedTenantGraph("MS-C")]);
    teacherUserId = A.teacherUserId;
    // Tous les modules actifs : un 403 « module non activé » masquerait le contrôle d'accès testé
    await prisma.school.updateMany({ where: { id: { in: [A.schoolId, B.schoolId, C.schoolId] } }, data: { enabledModules: [...ALL_MODULE_IDS] } });

    await prisma.class.update({ where: { id: A.ids.class }, data: { name: "Classe-ALPHA" } });
    await prisma.class.update({ where: { id: B.ids.class }, data: { name: "Classe-BRAVO" } });
    await prisma.class.update({ where: { id: C.ids.class }, data: { name: "Classe-CHARLIE" } });
    await prisma.grade.update({ where: { id: A.ids.grade }, data: { value: 11 } });
    await prisma.grade.update({ where: { id: B.ids.grade }, data: { value: 17 } });
    await prisma.grade.update({ where: { id: C.ids.grade }, data: { value: 3 } });

    // L'enseignant de A enseigne aussi en B (rattachement actif + cours de B)
    await prisma.teacherSchoolAssignment.createMany({
        data: [
            { teacherId: A.ids.teacher, userId: teacherUserId, schoolId: A.schoolId, status: "ACTIVE", isPrimary: true },
            { teacherId: A.ids.teacher, userId: teacherUserId, schoolId: B.schoolId, status: "ACTIVE", isPrimary: false },
        ],
    });
    await prisma.classSubject.updateMany({ where: { classId: B.ids.class }, data: { teacherId: A.ids.teacher } });

    // Une seconde classe de A, SANS cet enseignant (note 8)
    const klass = await prisma.class.findUniqueOrThrow({ where: { id: A.ids.class } });
    const colleague = await prisma.class.create({ data: { schoolId: A.schoolId, classLevelId: klass.classLevelId, name: "Classe-ALPHA-COLLEGUE" } });
    colleagueClassId = colleague.id;
    const cs = await prisma.classSubject.create({ data: { classId: colleague.id, subjectId: A.ids.subject } });
    const evaluation = await prisma.evaluation.findFirstOrThrow({ where: { classSubject: { classId: A.ids.class } } });
    const ev = await prisma.evaluation.create({
        data: { classSubjectId: cs.id, periodId: A.ids.period, typeId: evaluation.typeId, date: new Date("2025-10-11T08:00:00Z") },
    });
    await prisma.grade.create({ data: { evaluationId: ev.id, studentId: A.ids.student, value: 8 } });
});

describe("A — enseignant actif dans l'école A", () => {
    it("liste des classes : A seulement", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listClasses, { path: "/api/classes" });
        expect(res.status).toBe(200);
        const names = classNames(res.body);
        expect(names).toContain("Classe-ALPHA");
        expect(names.some((n) => n.includes("BRAVO") || n.includes("CHARLIE"))).toBe(false);
    });

    it("notes de sa classe A : 11 et rien d'autre", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listGrades, { path: `/api/grades?classId=${A.ids.class}` });
        expect(res.status).toBe(200);
        expect(gradeValues(res.body)).toEqual([11]);
    });

    it("notes de sa classe B demandées depuis A : rien de B (une école à la fois)", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listGrades, { path: `/api/grades?classId=${B.ids.class}` });
        expect(gradeValues(res.body)).not.toContain(17);
    });
});

describe("B — même compte, école active B (même URL : cache par école)", () => {
    it("liste des classes : B seulement, jamais la réponse de A restée en cache", async () => {
        actAs(teacherSession(B.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listClasses, { path: "/api/classes" });
        const names = classNames(res.body);
        expect(names).toContain("Classe-BRAVO");
        expect(names.some((n) => n.includes("ALPHA"))).toBe(false);
    });

    it("notes de la classe B : 17", async () => {
        actAs(teacherSession(B.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listGrades, { path: `/api/grades?classId=${B.ids.class}` });
        expect(gradeValues(res.body)).toEqual([17]);
    });

    it("modifier une note de A depuis le contexte B : refusé, note intacte", async () => {
        actAs(teacherSession(B.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(patchGrade, { method: "PATCH", path: `/api/grades/${A.ids.grade}`, params: { id: A.ids.grade }, body: { value: 19 } });
        expect([403, 404]).toContain(res.status);
        expect(await gradeValue(A.ids.grade)).toBe(11);
    });

    it("contrôle positif : la même modification depuis A est acceptée", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(patchGrade, { method: "PATCH", path: `/api/grades/${A.ids.grade}`, params: { id: A.ids.grade }, body: { value: 13 } });
        expect(res.status).toBe(200);
        expect(await gradeValue(A.ids.grade)).toBe(13);
        await prisma.grade.update({ where: { id: A.ids.grade }, data: { value: 11 } });
    });
});

describe("C — école sans aucun droit", () => {
    it("?schoolId=C : refusé, aucune classe de C", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listClasses, { path: `/api/classes?schoolId=${C.schoolId}` });
        expect(res.status).toBe(403);
        expect(JSON.stringify(res.body)).not.toContain("CHARLIE");
    });

    it("classe de C par identifiant direct : refusée", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(getClass, { path: `/api/classes/${C.ids.class}`, params: { id: C.ids.class } });
        expect([403, 404]).toContain(res.status);
        expect(JSON.stringify(res.body)).not.toContain("CHARLIE");
    });

    it("notes et élèves de C : rien", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const grades = await callRoute(listGrades, { path: `/api/grades?classId=${C.ids.class}` });
        expect(gradeValues(grades.body)).not.toContain(3);
        const students = await callRoute(listStudents, { path: `/api/students?classId=${C.ids.class}` });
        expect(JSON.stringify(students.body)).not.toContain(C.ids.student);
    });

    it("modifier une note de C : refusé, note intacte", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(patchGrade, { method: "PATCH", path: `/api/grades/${C.ids.grade}`, params: { id: C.ids.grade }, body: { value: 20 } });
        expect([403, 404]).toContain(res.status);
        expect(await gradeValue(C.ids.grade)).toBe(3);
    });
});

describe("Changement d'école — callback de session réel (jwt, trigger update)", () => {
    it("vers B (autorisée) : acceptée, liste recalculée en base", async () => {
        const next = (await jwt()({ token: tokenFor(A.schoolId, [A.schoolId]), trigger: "update", session: { schoolId: B.schoolId } } as never)) as JWT;
        expect(next.schoolId).toBe(B.schoolId);
        expect(next.accessibleSchoolIds).toEqual(expect.arrayContaining([A.schoolId, B.schoolId]));
    });

    it("vers C (aucun droit) : ignorée même si le client la demande", async () => {
        const next = (await jwt()({ token: tokenFor(A.schoolId, [A.schoolId, B.schoolId]), trigger: "update", session: { schoolId: C.schoolId } } as never)) as JWT;
        expect(next.schoolId).not.toBe(C.schoolId);
        expect(next.accessibleSchoolIds).not.toContain(C.schoolId);
    });
});

// MS-02 (corrigé le 2026-10-18, commit 5649c7f) : ancien témoin it.fails,
// devenu test de régression
describe("Lecture des notes dans sa propre école", () => {
    it("classe qu'il n'enseigne pas (même école) : 403, ni la note 8 ni le nom de la classe", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listGrades, { path: `/api/grades?classId=${colleagueClassId}` });
        expect(res.status).toBe(403);
        expect(gradeValues(res.body)).not.toContain(8);
        expect(JSON.stringify(res.body)).not.toContain("Classe-ALPHA-COLLEGUE");
        // Rien n'a été modifié : la note existe toujours
        expect(await prisma.grade.count({ where: { value: 8, studentId: A.ids.student } })).toBe(1);
    });

    it("par l'élève de sa classe : seules les notes de ses classes (11), jamais celle de la classe voisine (8)", async () => {
        actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
        const res = await callRoute(listGrades, { path: `/api/grades?studentId=${A.ids.student}` });
        expect(res.status).toBe(200);
        expect(gradeValues(res.body)).toContain(11);
        expect(gradeValues(res.body)).not.toContain(8);
    });

    it("professeur principal de la classe voisine : ses notes deviennent lisibles (règle des classes enseignées)", async () => {
        await prisma.class.update({ where: { id: colleagueClassId }, data: { mainTeacherId: A.ids.teacher } });
        try {
            actAs(teacherSession(A.schoolId, [A.schoolId, B.schoolId]));
            const res = await callRoute(listGrades, { path: `/api/grades?classId=${colleagueClassId}` });
            expect(res.status).toBe(200);
            expect(gradeValues(res.body)).toEqual([8]);
        } finally {
            await prisma.class.update({ where: { id: colleagueClassId }, data: { mainTeacherId: null } });
        }
    });
});

describe("Garde central ?schoolId (createApiHandler) — route d'analyse BI", () => {
    it("?schoolId=C : refusé par le garde central, aucun indicateur de C", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", A.schoolId, A.adminId));
        const res = await callRoute(biBoard, { path: `/api/analytics/bi?schoolId=${C.schoolId}` });
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Violation d'isolation : accès inter-tenant interdit." });
    });

    it("contrôle positif : l'administration de C lit ses propres indicateurs", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", C.schoolId, C.adminId));
        const own = await callRoute(biBoard, { path: "/api/analytics/bi" });
        expect(own.status).toBe(200);
        expect((own.body as { kpis: { studentCount: number } }).kpis.studentCount).toBeGreaterThan(0);
    });
});

describe("Révocation d'un rattachement pendant une session active", () => {
    it("le retrait de B désactive le rattachement et retire ses cours", async () => {
        const result = await detachTeacherFromSchool({ teacherId: A.ids.teacher, schoolId: B.schoolId, actorUserId: B.adminId, by: "SCHOOL" });
        expect(result).toEqual({ ok: true });
        expect(await prisma.classSubject.count({ where: { teacherId: A.ids.teacher, class: { schoolId: B.schoolId } } })).toBe(0);
    });

    it("un nouveau changement d'école recalcule la liste : B n'y est plus", async () => {
        const next = (await jwt()({ token: tokenFor(A.schoolId, [A.schoolId, B.schoolId]), trigger: "update", session: { schoolId: B.schoolId } } as never)) as JWT;
        expect(next.schoolId).not.toBe(B.schoolId);
        expect(next.accessibleSchoolIds).not.toContain(B.schoolId);
    });

    // Les deux témoins de révocation (jeton conservant B, classes de B
    // lisibles) sont devenus de vrais tests : session-access-revocation.test.ts
    it("avec ce jeton périmé, les élèves de B ne sont plus lisibles (cours retirés)", async () => {
        actAs(teacherSession(B.schoolId, [A.schoolId, B.schoolId]));
        const students = await callRoute(listStudents, { path: "/api/students" });
        expect(JSON.stringify(students.body)).not.toContain(B.ids.student);
    });
});
