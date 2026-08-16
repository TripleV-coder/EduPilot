import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    gradeHistory: { findMany: vi.fn() },
    attendance: { findMany: vi.fn() },
    behaviorIncident: { findMany: vi.fn() },
    homeworkSubmission: { findMany: vi.fn() },
    homework: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { mulberry32, seedFromId, rngFromId } from "@/lib/services/ai-predictive/algorithms/rng";
import { bootstrapConfidenceInterval } from "@/lib/services/ai-predictive/algorithms/statistics";
import { predictDropoutRisk } from "@/lib/services/ai-predictive/predict-dropout";
import { detectEarlyWarnings, EARLY_WARNING_THRESHOLDS } from "@/lib/services/ai-predictive/detect-early-warning";
import { predictBehaviorRisk } from "@/lib/services/ai-predictive/predict-behavior";

type GradeHistoryList = Awaited<ReturnType<typeof prisma.gradeHistory.findMany>>;
type AttendanceList = Awaited<ReturnType<typeof prisma.attendance.findMany>>;
type BehaviorIncidentList = Awaited<ReturnType<typeof prisma.behaviorIncident.findMany>>;
type HomeworkSubmissionList = Awaited<ReturnType<typeof prisma.homeworkSubmission.findMany>>;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

beforeEach(() => {
  vi.clearAllMocks();
  // Défauts vides pour toutes les sources (évite les undefined)
  vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([]);
  vi.mocked(prisma.attendance.findMany).mockResolvedValue([]);
  vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([]);
  vi.mocked(prisma.homeworkSubmission.findMany).mockResolvedValue([]);
  vi.mocked(prisma.homework.count).mockResolvedValue(0);
});

// ============================================================
// Déterminisme (RNG)
// ============================================================
describe("RNG déterministe", () => {
  it("mulberry32 produit la même séquence pour un même seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("seedFromId est stable et distinct selon l'identifiant", () => {
    expect(seedFromId("student-1")).toBe(seedFromId("student-1"));
    expect(seedFromId("student-1")).not.toBe(seedFromId("student-2"));
  });

  it("bootstrap est reproductible avec un RNG seedé", () => {
    const values = [12, 13, 11, 14, 10, 15];
    const r1 = bootstrapConfidenceInterval(values, 0.95, 200, rngFromId("s1"));
    const r2 = bootstrapConfidenceInterval(values, 0.95, 200, rngFromId("s1"));
    expect(r1).toEqual(r2);
  });

  it("valeurs bornées dans [0,1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ============================================================
// predictDropoutRisk
// ============================================================
describe("predictDropoutRisk", () => {
  it("élève engagé → risque TRÈS FAIBLE, aucun signal", async () => {
    vi.mocked(prisma.attendance.findMany).mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ status: "PRESENT", date: daysAgo(i + 1) })) as unknown as AttendanceList
    );
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([
      { average: 13 }, { average: 13.5 }, { average: 14 },
    ] as unknown as GradeHistoryList);
    vi.mocked(prisma.homeworkSubmission.findMany).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ createdAt: daysAgo(i + 1) })) as unknown as HomeworkSubmissionList
    );
    vi.mocked(prisma.homework.count).mockResolvedValue(5);

    const result = await predictDropoutRisk("s1");

    expect(result.level).toBe("TRÈS FAIBLE");
    expect(result.probability).toBeLessThan(15);
    expect(result.signals).toEqual([]);
    expect(result.dataQuality).toBe("HIGH");
  });

  it("assiduité qui se dégrade → signal d'assiduité dominant", async () => {
    // Fenêtre récente (0-30j) : beaucoup d'absences ; fenêtre précédente : peu
    const recent = Array.from({ length: 20 }, (_, i) => ({
      status: i < 14 ? "ABSENT" : "PRESENT",
      date: daysAgo(i + 1),
    }));
    const prior = Array.from({ length: 20 }, (_, i) => ({
      status: "PRESENT",
      date: daysAgo(i + 31),
    }));
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([...recent, ...prior] as unknown as AttendanceList);

    const result = await predictDropoutRisk("s1");

    expect(result.probability).toBeGreaterThan(15);
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.signals.map((s) => s.factor)).toContain("assiduite_en_deterioration");
    // signaux triés par contribution décroissante
    const contribs = result.signals.map((s) => s.contribution);
    expect(contribs).toEqual([...contribs].sort((a, b) => b - a));
  });

  it("aucune donnée → défaut sûr sans exception", async () => {
    const result = await predictDropoutRisk("s1");
    expect(result.probability).toBe(0);
    expect(result.level).toBe("TRÈS FAIBLE");
    expect(result.dataQuality).toBe("LOW");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("est déterministe (même entrée → même sortie)", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([
      { average: 14 }, { average: 12 }, { average: 9 },
    ] as unknown as GradeHistoryList);
    const a = await predictDropoutRisk("s1");
    const b = await predictDropoutRisk("s1");
    expect(a).toEqual(b);
  });
});

// ============================================================
// detectEarlyWarnings
// ============================================================
describe("detectEarlyWarnings", () => {
  it("aucun signal → tableau vide", async () => {
    const result = await detectEarlyWarnings("s1");
    expect(result).toEqual([]);
  });

  it("GRADE_DROP : chute brutale de la dernière moyenne", async () => {
    vi.mocked(prisma.gradeHistory.findMany).mockResolvedValue([
      { average: 14 }, { average: 14 }, { average: 13.5 }, { average: 8 },
    ] as unknown as GradeHistoryList);

    const result = await detectEarlyWarnings("s1");
    const gradeDrop = result.find((w) => w.type === "GRADE_DROP");
    expect(gradeDrop).toBeDefined();
    expect(gradeDrop!.value).toBeGreaterThanOrEqual(EARLY_WARNING_THRESHOLDS.gradeDropPoints);
  });

  it("ATTENDANCE_CLIFF : 3 absences non justifiées consécutives", async () => {
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([
      { status: "PRESENT", date: daysAgo(6) },
      { status: "ABSENT", date: daysAgo(5) },
      { status: "ABSENT", date: daysAgo(4) },
      { status: "ABSENT", date: daysAgo(3) },
    ] as unknown as AttendanceList);

    const result = await detectEarlyWarnings("s1");
    const cliff = result.find((w) => w.type === "ATTENDANCE_CLIFF");
    expect(cliff).toBeDefined();
    expect(cliff!.value).toBe(3);
    expect(cliff!.since).not.toBeNull();
  });

  it("ATTENDANCE_CLIFF : 2 absences ne déclenchent pas", async () => {
    vi.mocked(prisma.attendance.findMany).mockResolvedValue([
      { status: "ABSENT", date: daysAgo(4) },
      { status: "ABSENT", date: daysAgo(3) },
      { status: "PRESENT", date: daysAgo(2) },
    ] as unknown as AttendanceList);

    const result = await detectEarlyWarnings("s1");
    expect(result.find((w) => w.type === "ATTENDANCE_CLIFF")).toBeUndefined();
  });

  it("HOMEWORK_STOP : 0 rendu alors que des devoirs étaient dus", async () => {
    vi.mocked(prisma.homeworkSubmission.findMany).mockResolvedValue([]);
    vi.mocked(prisma.homework.count).mockResolvedValue(3);

    const result = await detectEarlyWarnings("s1");
    const stop = result.find((w) => w.type === "HOMEWORK_STOP");
    expect(stop).toBeDefined();
    expect(stop!.value).toBe(3);
  });

  it("BEHAVIOR_SPIKE : 2 incidents graves dans la fenêtre", async () => {
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([
      { severity: "HIGH", date: daysAgo(5) },
      { severity: "CRITICAL", date: daysAgo(2) },
    ] as unknown as BehaviorIncidentList);

    const result = await detectEarlyWarnings("s1");
    const spike = result.find((w) => w.type === "BEHAVIOR_SPIKE");
    expect(spike).toBeDefined();
    expect(spike!.severity).toBe("CRITICAL");
  });
});

// ============================================================
// predictBehaviorRisk (refonte)
// ============================================================
describe("predictBehaviorRisk", () => {
  it("aucun incident → risque très faible, structure enrichie", async () => {
    const result = await predictBehaviorRisk("s1");
    expect(result.probability).toBe(5);
    expect(result.causalFactors).toEqual([]);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.dataQuality).toBe("LOW");
  });

  it("incidents critiques récents → probabilité élevée + facteurs causaux", async () => {
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([
      { severity: "CRITICAL", date: daysAgo(2) },
      { severity: "CRITICAL", date: daysAgo(5) },
      { severity: "HIGH", date: daysAgo(10) },
    ] as unknown as BehaviorIncidentList);

    const result = await predictBehaviorRisk("s1");

    expect(result.probability).toBeGreaterThan(40);
    expect(result.causalFactors.length).toBeGreaterThan(0);
    expect(result.causalFactors[0].factor).toBe("incidents_critiques");
    // facteurs triés par contribution décroissante
    const contribs = result.causalFactors.map((f) => f.contribution);
    expect(contribs).toEqual([...contribs].sort((a, b) => b - a));
    expect(result.recommendations.join(" ")).toContain("conseiller d'éducation");
  });

  it("est déterministe", async () => {
    vi.mocked(prisma.behaviorIncident.findMany).mockResolvedValue([
      { severity: "HIGH", date: daysAgo(3) },
      { severity: "MEDIUM", date: daysAgo(20) },
    ] as unknown as BehaviorIncidentList);
    const a = await predictBehaviorRisk("s1");
    const b = await predictBehaviorRisk("s1");
    expect(a).toEqual(b);
  });
});
