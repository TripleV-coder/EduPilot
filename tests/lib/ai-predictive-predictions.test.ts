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

type GradeHistoryList = Awaited<ReturnType<typeof prisma.gradeHistory.findMany>>;
type StudentAnalyticsList = Awaited<ReturnType<typeof prisma.studentAnalytics.findMany>>;
type AttendanceList = Awaited<ReturnType<typeof prisma.attendance.findMany>>;
type BehaviorIncidentList = Awaited<ReturnType<typeof prisma.behaviorIncident.findMany>>;
type HomeworkSubmissionList = Awaited<ReturnType<typeof prisma.homeworkSubmission.findMany>>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("predictNextPeriodGrade", () => {
  it("sans aucune moyenne passée : aucune prévision (jamais un 10/20 inventé)", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([]);

    const result = await predictNextPeriodGrade("s1");

    expect(result.modelUsed).toBe("none");
    expect(result.predicted).toBeNull();
    expect(result.range).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.warning).toContain("Aucune moyenne");
  });

  it("lit l'historique dans l'ordre des dates de période (plusieurs années)", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([]);
    await predictNextPeriodGrade("s1");
    expect(vi.mocked(prisma.gradeHistory.findMany).mock.calls[0][0]).toMatchObject({
      where: { studentId: "s1", subjectId: null },
      orderBy: [{ period: { startDate: "asc" } }, { period: { sequence: "asc" } }],
    });
  });

  it("historique court : prévision lissée, fourchette large et signalée", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([
      { average: 13 },
      { average: 14 },
    ] as unknown as GradeHistoryList);

    const result = await predictNextPeriodGrade("s1");

    // Lissage 0,6 : 0,6 × 14 + 0,4 × 13 = 13,6 ; écart-type a priori 1,8 (poids 3) + l'écart observé
    expect(result.modelUsed).toBe("exponential_smoothing");
    expect(result.predicted).toBe(13.6);
    expect(result.range).toEqual({ min: 10.71, max: 16.49 });
    expect(result.range80).toEqual({ min: 11.71, max: 15.49 });
    expect(result.confidence).toBe(50); // chances d'être à ±1 point
    expect(result.dataPoints).toBe(2);
    expect(result.warning).toContain("Historique court");
  });

  it("progression régulière : suit la hausse sans l'extrapoler aveuglément", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue(
      [10, 11, 12, 13, 14].map((average) => ({ average })) as unknown as GradeHistoryList
    );

    const result = await predictNextPeriodGrade("s1");

    expect(result.predicted).toBe(13.35);
    expect(result.range).toEqual({ min: 10.54, max: 16.16 });
    expect(result.confidence).toBe(51);
    expect(result.warning).toBeUndefined();
  });

  it("résultats réguliers : fourchette plus serrée, confiance plus haute", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue(
      [12, 12, 12, 12].map((average) => ({ average })) as unknown as GradeHistoryList
    );

    const result = await predictNextPeriodGrade("s1");

    expect(result.predicted).toBe(12);
    expect(result.range).toEqual({ min: 9.75, max: 14.25 });
    expect(result.confidence).toBe(62);
  });

  it("borne la prédiction dans [0, 20]", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue(
      [16, 17.5, 19, 19.5, 20].map((average, index) => ({
        average,
        period: { sequence: index + 1 },
      })) as unknown as GradeHistoryList
    );

    const result = await predictNextPeriodGrade("s1");
    expect(result.predicted).toBeLessThanOrEqual(20);
    expect(result.range?.max).toBeLessThanOrEqual(20);
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
      })) as unknown as StudentAnalyticsList
    );
    vi.mocked(prisma.attendance.findMany).mockResolvedValue(
      [
        ...Array.from({ length: presentDays }, () => ({ status: "PRESENT" })),
        ...Array.from({ length: absentDays }, () => ({ status: "ABSENT" })),
      ] as unknown as AttendanceList
    );
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue(incidents as unknown as BehaviorIncidentList);
    vi.mocked(prisma.homeworkSubmission.findMany).mockResolvedValue(
      Array.from({ length: submittedHomeworks }, () => ({})) as unknown as HomeworkSubmissionList
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
