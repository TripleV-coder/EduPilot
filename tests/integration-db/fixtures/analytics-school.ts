import type { PerformanceLevel, RiskLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { uniqueCode } from "../helpers";

/**
 * Jeu de données commun aux tests de caractérisation des tableaux de bord
 * analytiques (C3). Valeurs choisies pour être calculables à la main :
 *
 * École principale, année courante, périodes T1 (séquence 1) et T2 (séquence 2),
 * classes A et B, matières Mathématiques et Français, un enseignant (Maths en A).
 *
 * | élève | classe | T1 | T2   | risque T2 | niveau T2    | Maths T2 | Français T2 |
 * |-------|--------|----|------|-----------|--------------|----------|-------------|
 * | s1    | A      | 10 | 16   | NONE      | EXCELLENT    | 18       | 14          |
 * | s2    | A      | 12 | 14   | LOW       | GOOD         | 12       | 16          |
 * | s3    | A      |  8 |  8   | HIGH      | INSUFFICIENT |  6       | 10          |
 * | s4    | A      |  9 |  5   | CRITICAL  | WEAK         |  4       | —           |
 * | s5    | B      | 11 | 12   | NONE      | AVERAGE      | 12       | 12          |
 * | s6    | B      | 13 | null | MEDIUM    | —            | —        | —           |
 *
 * Présences (mars 2026) : s1 PRESENT, s2 ABSENT, s3 LATE, s5 PRESENT.
 * Annexe (siteType ANNEXE) : 2 élèves, moyennes 10 et 14 (Maths).
 */
export type AnalyticsSchoolFixture = {
  schoolId: string;
  annexId: string;
  adminId: string;
  teacherUserId: string;
  yearId: string;
  t1Id: string;
  t2Id: string;
  students: Record<"s1" | "s2" | "s3" | "s4" | "s5" | "s6", string>;
};

export async function seedAnalyticsSchool(): Promise<AnalyticsSchoolFixture> {
  const code = uniqueCode("IT-DASH");
  const schoolId = (await prisma.school.create({ data: { name: `École ${code}`, code, level: "SECONDARY_COLLEGE" } })).id;
  const annexId = (
    await prisma.school.create({
      data: { name: `Annexe ${code}`, code: `${code}-ANX`, level: "SECONDARY_COLLEGE", siteType: "ANNEXE", parentSchoolId: schoolId },
    })
  ).id;

  const user = (first: string, role: "SCHOOL_ADMIN" | "TEACHER" | "STUDENT", school = schoolId) =>
    prisma.user.create({ data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId: school } });

  const adminId = (await user("admin", "SCHOOL_ADMIN")).id;
  const yearName = uniqueCode("2026");
  const year = await prisma.academicYear.create({
    data: { schoolId, name: yearName, startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const t1 = await prisma.period.create({ data: { academicYearId: year.id, name: "T1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } });
  const t2 = await prisma.period.create({ data: { academicYearId: year.id, name: "T2", type: "TRIMESTER", startDate: new Date("2026-01-05"), endDate: new Date("2026-03-31"), sequence: 2 } });
  const level = await prisma.classLevel.create({ data: { schoolId, name: "6e", code: uniqueCode("6E"), level: "SECONDARY_COLLEGE", sequence: 1 } });
  const classA = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "A" } });
  const classB = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: "B" } });
  const math = await prisma.subject.create({ data: { schoolId, name: "Mathématiques", code: uniqueCode("M") } });
  const french = await prisma.subject.create({ data: { schoolId, name: "Français", code: uniqueCode("F") } });

  const teacherUser = await user("prof", "TEACHER");
  const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });
  await prisma.classSubject.create({ data: { classId: classA.id, subjectId: math.id, teacherId: teacher.id } });

  const students = {} as AnalyticsSchoolFixture["students"];
  // [clé, classe, moyenne T1, moyenne T2, risque T2, niveau T2, perf Maths T2, perf Français T2]
  const plan: Array<[keyof AnalyticsSchoolFixture["students"], string, number, number | null, RiskLevel, PerformanceLevel | null, number | null, number | null]> = [
    ["s1", classA.id, 10, 16, "NONE", "EXCELLENT", 18, 14],
    ["s2", classA.id, 12, 14, "LOW", "GOOD", 12, 16],
    ["s3", classA.id, 8, 8, "HIGH", "INSUFFICIENT", 6, 10],
    ["s4", classA.id, 9, 5, "CRITICAL", "WEAK", 4, null],
    ["s5", classB.id, 11, 12, "NONE", "AVERAGE", 12, 12],
    ["s6", classB.id, 13, null, "MEDIUM", null, null, null],
  ];
  for (const [key, classId, avg1, avg2, risk, perf, mathAvg, frAvg] of plan) {
    const u = await user(key, "STUDENT");
    const student = await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode(key), schoolId } });
    students[key] = student.id;
    await prisma.enrollment.create({ data: { studentId: student.id, classId, academicYearId: year.id } });
    await prisma.studentAnalytics.create({ data: { studentId: student.id, periodId: t1.id, academicYearId: year.id, generalAverage: avg1, riskLevel: "NONE" } });
    const latest = await prisma.studentAnalytics.create({
      data: { studentId: student.id, periodId: t2.id, academicYearId: year.id, generalAverage: avg2, riskLevel: risk, performanceLevel: perf },
    });
    if (mathAvg !== null) await prisma.subjectPerformance.create({ data: { analyticsId: latest.id, subjectId: math.id, average: mathAvg } });
    if (frAvg !== null) await prisma.subjectPerformance.create({ data: { analyticsId: latest.id, subjectId: french.id, average: frAvg } });
  }

  // Présences : 2 PRESENT, 1 ABSENT, 1 LATE (hors du mois précédent)
  const day = (d: string) => new Date(`${d}T08:00:00.000Z`);
  await prisma.attendance.createMany({
    data: [
      { studentId: students.s1, classId: classA.id, date: day("2026-03-10"), status: "PRESENT" },
      { studentId: students.s2, classId: classA.id, date: day("2026-03-10"), status: "ABSENT" },
      { studentId: students.s3, classId: classA.id, date: day("2026-03-10"), status: "LATE" },
      { studentId: students.s5, classId: classB.id, date: day("2026-03-10"), status: "PRESENT" },
    ],
  });

  // Annexe : même année, 2 élèves (moyennes 10 et 14, Maths)
  const annexYear = await prisma.academicYear.create({
    data: { schoolId: annexId, name: yearName, startDate: new Date("2025-09-01"), endDate: new Date("2026-07-31"), isCurrent: true },
  });
  const annexPeriod = await prisma.period.create({ data: { academicYearId: annexYear.id, name: "T1", type: "TRIMESTER", startDate: new Date("2025-09-01"), endDate: new Date("2025-12-20"), sequence: 1 } });
  const annexMath = await prisma.subject.create({ data: { schoolId: annexId, name: "Mathématiques", code: uniqueCode("AM") } });
  for (const [key, avg] of [["a1", 10], ["a2", 14]] as const) {
    const u = await user(key, "STUDENT", annexId);
    const student = await prisma.studentProfile.create({ data: { userId: u.id, matricule: uniqueCode(key), schoolId: annexId } });
    const analytics = await prisma.studentAnalytics.create({ data: { studentId: student.id, periodId: annexPeriod.id, academicYearId: annexYear.id, generalAverage: avg } });
    await prisma.subjectPerformance.create({ data: { analyticsId: analytics.id, subjectId: annexMath.id, average: avg } });
  }

  return { schoolId, annexId, adminId, teacherUserId: teacherUser.id, yearId: year.id, t1Id: t1.id, t2Id: t2.id, students };
}
