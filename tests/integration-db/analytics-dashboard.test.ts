import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/analytics/dashboard/route";
import { actAs, callRoute, sessionFor } from "./helpers";
import { seedAnalyticsSchool, type AnalyticsSchoolFixture } from "./fixtures/analytics-school";

/**
 * C3 — `GET /api/analytics/dashboard` (admin et enseignant) : test de
 * CARACTÉRISATION contre une vraie base, écrit avant l'optimisation.
 *
 * Mesure du Lot 3 : 1 971 ms (admin) / 1 766 ms (enseignant) — toutes les
 * analyses de l'année avec élève, inscriptions et performances par matière,
 * chargées en mémoire (deux fois pour l'admin : tableau de bord + comparaison
 * des sites). Critère : p95 < 300 ms.
 * Les valeurs ci-dessous sont calculées à la main (jeu de données décrit dans
 * ./fixtures/analytics-school.ts) ; elles doivent rester identiques.
 */
type Row = { id: string; name: string };

let fx: AnalyticsSchoolFixture;

beforeAll(async () => {
  fx = await seedAnalyticsSchool();
});

describe("C3 — tableau de bord administrateur (caractérisation)", () => {
  it("calcule indicateurs, répartitions, classes, tendance et élèves à risque", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", fx.schoolId, fx.adminId));
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
        { id: fx.students.s4, name: "s4 Test", className: "A", average: 5, riskLevel: "critical" },
        { id: fx.students.s3, name: "s3 Test", className: "A", average: 8, riskLevel: "high" },
      ],
    });
  });

  it("compare l'école à son annexe", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", fx.schoolId, fx.adminId));
    const res = await callRoute(GET, { path: "/api/analytics/dashboard" });
    const comparison = (res.body as { siteComparison: Array<Row & Record<string, unknown>> }).siteComparison;

    expect(comparison.map((site) => site.id)).toEqual([fx.schoolId, fx.annexId]);
    expect(comparison[0]).toMatchObject({ studentCount: 6, averageGrade: 11, attendanceRate: 75, passRate: 60, topSubject: "Français", comparisonNote: null });
    expect(comparison[1]).toMatchObject({ studentCount: 2, averageGrade: 12, attendanceRate: 0, passRate: 100, topSubject: "Mathématiques", comparisonNote: null });
  });
});

describe("C3 — tableau de bord enseignant (caractérisation)", () => {
  it("calcule classes, élèves, moyennes, tendance et élèves à risque de l'enseignant", async () => {
    actAs(sessionFor("TEACHER", fx.schoolId, fx.teacherUserId));
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
        { id: fx.students.s4, name: "s4 Test", className: "A", average: 5, riskLevel: "critical" },
        { id: fx.students.s3, name: "s3 Test", className: "A", average: 8, riskLevel: "high" },
      ],
    });
  });
});
