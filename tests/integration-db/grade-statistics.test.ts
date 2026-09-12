import { beforeAll, describe, expect, it } from "vitest";
import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/grades/statistics/route";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 / N10 — `GET /api/grades/statistics` contre une vraie base.
 *
 * Avant : toutes les notes de l'école chargées en mémoire avec leurs relations
 * (131 000 sur la base de l'audit → dépassement de délai à 20 s), puis
 * rechargées pour la tendance et le classement. Et aucun périmètre : un parent
 * obtenait les statistiques de toute l'école et, avec type=class, le
 * classement NOMINATIF de la classe (moyenne de chaque élève).
 *
 * Valeurs attendues calculées à la main à partir du jeu ci-dessous
 * (notes normalisées sur 20 ; absences, dispenses, notes vides et notes
 * supprimées exclues).
 */
type Stats = {
  statistics: {
    totalGrades: number;
    average: number;
    highest: number;
    lowest: number;
    passRate: number;
    gradeDistribution: { excellent: number; good: number; average: number; poor: number };
    bySubject: Record<string, { average: number; count: number }>;
    byType: Record<string, { average: number; count: number }>;
  };
  trend: "up" | "down" | "stable" | null;
  ranking: null | {
    totalStudents: number;
    rank: number | null;
    topStudent: { studentId: string; studentName: string } | null;
    bottomStudent: { studentId: string } | null;
    students?: Array<{ studentId: string; studentName: string; average: number; gradeCount: number }>;
  };
};

let schoolId: string;
let adminId: string;
let teacherUserId: string;
let otherTeacherUserId: string;
let parentUserId: string;
let classId: string;
let p1: string;
let p2: string;
const students: Record<"s1" | "s2" | "s3", { profileId: string; userId: string }> = {} as never;

async function user(role: UserRole, firstName: string) {
  return prisma.user.create({
    data: { email: `${uniqueCode(firstName)}@integration.test`, password: "non-utilise", firstName, lastName: "Test", role, schoolId },
  });
}

beforeAll(async () => {
  schoolId = (await createSchool("IT-C3-STATS")).id;
  adminId = (await user("SCHOOL_ADMIN", "admin")).id;

  const year = await prisma.academicYear.create({
    data: { schoolId, name: uniqueCode("2026"), startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  p1 = (await prisma.period.create({ data: { academicYearId: year.id, name: "T1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } })).id;
  p2 = (await prisma.period.create({ data: { academicYearId: year.id, name: "T2", type: "TRIMESTER", startDate: new Date("2026-01-05"), endDate: new Date("2026-03-31"), sequence: 2 } })).id;
  const level = await prisma.classLevel.create({ data: { schoolId, name: "5e", code: uniqueCode("5E"), level: "SECONDARY_COLLEGE", sequence: 2 } });
  classId = (await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "5e A" } })).id;
  const math = await prisma.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("M") } });
  const french = await prisma.subject.create({ data: { schoolId, name: "Français", code: uniqueCode("F") } });

  const teacherUser = await user("TEACHER", "prof");
  teacherUserId = teacherUser.id;
  const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });
  otherTeacherUserId = (await user("TEACHER", "autreprof")).id;
  await prisma.teacherProfile.create({ data: { userId: otherTeacherUserId, schoolId } });

  const csMath = await prisma.classSubject.create({ data: { classId, subjectId: math.id, teacherId: teacher.id } });
  const csFr = await prisma.classSubject.create({ data: { classId, subjectId: french.id } });
  const devoir = await prisma.evaluationType.create({ data: { schoolId, name: "Devoir", code: uniqueCode("DEV") } });
  const compo = await prisma.evaluationType.create({ data: { schoolId, name: "Composition", code: uniqueCode("COMP") } });

  for (const key of ["s1", "s2", "s3"] as const) {
    const u = await user("STUDENT", key);
    const profile = await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode(key), schoolId } });
    await prisma.enrollment.create({ data: { studentId: profile.id, classId, academicYearId: year.id } });
    students[key] = { profileId: profile.id, userId: u.id };
  }
  const parentUser = await user("PARENT", "parent");
  parentUserId = parentUser.id;
  const parent = await prisma.parentProfile.create({ data: { userId: parentUser.id } });
  await prisma.parentStudent.create({ data: { parentId: parent.id, studentId: students.s1.profileId, relationship: "MERE" } });

  const evaluation = (classSubjectId: string, typeId: string, periodId: string, maxGrade: number, title: string) =>
    prisma.evaluation.create({ data: { classSubjectId, typeId, periodId, maxGrade, title, date: new Date("2026-02-10") } });
  const grade = (evaluationId: string, key: "s1" | "s2" | "s3", value: number | null, extra: Record<string, unknown> = {}) =>
    prisma.grade.create({ data: { evaluationId, studentId: students[key].profileId, value, ...extra } });

  // Période 2 (courante)
  const m1 = await evaluation(csMath.id, devoir.id, p2, 20, "M1");
  await grade(m1.id, "s1", 18);
  await grade(m1.id, "s2", 14);
  await grade(m1.id, "s3", 4);
  const m2 = await evaluation(csMath.id, compo.id, p2, 50, "M2");
  await grade(m2.id, "s1", 40); // 16/20
  await grade(m2.id, "s2", null, { isAbsent: true }); // exclue
  await grade(m2.id, "s3", 25); // 10/20
  const f1 = await evaluation(csFr.id, devoir.id, p2, 20, "F1");
  await grade(f1.id, "s1", 12);
  await grade(f1.id, "s2", null); // pas de note : exclue
  await grade(f1.id, "s3", 8, { isExcused: true }); // dispensé : exclue
  const f2 = await evaluation(csFr.id, devoir.id, p2, 20, "F2");
  await grade(f2.id, "s2", 20, { deletedAt: new Date() }); // supprimée : exclue

  // Période 1 : moyenne 8 → tendance « up » en période 2
  const m0 = await evaluation(csMath.id, devoir.id, p1, 20, "M0");
  for (const key of ["s1", "s2", "s3"] as const) await grade(m0.id, key, 8);
});

async function stats(query: string): Promise<{ status: number; body: Stats }> {
  const res = await callRoute(GET, { path: `/api/grades/statistics?${query}` });
  return { status: res.status, body: res.body as Stats };
}

describe("C3 — statistiques agrégées en base", () => {
  it("calcule les agrégats de l'école sur la période (valeurs attendues à la main)", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const { status, body } = await stats(`periodId=${p2}`);

    expect(status).toBe(200);
    // Notes retenues (sur 20) : 18, 16, 12, 14, 4, 10
    expect(body.statistics).toMatchObject({
      totalGrades: 6,
      average: 12.33,
      highest: 18,
      lowest: 4,
      passRate: 83.33,
      gradeDistribution: { excellent: 2, good: 1, average: 2, poor: 1 },
    });
    expect(body.statistics.bySubject).toEqual({
      Mathématiques: { average: 12.4, count: 5 },
      Français: { average: 12, count: 1 },
    });
    expect(body.statistics.byType).toEqual({
      Devoir: { average: 12, count: 4 },
      Composition: { average: 13, count: 2 },
    });
    expect(body.trend).toBe("up");
  });

  it("classe la classe pour l'administration, avec les noms", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const { body } = await stats(`type=class&classId=${classId}&periodId=${p2}&studentId=${students.s3.profileId}`);

    expect(body.ranking?.totalStudents).toBe(3);
    expect(body.ranking?.rank).toBe(3);
    expect(body.ranking?.students?.map((s) => [s.studentId, s.average, s.gradeCount])).toEqual([
      [students.s1.profileId, 15.33, 3],
      [students.s2.profileId, 14, 1],
      [students.s3.profileId, 7, 2],
    ]);
    expect(body.ranking?.topStudent?.studentName).toBe("s1 Test");
  });

  it("montre le classement nominatif à l'enseignant de la classe", async () => {
    actAs(sessionFor("TEACHER", schoolId, teacherUserId));
    const { body } = await stats(`type=class&classId=${classId}&periodId=${p2}`);

    expect(body.ranking?.students).toHaveLength(3);
  });
});

describe("N10 — périmètre des statistiques", () => {
  it("ne montre pas le classement nominatif à un enseignant d'une autre classe", async () => {
    actAs(sessionFor("TEACHER", schoolId, otherTeacherUserId));
    const { body } = await stats(`type=class&classId=${classId}&periodId=${p2}`);

    expect(body.ranking?.students).toBeUndefined();
    expect(body.ranking?.topStudent).toBeNull();
  });

  it("limite un parent aux notes de son enfant", async () => {
    actAs(sessionFor("PARENT", schoolId, parentUserId));
    const { status, body } = await stats(`periodId=${p2}`);

    expect(status).toBe(200);
    expect(body.statistics.totalGrades).toBe(3); // 18, 16, 12
    expect(body.statistics.average).toBe(15.33);
  });

  it("donne au parent le rang de son enfant sans aucun nom d'autre élève", async () => {
    actAs(sessionFor("PARENT", schoolId, parentUserId));
    const { body } = await stats(`type=class&classId=${classId}&periodId=${p2}&studentId=${students.s1.profileId}`);

    expect(body.ranking).toEqual({ totalStudents: 3, rank: 1, topStudent: null, bottomStudent: null });
  });

  it("refuse à un parent les statistiques d'un enfant qui n'est pas le sien (403)", async () => {
    actAs(sessionFor("PARENT", schoolId, parentUserId));
    const { status } = await stats(`studentId=${students.s2.profileId}`);

    expect(status).toBe(403);
  });

  it("limite un élève à ses propres notes", async () => {
    actAs(sessionFor("STUDENT", schoolId, students.s3.userId));
    const { body } = await stats(`periodId=${p2}`);

    expect(body.statistics.totalGrades).toBe(2); // 4, 10
    expect(body.statistics.average).toBe(7);
  });
});
