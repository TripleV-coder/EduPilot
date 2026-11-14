import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { GET as listGrades } from "@/app/api/grades/route";
import { GET as gradeDetail } from "@/app/api/grades/[id]/route";
import { GET as cahier } from "@/app/api/grades/cahier/route";
import { GET as statistics } from "@/app/api/grades/statistics/route";
import { GET as bulletin } from "@/app/api/bulletins/route";
import { GET as reportCard } from "@/app/api/grades/report-cards/route";

/**
 * MS-02 (2026-10-18) — les routes de notes ne vérifiaient que l'école : un
 * enseignant lisait les notes, le cahier, les statistiques et les bulletins de
 * toute classe de son école ; le détail d'une note par identifiant était
 * lisible par tout enseignant, parent ou élève de l'école. Désormais :
 * enseignant = classes où il enseigne ou dont il est professeur principal ;
 * famille = ses propres élèves.
 */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ids: Record<string, string> = {};

async function user(key: string, role: UserRole, schoolId: string) {
    const u = await prisma.user.create({ data: { email: `${uniqueCode(key)}@integration.test`, password: "x", firstName: key, lastName: "MS02", role, schoolId } });
    ids[`${key}User`] = u.id;
    return u.id;
}
const as = (key: string, role: UserRole, schoolId: string) => actAs(sessionFor(role, schoolId, ids[`${key}User`]));

beforeAll(async () => {
    const schoolId = (await createSchool("IT-MS02")).id;
    const otherSchoolId = (await createSchool("IT-MS02-X")).id;
    ids.school = schoolId; ids.otherSchool = otherSchoolId;
    const year = await prisma.academicYear.create({ data: { schoolId, name: uniqueCode("AN"), startDate: day("2025-09-01"), endDate: day("2026-07-31"), isCurrent: true } });
    const period = await prisma.period.create({ data: { academicYearId: year.id, name: "T1", type: "TRIMESTER", startDate: day("2025-09-01"), endDate: day("2025-12-20"), sequence: 1 } });
    ids.period = period.id;
    const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
    const subject = await prisma.subject.create({ data: { schoolId, name: "Maths", code: uniqueCode("M") } });
    const type = await prisma.evaluationType.create({ data: { schoolId, name: "Devoir", code: uniqueCode("DV") } });

    await user("teacher", "TEACHER", schoolId);
    await user("colleague", "TEACHER", schoolId);
    await user("foreignTeacher", "TEACHER", otherSchoolId);
    const teacher = await prisma.teacherProfile.create({ data: { userId: ids.teacherUser, schoolId } });
    const colleague = await prisma.teacherProfile.create({ data: { userId: ids.colleagueUser, schoolId } });
    await prisma.teacherProfile.create({ data: { userId: ids.foreignTeacherUser, schoolId: otherSchoolId } });

    for (const [key, teacherId, value] of [["own", teacher.id, 15], ["other", colleague.id, 8]] as const) {
        const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: uniqueCode(key) } });
        const studentUser = await user(`${key}Student`, "STUDENT", schoolId);
        const student = await prisma.studentProfile.create({ data: { userId: studentUser, schoolId, matricule: uniqueCode("MAT") } });
        await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, academicYearId: year.id } });
        const cs = await prisma.classSubject.create({ data: { classId: klass.id, subjectId: subject.id, teacherId } });
        const evaluation = await prisma.evaluation.create({ data: { classSubjectId: cs.id, periodId: period.id, typeId: type.id, date: day("2025-10-10") } });
        const grade = await prisma.grade.create({ data: { evaluationId: evaluation.id, studentId: student.id, value } });
        Object.assign(ids, { [`${key}Class`]: klass.id, [`${key}Student`]: student.id, [`${key}Grade`]: grade.id, [`${key}ClassSubject`]: cs.id });
    }
    // Parent de l'élève de la classe « own » seulement
    await user("parent", "PARENT", schoolId);
    const parentProfile = await prisma.parentProfile.create({ data: { userId: ids.parentUser } });
    await prisma.parentStudent.create({ data: { parentId: parentProfile.id, studentId: ids.ownStudent, relationship: "PARENT" } });
});

const values = (body: unknown) => JSON.stringify(body);

describe("Enseignant : sa classe lisible", () => {
    it("liste, cahier, détail, statistiques de sa classe : 200", async () => {
        as("teacher", "TEACHER", ids.school);
        expect((await callRoute(listGrades, { path: `/api/grades?classId=${ids.ownClass}` })).status).toBe(200);
        expect((await callRoute(cahier, { path: `/api/grades/cahier?classId=${ids.ownClass}` })).status).toBe(200);
        expect((await callRoute(gradeDetail, { path: `/api/grades/${ids.ownGrade}`, params: { id: ids.ownGrade } })).status).toBe(200);
        expect((await callRoute(statistics, { path: `/api/grades/statistics?classId=${ids.ownClass}&type=class` })).status).toBe(200);
    });
});

describe("Enseignant de la même école, classe non enseignée : refusé sans fuite", () => {
    it("liste (classId) : 403, aucune note 8", async () => {
        as("teacher", "TEACHER", ids.school);
        const res = await callRoute(listGrades, { path: `/api/grades?classId=${ids.otherClass}` });
        expect(res.status).toBe(403);
        expect(values(res.body)).not.toContain('"value":8');
    });

    it("liste par élève d'une autre classe : aucune note de cet élève", async () => {
        as("teacher", "TEACHER", ids.school);
        const res = await callRoute(listGrades, { path: `/api/grades?studentId=${ids.otherStudent}` });
        expect(values(res.body)).not.toContain(ids.otherGrade);
    });

    it("cahier, détail par identifiant, statistiques, bulletin, relevé : refusés", async () => {
        as("teacher", "TEACHER", ids.school);
        expect((await callRoute(cahier, { path: `/api/grades/cahier?classId=${ids.otherClass}` })).status).toBe(403);
        const detail = await callRoute(gradeDetail, { path: `/api/grades/${ids.otherGrade}`, params: { id: ids.otherGrade } });
        expect(detail.status).toBe(404);
        expect(values(detail.body)).not.toContain('"value"');
        expect((await callRoute(statistics, { path: `/api/grades/statistics?classId=${ids.otherClass}&type=class` })).status).toBe(403);
        expect((await callRoute(statistics, { path: `/api/grades/statistics?studentId=${ids.otherStudent}&type=student` })).status).toBe(403);
        expect((await callRoute(bulletin, { path: `/api/bulletins?studentId=${ids.otherStudent}&periodId=${ids.period}` })).status).toBe(403);
        expect((await callRoute(reportCard, { path: `/api/grades/report-cards?studentId=${ids.otherStudent}&periodId=${ids.period}` })).status).toBe(403);
    });

    it("statistiques sans paramètre : uniquement ses élèves (la note 8 de l'autre classe n'entre pas)", async () => {
        as("teacher", "TEACHER", ids.school);
        const res = await callRoute(statistics, { path: "/api/grades/statistics" });
        expect(res.status).toBe(200);
        expect(values(res.body)).not.toContain(ids.otherStudent);
    });
});

describe("Autres cas", () => {
    it("enseignant d'une autre école : détail refusé", async () => {
        as("foreignTeacher", "TEACHER", ids.otherSchool);
        const res = await callRoute(gradeDetail, { path: `/api/grades/${ids.ownGrade}`, params: { id: ids.ownGrade } });
        expect([403, 404]).toContain(res.status);
    });

    it("parent : note de son enfant lisible, note d'un autre élève refusée (404)", async () => {
        as("parent", "PARENT", ids.school);
        expect((await callRoute(gradeDetail, { path: `/api/grades/${ids.ownGrade}`, params: { id: ids.ownGrade } })).status).toBe(200);
        expect((await callRoute(gradeDetail, { path: `/api/grades/${ids.otherGrade}`, params: { id: ids.otherGrade } })).status).toBe(404);
    });

    it("élève : sa note lisible, celle d'un camarade refusée (404)", async () => {
        as("ownStudent", "STUDENT", ids.school);
        expect((await callRoute(gradeDetail, { path: `/api/grades/${ids.ownGrade}`, params: { id: ids.ownGrade } })).status).toBe(200);
        expect((await callRoute(gradeDetail, { path: `/api/grades/${ids.otherGrade}`, params: { id: ids.otherGrade } })).status).toBe(404);
    });

    it("affectation retirée : l'enseignant perd l'accès à cette classe", async () => {
        await prisma.classSubject.update({ where: { id: ids.ownClassSubject }, data: { teacherId: null } });
        as("teacher", "TEACHER", ids.school);
        expect((await callRoute(listGrades, { path: `/api/grades?classId=${ids.ownClass}` })).status).toBe(403);
    });
});
