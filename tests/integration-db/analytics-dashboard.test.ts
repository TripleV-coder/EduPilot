import { beforeAll, describe, expect, it } from "vitest";
import type { PerformanceLevel, RiskLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/analytics/dashboard/route";
import { actAs, callRoute, sessionFor, uniqueCode } from "./helpers";

/**
 * C3 — `GET /api/analytics/dashboard` (admin et enseignant) : test de
 * CARACTÉRISATION contre une vraie base, écrit avant l'optimisation.
 *
 * Mesure du Lot 3 : 1 971 ms (admin) / 1 766 ms (enseignant) — toutes les
 * analyses de l'année avec élève, inscriptions et performances par matière,
 * chargées en mémoire (deux fois pour l'admin : tableau de bord + comparaison
 * des sites). Critère : p95 < 300 ms.
 * Les valeurs ci-dessous sont calculées à la main ; elles doivent rester
 * identiques après l'optimisation.
 */
type Row = { id: string; name: string };

let schoolId: string;
let annexId: string;
let adminId: string;
let teacherUserId: string;
const s: Record<string, string> = {};

beforeAll(async () => {
  const code = uniqueCode("IT-DASH");
  schoolId = (await prisma.school.create({ data: { name: `École ${code}`, code, level: "SECONDARY_COLLEGE" } })).id;
  annexId = (
    await prisma.school.create({
      data: { name: `Annexe ${code}`, code: `${code}-ANX`, level: "SECONDARY_COLLEGE", siteType: "ANNEXE", parentSchoolId: schoolId },
    })
  ).id;

  const user = (first: string, role: "SCHOOL_ADMIN" | "TEACHER" | "STUDENT", school = schoolId) =>
    prisma.user.create({ data: { email: `${uniqueCode(first)}@integration.test`, password: "x", firstName: first, lastName: "Test", role, schoolId: school } });

  adminId = (await user("admin", "SCHOOL_ADMIN")).id;
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
  teacherUserId = teacherUser.id;
  const teacher = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, schoolId } });
  await prisma.classSubject.create({ data: { classId: classA.id, subjectId: math.id, teacherId: teacher.id } });

  // [clé, classe, moyenne T1, moyenne T2, risque T2, niveau T2, perf Maths T2, perf Français T2]
  const plan: Array<[string, string, number, number | null, RiskLevel, PerformanceLevel | null, number | null, number | null]> = [
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
    s[key] = student.id;
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
      { studentId: s.s1, classId: classA.id, date: day("2026-03-10"), status: "PRESENT" },
      { studentId: s.s2, classId: classA.id, date: day("2026-03-10"), status: "ABSENT" },
      { studentId: s.s3, classId: classA.id, date: day("2026-03-10"), status: "LATE" },
      { studentId: s.s5, classId: classB.id, date: day("2026-03-10"), status: "PRESENT" },
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
});

describe("C3 — tableau de bord administrateur (caractérisation)", () => {
  it("calcule indicateurs, répartitions, classes, tendance et élèves à risque", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: "/api/analytics/dashboard" });
    const body = res.body as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      totalStudents: 6,
      totalClasses: 2,
      averageGrade: 11,
      attendanceRate: 75,
      passRate: 60,
      failureRate: 40,
      dropoutRate: 0,
      studentGrowth: 0,
      attendanceGrowth: 0,
      averageGrowth: 4.76,
      activeAlerts: 2,
      performanceDistribution: { excellent: 1, veryGood: 0, good: 1, average: 1, insufficient: 1, weak: 1 },
      riskDistribution: { low: 1, medium: 1, high: 1, critical: 1 },
      attendanceDistribution: { present: 2, absent: 1, late: 1, excused: 0 },
      subjectSummary: [
        { name: "Français", average: 13 },
        { name: "Mathématiques", average: 10.4 },
      ],
      classSummary: [
        { name: "B", average: 12, studentCount: 2 },
        { name: "A", average: 10.75, studentCount: 4 },
      ],
      monthlyTrend: [
        { name: "T1", value: 10.5 },
        { name: "T2", value: 11 },
      ],
      atRiskStudents: [
        { id: s.s4, name: "s4 Test", className: "A", average: 5, riskLevel: "critical" },
        { id: s.s3, name: "s3 Test", className: "A", average: 8, riskLevel: "high" },
      ],
    });
  });

  it("compare l'école à son annexe", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", schoolId, adminId));
    const res = await callRoute(GET, { path: "/api/analytics/dashboard" });
    const comparison = (res.body as { siteComparison: Array<Row & Record<string, unknown>> }).siteComparison;

    expect(comparison.map((site) => site.id)).toEqual([schoolId, annexId]);
    expect(comparison[0]).toMatchObject({ studentCount: 6, averageGrade: 11, attendanceRate: 75, passRate: 60, topSubject: "Français", comparisonNote: null });
    expect(comparison[1]).toMatchObject({ studentCount: 2, averageGrade: 12, attendanceRate: 0, passRate: 100, topSubject: "Mathématiques", comparisonNote: null });
  });
});

describe("C3 — tableau de bord enseignant (caractérisation)", () => {
  it("calcule classes, élèves, moyennes, tendance et élèves à risque de l'enseignant", async () => {
    actAs(sessionFor("TEACHER", schoolId, teacherUserId));
    const res = await callRoute(GET, { path: "/api/analytics/dashboard" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      myClasses: 1,
      myStudents: 4,
      classAverage: 10.75,
      classPerformance: [{ name: "A", average: 10.75 }],
      monthlyTrend: [
        { name: "T1", value: 9.75 },
        { name: "T2", value: 10.75 },
      ],
      atRiskStudents: [
        { id: s.s4, name: "s4 Test", className: "A", average: 5, riskLevel: "critical" },
        { id: s.s3, name: "s3 Test", className: "A", average: 8, riskLevel: "high" },
      ],
    });
  });
});
