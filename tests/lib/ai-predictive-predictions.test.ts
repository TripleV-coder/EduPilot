import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    gradeHistory: { findMany: vi.fn() },
    studentAnalytics: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    behaviorIncident: { findMany: vi.fn() },
    homeworkSubmission: { findMany: vi.fn() },
    homework: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { predictNextPeriodGrade } from "@/lib/services/ai-predictive/predict-grade";
import { predictFailureRisk } from "@/lib/services/ai-predictive/predict-failure";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("predictNextPeriodGrade", () => {
  it("retombe sur une baseline prudente sans historique", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([] as any);

    const result = await predictNextPeriodGrade("s1");

    expect(result.modelUsed).toBe("baseline_last_value");
    expect(result.predicted).toBe(10);
    expect(result.confidence).toBe(5);
    expect(result.warning).toContain("Données insuffisantes");
  });

  it("baseline = dernière moyenne quand l'historique est trop court", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([
      { average: 13, period: { sequence: 1 } },
      { average: 14, period: { sequence: 2 } },
    ] as any);

    const result = await predictNextPeriodGrade("s1");

    expect(result.modelUsed).toBe("baseline_last_value");
    expect(result.predicted).toBe(14);
    expect(result.confidence).toBe(30); // 15 * 2 points de données
    expect(result.range.min).toBe(10);
    expect(result.range.max).toBe(18);
  });

  it("prédit la suite d'une progression linéaire régulière", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue(
      [10, 11, 12, 13, 14].map((average, index) => ({
        average,
        period: { sequence: index + 1 },
      })) as any
    );

    const result = await predictNextPeriodGrade("s1");

    // Tendance +1/période : la prédiction d'ensemble se situe entre la
    // dernière valeur et l'extrapolation linéaire (15)
    expect(result.predicted).toBeGreaterThan(13.5);
    expect(result.predicted).toBeLessThanOrEqual(15.5);
    expect(result.confidence).toBeGreaterThan(50);
    expect(result.warning).toBeUndefined();
    expect(result.range.min).toBeLessThan(result.range.max);
    expect(result.range.max).toBeLessThanOrEqual(20);
    expect(["linear_regression", "polynomial_regression", "ensemble_learning"]).toContain(
      result.modelUsed
    );
  });

  it("borne la prédiction dans [0, 20]", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue(
      [16, 17.5, 19, 19.5, 20].map((average, index) => ({
        average,
        period: { sequence: index + 1 },
      })) as any
    );

    const result = await predictNextPeriodGrade("s1");
    expect(result.predicted).toBeLessThanOrEqual(20);
    expect(result.range.max).toBeLessThanOrEqual(20);
  });
});

describe("predictFailureRisk", () => {
  function mockStudentData(options: {
    averages?: number[]; // de la plus récente à la plus ancienne
    presentDays?: number;
    absentDays?: number;
    incidents?: { severity: string }[];
    submittedHomeworks?: number;
    totalHomeworks?: number;
    weakSubjects?: number;
  }) {
    const {
      averages = [],
      presentDays = 0,
      absentDays = 0,
      incidents = [],
      submittedHomeworks = 0,
      totalHomeworks = 0,
      weakSubjects = 0,
    } = options;

    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue(
      averages.map((generalAverage, index) => ({
        generalAverage,
        period: { sequence: averages.length - index },
        subjectPerformances:
          index === 0
            ? Array.from({ length: weakSubjects + 1 }, (_, i) => ({
                isWeakness: i < weakSubjects,
                subject: { name: `Matière ${i}` },
              }))
            : [],
      })) as any
    );
    vi.mocked(prisma.attendance.findMany).mockResolvedValue(
      [
        ...Array.from({ length: presentDays }, () => ({ status: "PRESENT" })),
        ...Array.from({ length: absentDays }, () => ({ status: "ABSENT" })),
      ] as any
    );
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue(incidents as any);
    vi.mocked(prisma.homeworkSubmission.findMany).mockResolvedValue(
      Array.from({ length: submittedHomeworks }, () => ({})) as any
    );
    vi.mocked(prisma.homework.count).mockResolvedValue(totalHomeworks);
  }

  it("élève sans signal → risque TRÈS FAIBLE avec recommandations génériques", async () => {
    mockStudentData({
      averages: [14, 13.5],
      presentDays: 40,
      absentDays: 1,
      submittedHomeworks: 10,
      totalHomeworks: 10,
    });

    const result = await predictFailureRisk("s1");

    expect(result.level).toBe("TRÈS FAIBLE");
    expect(result.probability).toBeLessThan(15);
    expect(result.recommendations).toContain("Continuer le suivi régulier de l'élève");
  });

  it("élève en grande difficulté → risque TRÈS ÉLEVÉ, facteurs causaux triés", async () => {
    mockStudentData({
      averages: [7, 9], // moyenne critique + tendance à la baisse
      presentDays: 10,
      absentDays: 10, // 50% d'assiduité
      incidents: [{ severity: "CRITICAL" }, { severity: "HIGH" }],
      submittedHomeworks: 2,
      totalHomeworks: 10, // 20% de devoirs rendus
      weakSubjects: 3,
    });

    const result = await predictFailureRisk("s1");

    expect(result.level).toBe("TRÈS ÉLEVÉ");
    expect(result.probability).toBeGreaterThanOrEqual(75);
    expect(result.factors.join(" ")).toContain("Moyenne critique");
    expect(result.factors.join(" ")).toContain("Assiduité critique");
    expect(result.factors.join(" ")).toContain("incident(s) critique(s)");
    expect(result.factors.join(" ")).toContain("devoirs rendus");
    expect(result.factors.join(" ")).toContain("matières en difficulté");

    // Facteurs causaux triés par contribution décroissante
    const contributions = result.causalFactors.map((f) => f.contribution);
    expect(contributions).toEqual([...contributions].sort((a, b) => b - a));
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("risque modéré : moyenne insuffisante seule", async () => {
    mockStudentData({
      averages: [9.5, 9.4],
      presentDays: 40,
      absentDays: 2,
      submittedHomeworks: 9,
      totalHomeworks: 10,
    });

    const result = await predictFailureRisk("s1");

    // academicScore 70 * 0.35 ≈ 24.5 (+ assiduité légère)
    expect(["FAIBLE", "MODÉRÉ"]).toContain(result.level);
    expect(result.factors.join(" ")).toContain("Moyenne insuffisante");
  });
});
