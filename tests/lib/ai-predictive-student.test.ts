import { describe, it, expect, vi, beforeEach } from "vitest";

// Paramètres de l'établissement : valeurs par défaut (pas de table de réglages dans le mock Prisma)
vi.mock("@/lib/schools/school-parameters-store", async () => {
    const { DEFAULT_SCHOOL_PARAMETERS } = await import("@/lib/schools/school-parameters");
    return {
        getSchoolParameters: vi.fn(async () => DEFAULT_SCHOOL_PARAMETERS),
        getSchoolParametersForStudent: vi.fn(async () => DEFAULT_SCHOOL_PARAMETERS),
        saveSchoolParameters: vi.fn(),
    };
});
vi.mock("@/lib/academic/grading-settings", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/academic/grading-settings")>()),
    getPassingGrade: vi.fn(async () => 10),
    passingGradeForStudent: vi.fn(async () => 10),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentAnalytics: { findFirst: vi.fn() },
    enrollment: { findMany: vi.fn(), findFirst: vi.fn() },
    class: { findUnique: vi.fn(async () => ({ schoolId: "sch1" })) },
  },
}));
vi.mock("@/lib/services/orientation", () => ({
  computeIndicativeRecommendations: vi.fn(),
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
import { computeIndicativeRecommendations } from "@/lib/services/orientation";
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
    range80: { min: 12, max: 14 },
    dataPoints: 4,
    modelUsed: "exponential_smoothing",
  });
  vi.mocked(predictFailureRisk).mockResolvedValue({
    probability: options.failureProbability ?? 10,
    level: "FAIBLE",
    factors: [],
    recommendations: [],
    causalFactors: [],
  });
  vi.mocked(predictBehaviorRisk).mockResolvedValue({
    probability: options.behaviorProbability ?? 5,
    nextIncidentPrediction: "Comportement stable, risque très faible",
    causalFactors: [],
    recommendations: [],
    confidence: 60,
    dataQuality: "LOW",
  });
  vi.mocked(predictDropoutRisk).mockResolvedValue({
    probability: options.dropoutProbability ?? 5,
    level: "TRÈS FAIBLE",
    signals: [],
    recommendations: [],
    confidence: 30,
    dataQuality: "LOW",
  });
  vi.mocked(detectEarlyWarnings).mockResolvedValue([]);
}

type StudentAnalyticsResult = Awaited<
  ReturnType<typeof prisma.studentAnalytics.findFirst>
>;
type EnrollmentListResult = Awaited<
  ReturnType<typeof prisma.enrollment.findMany>
>;
type GradePredictionResult = Awaited<
  ReturnType<typeof predictNextPeriodGrade>
>;
type FailurePredictionResult = Awaited<
  ReturnType<typeof predictFailureRisk>
>;
type DropoutPredictionResult = Awaited<
  ReturnType<typeof predictDropoutRisk>
>;
type EarlyWarningListResult = Awaited<
  ReturnType<typeof detectEarlyWarnings>
>;

function subjectPerf(name: string, average: number, isStrength: boolean) {
  return { subject: { name }, average, isStrength };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generateStudentPredictions", () => {
  it("orientation = calcul officiel (moyennes du bulletin, critères de l'école), indicative", async () => {
    mockPredictors({ gradeConfidence: 62 });
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ academicYearId: "y1" } as never);
    vi.mocked(computeIndicativeRecommendations).mockResolvedValue({
      recommendations: [
        { series: "SERIE_C", name: "Série C", description: "", score: 78, strengths: [], warnings: [] },
        { series: "SERIE_D", name: "Série D", description: "", score: 71, strengths: [], warnings: [] },
      ],
      generalAverage: 13.25,
    } as never);
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue({
      subjectPerformances: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    } as unknown as StudentAnalyticsResult);

    const result = await generateStudentPredictions("s1");

    expect(computeIndicativeRecommendations).toHaveBeenCalledWith("s1", "y1");
    expect(result.predictions.orientationFit.series).toEqual(["Série C", "Série D"]);
    expect(result.predictions.orientationFit.scores).toEqual([78, 71]);
    expect(result.predictions.orientationFit.reasoning).toContain("13,25/20");
    expect(result.predictions.orientationFit.reasoning).toContain("conseil de classe");
    // Confiance = celle, calibrée, de la prévision de note (chances d'être à ±1 point)
    expect(result.confidence).toBe(62);
    expect(result.dataQuality).toBe("MEDIUM"); // 4 matières évaluées
    expect(result.predictions.nextPeriodGrade.predicted).toBe(13);
  });

  it("sans moyenne déterminante : aucune série proposée (jamais une série « par défaut »)", async () => {
    mockPredictors({});
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ academicYearId: "y1" } as never);
    vi.mocked(computeIndicativeRecommendations).mockResolvedValue({ recommendations: [], generalAverage: null } as never);
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue(null);

    const result = await generateStudentPredictions("s1");

    expect(result.predictions.orientationFit.series).toEqual([]);
    expect(result.predictions.orientationFit.reasoning).toContain("Données insuffisantes");
    expect(result.dataQuality).toBe("LOW");
  });

  it("élève sans inscription active : pas d'orientation calculée", async () => {
    mockPredictors({});
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.studentAnalytics.findFirst).mockResolvedValue(null);

    const result = await generateStudentPredictions("s1");

    expect(computeIndicativeRecommendations).not.toHaveBeenCalled();
    expect(result.predictions.orientationFit.series).toEqual([]);
  });
});

describe("generateClassPredictions", () => {
  it("classe vide → prédictions neutres et message explicite", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);

    const result = await generateClassPredictions("cl1");

    expect(result.predictions.averageNextPeriod).toBeNull();
    expect(result.predictions.studentsAtRisk).toBe(0);
    expect(result.predictions.recommendations[0]).toContain("Aucun élève actif");
    expect(predictNextPeriodGrade).not.toHaveBeenCalled();
  });

  it("agrège les prédictions et identifie les élèves à risque (niveau « élevé » de l'école, 55 %)", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: "s1" },
      { studentId: "s2" },
      { studentId: "s3" },
    ] as unknown as EnrollmentListResult);
    vi.mocked(predictNextPeriodGrade)
      .mockResolvedValueOnce({ predicted: 8 } as unknown as GradePredictionResult)
      .mockResolvedValueOnce({ predicted: 12 } as unknown as GradePredictionResult)
      .mockResolvedValueOnce({ predicted: 7 } as unknown as GradePredictionResult);
    vi.mocked(predictFailureRisk)
      .mockResolvedValueOnce({ probability: 80 } as unknown as FailurePredictionResult)
      .mockResolvedValueOnce({ probability: 20 } as unknown as FailurePredictionResult)
      .mockResolvedValueOnce({ probability: 55 } as unknown as FailurePredictionResult);
    // Décrochage réel : moyenne (60 + 0 + 30) / 3 = 30
    vi.mocked(predictDropoutRisk)
      .mockResolvedValueOnce({ probability: 60 } as unknown as DropoutPredictionResult)
      .mockResolvedValueOnce({ probability: 0 } as unknown as DropoutPredictionResult)
      .mockResolvedValueOnce({ probability: 30 } as unknown as DropoutPredictionResult);
    // 1 élève avec alerte précoce
    vi.mocked(detectEarlyWarnings)
      .mockResolvedValueOnce([{ type: "ATTENDANCE_CLIFF" }] as unknown as EarlyWarningListResult)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

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
    ] as unknown as EnrollmentListResult);
    vi.mocked(predictNextPeriodGrade).mockResolvedValue({ predicted: 13 } as unknown as GradePredictionResult);
    vi.mocked(predictFailureRisk).mockResolvedValue({ probability: 10 } as unknown as FailurePredictionResult);
    vi.mocked(predictDropoutRisk).mockResolvedValue({ probability: 0 } as unknown as DropoutPredictionResult);
    vi.mocked(detectEarlyWarnings).mockResolvedValue([]);

    const result = await generateClassPredictions("cl1");

    expect(result.predictions.dropoutRisk).toBe(0);
    expect(result.predictions.studentsWithWarnings).toBe(0);
    expect(result.predictions.recommendations).toEqual(["Continuer le suivi habituel de la classe"]);
  });
});
