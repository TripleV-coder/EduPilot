import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/scholarships/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 (minimisation) — `GET /api/scholarships` : chaque bourse embarquait le
 * profil élève COMPLET (toutes ses colonnes) et ses inscriptions avec la
 * classe et le niveau entiers. La page n'affiche que le nom, le matricule et
 * la classe active : seuls ces champs doivent sortir.
 *
 * La liste reste complète (non paginée) : la page calcule ses indicateurs
 * (boursiers actifs, budget, répartition par type) sur l'ensemble.
 */
let schoolId: string;
let adminId: string;
let studentUserId: string;
let ownScholarshipId: string;

beforeAll(async () => {
  const school = await createSchool("IT-SCH");
  schoolId = school.id;
  const user = (first: string, role: "SCHOOL_ADMIN" | "STUDENT", school = schoolId) =>
    prisma.user.create({
      data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId: school },
    });
  adminId = (await user("admin", "SCHOOL_ADMIN")).id;

  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const level = await prisma.classLevel.create({ data: { schoolId, name: "CP", code: uniqueCode("CP"), level: "PRIMARY", sequence: 1 } });
  const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "A" } });

  const studentUser = await user("s1", "STUDENT");
  studentUserId = studentUser.id;
  const student = await prisma.studentProfile.create({ data: { userId: studentUser.id, matricule: uniqueCode("MAT"), schoolId } });
  await prisma.enrollment.create({ data: { studentId: student.id, classId: klass.id, academicYearId: year.id } });
  ownScholarshipId = (
    await prisma.scholarship.create({
      data: { studentId: student.id, name: "Bourse d'excellence", type: "MERIT", amount: 50000, startDate: new Date("2025-10-01") },
    })
  ).id;

  const other = await createSchool("IT-SCH-OTHER");
  const otherUser = await user("x1", "STUDENT", other.id);
  const otherStudent = await prisma.studentProfile.create({ data: { userId: otherUser.id, matricule: uniqueCode("MAT"), schoolId: other.id } });
  await prisma.scholarship.create({
    data: { studentId: otherStudent.id, name: "Autre école", type: "NEED_BASED", amount: 10000, startDate: new Date("2025-10-01") },
  });
});

describe("C3 — liste des bourses (minimisation)", () => {
  it("administrateur : bourses de son école, élève réduit aux champs affichés", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: "/api/scholarships" });

    expect(res.status).toBe(200);
    const list = res.body as Array<Record<string, unknown>>;
    expect(list.map((scholarship) => scholarship.id)).toEqual([ownScholarshipId]);
    expect(list[0]).toMatchObject({ name: "Bourse d'excellence", type: "MERIT", isActive: true, percentage: null, notes: null });
    expect(Number(list[0].amount)).toBe(50000);

    const student = list[0].student as Record<string, unknown>;
    expect(Object.keys(student).sort()).toEqual(["enrollments", "id", "matricule", "user"]);
    expect(student.user).toEqual({ id: studentUserId, firstName: "s1", lastName: "Test" });
    expect(student.enrollments).toEqual([{ class: { name: "A" } }]);
  });
});
