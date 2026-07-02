import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    studentAnalytics: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/services/ai-predictive/predict-failure", () => ({
  predictFailureRisk: vi.fn(),
}));
vi.mock("@/lib/services/ai-predictive/predict-grade", () => ({
  predictNextPeriodGrade: vi.fn(),
}));
vi.mock("@/lib/services/ai-predictive/predict-behavior", () => ({
  predictBehaviorRisk: vi.fn(),
}));
vi.mock("@/lib/services/ai-predictive/predict-dropout", () => ({
  predictDropoutRisk: vi.fn(),
}));
vi.mock("@/lib/services/ai-predictive/detect-early-warning", () => ({
  detectEarlyWarnings: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { predictFailureRisk } from "@/lib/services/ai-predictive/predict-failure";
import { predictNextPeriodGrade } from "@/lib/services/ai-predictive/predict-grade";
import { predictBehaviorRisk } from "@/lib/services/ai-predictive/predict-behavior";
import { predictDropoutRisk } from "@/lib/services/ai-predictive/predict-dropout";
import { detectEarlyWarnings } from "@/lib/services/ai-predictive/detect-early-warning";
import {
  generateStudentPredictions,
  generateClassPredictions,
} from "@/lib/services/ai-predictive/predict-student";

function mockPredictors(options: {
  gradeConfidence?: number;
  predicted?: number;
  failureProbability?: number;
  behaviorProbability?: number;
  dropoutProbability?: number;
}) {
  vi.mocked(predictNextPeriodGrade).mockResolvedValue({
    predicted: options.predicted ?? 13,
    confidence: options.gradeConfidence ?? 80,
    range: { min: 11, max: 15 },
    modelUsed: "linear_regression",
  } as any);
  vi.mocked(predictFailureRisk).mockResolvedValue({
    probability: options.failureProbability ?? 10,
    level: "FAIBLE",
    factors: [],
    recommendations: [],
    causalFactors: [],
  } as any);
  vi.mocked(predictBehaviorRisk).mockResolvedValue({
    probability: options.behaviorProbability ?? 5,
    nextIncidentPrediction: "Comportement stable, risque très faible",
    causalFactors: [],
    recommendations: [],
    confidence: 60,
    dataQuality: "LOW",
  } as any);
  vi.mocked(predictDropoutRisk).mockResolvedValue({
    probability: options.dropoutProbability ?? 5,
    level: "TRÈS FAIBLE",
    signals: [],
    recommendations: [],
    confidence: 30,
    dataQuality: "LOW",
  } as any);
  vi.mocked(detectEarlyWarnings).mockResolvedValue([] as any);
}

function subjectPerf(name: string, average: number, isStrength: boolean) {
  return { subject: { name }, average, isStrength };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateStudentPredictions", () => {
  it("profil scientifique → Séries C et D, scores dérivés des moyennes", async () => {
    mockPredictors({ gradeConfidence: 80, failureProbability: 10, behaviorProbability: 5 });
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue({
      subjectPerformances: [
        subjectPerf("Mathématiques", 16, true),
        subjectPerf("Physique-Chimie", 14, true),
        subjectPerf("Français", 11, false),
        subjectPerf("EPS", 13, false),
      ],
    } as any);

    const result = await generateStudentPredictions("s1");

    expect(result.predictions.orientationFit.series).toEqual(["Série C", "Série D"]);
    // Moyenne sciences = 15 → score 75, Série D = 70
    expect(result.predictions.orientationFit.scores).toEqual([75, 70]);
    // Confiance = 80*0.6 + 90*0.2 + 95*0.2 = 85
    expect(result.confidence).toBe(85);
    // 4 matières → qualité MEDIUM
    expect(result.dataQuality).toBe("MEDIUM");
    expect(result.predictions.nextPeriodGrade.predicted).toBe(13);
  });

  it("profil littéraire + éco → Séries A et G", async () => {
    mockPredictors({});
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue({
      subjectPerformances: [
        subjectPerf("Français", 15, true),
        subjectPerf("Économie", 14, true),
        subjectPerf("Histoire-Géographie", 13, false),
        subjectPerf("Philosophie", 12, false),
        subjectPerf("Anglais", 12, false),
        subjectPerf("Maths", 8, false),
      ],
    } as any);

    const result = await generateStudentPredictions("s1");

    expect(result.predictions.orientationFit.series).toContain("Série A");
    expect(result.predictions.orientationFit.series).toContain("Série G");
    expect(result.dataQuality).toBe("HIGH"); // 6 matières
  });

  it("sans force détectée → profil polyvalent (Séries A et D à 60)", async () => {
    mockPredictors({});
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue({
      subjectPerformances: [subjectPerf("EPS", 12, false)],
    } as any);

    const result = await generateStudentPredictions("s1");

    expect(result.predictions.orientationFit.series).toEqual(["Série A", "Série D"]);
    expect(result.predictions.orientationFit.scores).toEqual([60, 60]);
    expect(result.predictions.orientationFit.reasoning).toContain("polyvalent");
  });

  it("sans analytics : orientation vide et qualité LOW", async () => {
    mockPredictors({});
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue(null);

    const result = await generateStudentPredictions("s1");

    expect(result.predictions.orientationFit.series).toEqual([]);
    expect(result.dataQuality).toBe("LOW");
  });
});

describe("generateClassPredictions", () => {
  it("classe vide → prédictions neutres et message explicite", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([] as any);

    const result = await generateClassPredictions("cl1");

    expect(result.predictions.averageNextPeriod).toBe(0);
    expect(result.predictions.studentsAtRisk).toBe(0);
    expect(result.predictions.recommendations[0]).toContain("Aucun élève actif");
    expect(predictNextPeriodGrade).not.toHaveBeenCalled();
  });

  it("agrège les prédictions et identifie les élèves à risque (≥ 50%)", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: "s1" },
      { studentId: "s2" },
      { studentId: "s3" },
    ] as any);
    vi.mocked(predictNextPeriodGrade)
      .mockResolvedValueOnce({ predicted: 8 } as any)
      .mockResolvedValueOnce({ predicted: 12 } as any)
      .mockResolvedValueOnce({ predicted: 7 } as any);
    vi.mocked(predictFailureRisk)
      .mockResolvedValueOnce({ probability: 80 } as any)
      .mockResolvedValueOnce({ probability: 20 } as any)
      .mockResolvedValueOnce({ probability: 55 } as any);
    // Décrochage réel : moyenne (60 + 0 + 30) / 3 = 30
    vi.mocked(predictDropoutRisk)
      .mockResolvedValueOnce({ probability: 60 } as any)
      .mockResolvedValueOnce({ probability: 0 } as any)
      .mockResolvedValueOnce({ probability: 30 } as any);
    // 1 élève avec alerte précoce
    vi.mocked(detectEarlyWarnings)
      .mockResolvedValueOnce([{ type: "ATTENDANCE_CLIFF" }] as any)
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([] as any);

    const result = await generateClassPredictions("cl1");

    expect(result.predictions.averageNextPeriod).toBe(9);
    expect(result.predictions.studentsAtRisk).toBe(2);
    expect(result.predictions.studentsAtRiskIds).toEqual(["s1", "s3"]);
    // dropoutRisk = moyenne du vrai modèle de décrochage (60+0+30)/3 = 30
    expect(result.predictions.dropoutRisk).toBe(30);
    expect(result.predictions.studentsWithWarnings).toBe(1);
    // riskShare = 2/3 ≈ 66% > 30 → intervention urgente + moyenne < 10 → alerte pédagogique
    expect(result.predictions.recommendations.join(" ")).toContain("Intervention urgente");
    expect(result.predictions.recommendations.join(" ")).toContain("méthodes pédagogiques");
    expect(result.predictions.recommendations.join(" ")).toContain("alerte précoce");
  });

  it("classe saine → suivi habituel", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: "s1" },
      { studentId: "s2" },
    ] as any);
    vi.mocked(predictNextPeriodGrade).mockResolvedValue({ predicted: 13 } as any);
    vi.mocked(predictFailureRisk).mockResolvedValue({ probability: 10 } as any);
    vi.mocked(predictDropoutRisk).mockResolvedValue({ probability: 0 } as any);
    vi.mocked(detectEarlyWarnings).mockResolvedValue([] as any);

    const result = await generateClassPredictions("cl1");

    expect(result.predictions.dropoutRisk).toBe(0);
    expect(result.predictions.studentsWithWarnings).toBe(0);
    expect(result.predictions.recommendations).toEqual(["Continuer le suivi habituel de la classe"]);
  });
});
