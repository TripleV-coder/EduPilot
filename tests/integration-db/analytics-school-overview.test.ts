import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/analytics/school/overview/route";
import { actAs, callRoute, sessionFor } from "./helpers";
import { seedAnalyticsSchool, type AnalyticsSchoolFixture } from "./fixtures/analytics-school";

/**
 * C3 — `GET /api/analytics/school/overview` : test de CARACTÉRISATION contre
 * une vraie base, écrit avant l'optimisation (mesure du Lot 3 : ~1,7 s — toutes
 * les analyses de l'année avec élève, inscriptions et performances par matière).
 * Consommateur : dashboard/analytics/page.tsx. La réponse doit rester identique.
 *
 * Particularité conservée : `averageGeneral` compte une moyenne nulle comme 0
 * (Number(null) === 0), et le taux d'échec aussi (s6, T2 sans moyenne).
 */
let fx: AnalyticsSchoolFixture;

beforeAll(async () => {
  fx = await seedAnalyticsSchool();
});

type Body = Record<string, unknown> & {
  periodComparison: null | { previousPeriod: string; currentAverage: number; previousAverage: number; improvement: number; studentsImproved: number; studentsDeclined: number };
};

describe("C3 — vue d'ensemble analytique de l'établissement (caractérisation)", () => {
  it("dernière période par élève : indicateurs, répartitions, meilleurs élèves, élèves à risque, matières", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", fx.schoolId, fx.adminId));
    const res = await callRoute(GET, { path: "/api/analytics/school/overview" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      overview: {
        totalStudents: 6,
        activeStudents: 6,
        averageGrade: "9.17",
        totalAnalytics: 6,
        failureRate: 50,
        dropoutRiskCount: 1,
        atRiskCount: 1,
      },
      performanceDistribution: { excellent: 1, veryGood: 0, good: 1, average: 1, insufficient: 1, weak: 1 },
      riskDistribution: { low: 1, medium: 1, high: 1, critical: 1 },
      topStudents: [
        {
          student: { user: { firstName: "s1", lastName: "Test" }, class: { name: "A" } },
          generalAverage: 16,
          period: { id: fx.t2Id, name: "T2", sequence: 2 },
        },
      ],
      atRiskStudents: [
        {
          student: { id: fx.students.s4, user: { firstName: "s4", lastName: "Test" }, class: { name: "A" } },
          generalAverage: 5,
          period: { id: fx.t2Id, name: "T2", sequence: 2 },
        },
        {
          student: { id: fx.students.s3, user: { firstName: "s3", lastName: "Test" }, class: { name: "A" } },
          generalAverage: 8,
          period: { id: fx.t2Id, name: "T2", sequence: 2 },
        },
      ],
      subjectSummary: [
        { subjectId: expect.any(String), subject: "Français", name: "Français", grade: 13, average: 13, passRate: 100, studentsCount: 4 },
        { subjectId: expect.any(String), subject: "Mathématiques", name: "Mathématiques", grade: 10.4, average: 10.4, passRate: 60, studentsCount: 5 },
      ],
      attendanceDistribution: { present: 2, absent: 1, late: 1, excused: 0 },
      periodComparison: null,
      academicYearId: fx.yearId,
      periods: [
        { id: fx.t1Id, name: "T1", sequence: 1 },
        { id: fx.t2Id, name: "T2", sequence: 2 },
      ],
    });
  });

  it("période choisie : comparaison avec la période précédente", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", fx.schoolId, fx.adminId));
    const res = await callRoute(GET, { path: `/api/analytics/school/overview?periodId=${fx.t2Id}` });
    const body = res.body as Body;

    expect(res.status).toBe(200);
    expect(body.overview).toMatchObject({ averageGrade: "9.17", totalAnalytics: 6, failureRate: 50 });
    const comparison = body.periodComparison!;
    expect(comparison.previousPeriod).toBe("T1");
    expect(comparison.previousAverage).toBeCloseTo(10.5, 10);
    expect(comparison.currentAverage).toBeCloseTo(55 / 6, 10);
    expect(comparison.improvement).toBeCloseTo(55 / 6 - 10.5, 10);
    // s1, s2, s5 progressent ; s4 et s6 (moyenne nulle comptée 0) reculent ; s3 stable
    expect(comparison.studentsImproved).toBe(3);
    expect(comparison.studentsDeclined).toBe(2);
  });

  it("première période : pas de période précédente", async () => {
    actAs(sessionFor("SCHOOL_ADMIN", fx.schoolId, fx.adminId));
    const res = await callRoute(GET, { path: `/api/analytics/school/overview?periodId=${fx.t1Id}` });
    const body = res.body as Body;

    expect(res.status).toBe(200);
    expect(body.periodComparison).toBeNull();
    expect(body.overview).toMatchObject({ averageGrade: "10.50", totalAnalytics: 6, failureRate: 33.33 });
    expect(body.topStudents).toEqual([]);
    expect(body.subjectSummary).toEqual([]);
  });
});
