import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/teachers/school-assignments", () => ({
  countTeachersForSchool: vi.fn(),
}));

import {
  buildPerformanceDistribution,
  buildRiskDistribution,
  buildSubjectSummary,
  buildAtRiskStudents,
  type AnalyticsWithDetails,
} from "@/lib/services/analytics-dashboard";

describe("buildPerformanceDistribution", () => {
  it("compte chaque palier de performance", () => {
    const analytics = [
      { performanceLevel: "EXCELLENT" },
      { performanceLevel: "EXCELLENT" },
      { performanceLevel: "GOOD" },
      { performanceLevel: "WEAK" },
      { performanceLevel: null },
    ];
    expect(buildPerformanceDistribution(analytics)).toEqual({
      excellent: 2,
      veryGood: 0,
      good: 1,
      average: 0,
      insufficient: 0,
      weak: 1,
    });
  });
});

describe("buildRiskDistribution", () => {
  it("compte chaque niveau de risque (NONE/null exclus)", () => {
    const analytics = [
      { riskLevel: "LOW" },
      { riskLevel: "CRITICAL" },
      { riskLevel: "CRITICAL" },
      { riskLevel: "NONE" },
      { riskLevel: null },
    ];
    expect(buildRiskDistribution(analytics)).toEqual({
      low: 1,
      medium: 0,
      high: 0,
      critical: 2,
    });
  });
});

describe("buildSubjectSummary", () => {
  const analytics = [
    {
      subjectPerformances: [
        { subjectId: "math", subject: { name: "Mathématiques" }, average: 14 },
        { subjectId: "fr", subject: { name: "Français" }, average: 10 },
      ],
    },
    {
      subjectPerformances: [
        { subjectId: "math", subject: { name: "Mathématiques" }, average: 12 },
        { subjectId: "fr", subject: { name: "Français" }, average: null },
      ],
    },
    {},
  ];

  it("agrège les moyennes par matière, trie décroissant, ignore les nulls", () => {
    expect(buildSubjectSummary(analytics as never)).toEqual([
      { name: "Mathématiques", average: 13 },
      { name: "Français", average: 10 },
    ]);
  });

  it("filtre sur une matière demandée", () => {
    expect(buildSubjectSummary(analytics as never, "fr")).toEqual([
      { name: "Français", average: 10 },
    ]);
  });
});

describe("buildAtRiskStudents", () => {
  const yearId = "year1";

  function analyticsRow(options: {
    studentId: string;
    firstName: string;
    riskLevel: string;
    average: number;
    withEnrollment?: boolean;
  }) {
    return {
      studentId: options.studentId,
      riskLevel: options.riskLevel,
      generalAverage: options.average,
      student: {
        user: { firstName: options.firstName, lastName: "Test" },
        enrollments:
          options.withEnrollment === false
            ? []
            : [
                {
                  academicYearId: yearId,
                  status: "ACTIVE",
                  class: { name: "6e A" },
                },
              ],
      },
    } as unknown as AnalyticsWithDetails;
  }

  it("ne garde que HIGH/CRITICAL, trie par moyenne croissante, max 5", () => {
    const rows = [
      analyticsRow({ studentId: "s1", firstName: "Awa", riskLevel: "LOW", average: 4 }),
      analyticsRow({ studentId: "s2", firstName: "Bio", riskLevel: "CRITICAL", average: 6 }),
      analyticsRow({ studentId: "s3", firstName: "Cica", riskLevel: "HIGH", average: 5 }),
      analyticsRow({ studentId: "s4", firstName: "Dine", riskLevel: "HIGH", average: 9 }),
      analyticsRow({ studentId: "s5", firstName: "Efe", riskLevel: "CRITICAL", average: 7 }),
      analyticsRow({ studentId: "s6", firstName: "Fall", riskLevel: "HIGH", average: 8 }),
      analyticsRow({ studentId: "s7", firstName: "Gan", riskLevel: "CRITICAL", average: 8.5 }),
    ];

    const result = buildAtRiskStudents(rows, yearId);

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.id)).toEqual(["s3", "s2", "s5", "s6", "s7"]);
    expect(result[0]).toMatchObject({
      name: "Cica Test",
      className: "6e A",
      average: 5,
      riskLevel: "high",
    });
  });

  it("affiche « Indisponible » sans inscription active sur l'année", () => {
    const result = buildAtRiskStudents(
      [
        analyticsRow({
          studentId: "s1",
          firstName: "Awa",
          riskLevel: "HIGH",
          average: 6,
          withEnrollment: false,
        }),
      ],
      yearId
    );
    expect(result[0].className).toBe("Indisponible");
  });
});
