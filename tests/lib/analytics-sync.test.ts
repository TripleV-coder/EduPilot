import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    studentAnalytics: { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    subjectPerformance: { deleteMany: vi.fn(), upsert: vi.fn() },
    gradeHistory: { deleteMany: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    grade: { findMany: vi.fn() },
    evaluation: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    period: { findMany: vi.fn() },
    academicYear: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/services/student-analytics", () => ({
  generateStudentAnalytics: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { generateStudentAnalytics } from "@/lib/services/student-analytics";
import {
  persistStudentAnalyticsSnapshot,
  syncAnalyticsAfterGradeChange,
  syncAnalyticsForClassPeriod,
  syncAllStudentsForSchool,
} from "@/lib/services/analytics-sync";
import type {
  Prisma,
  StudentAnalytics,
  SubjectPerformance,
  GradeHistory,
  Evaluation,
  Enrollment,
  Period,
} from "@prisma/client";

type AnalyticsUpsertResult = Awaited<ReturnType<typeof prisma.studentAnalytics.upsert>>;
type AnalyticsFindUniqueResult = Awaited<ReturnType<typeof prisma.studentAnalytics.findUnique>>;
type AnalyticsListResult = Awaited<ReturnType<typeof prisma.studentAnalytics.findMany>>;
type BatchResult = Awaited<ReturnType<typeof prisma.subjectPerformance.deleteMany>>;
type SubjectPerfUpsertResult = Awaited<ReturnType<typeof prisma.subjectPerformance.upsert>>;
type GradeHistoryCreateResult = Awaited<ReturnType<typeof prisma.gradeHistory.create>>;
type GradeHistoryUpsertResult = Awaited<ReturnType<typeof prisma.gradeHistory.upsert>>;
type AnalyticsSnapshotResult = Awaited<ReturnType<typeof generateStudentAnalytics>>;
type EvaluationFindUniqueResult = Awaited<ReturnType<typeof prisma.evaluation.findUnique>>;
type EnrollmentListResult = Awaited<ReturnType<typeof prisma.enrollment.findMany>>;
type PeriodListResult = Awaited<ReturnType<typeof prisma.period.findMany>>;

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    studentId: "s1",
    periodId: "p1",
    academicYearId: "y1",
    generalAverage: 12.5,
    classRank: 3,
    classSize: 25,
    performanceLevel: "GOOD",
    progressionRate: 4.2,
    consistencyRate: 81,
    riskLevel: "LOW",
    riskFactors: [],
    subjectPerformances: [
      {
        subjectId: "math",
        average: 14,
        gradesCount: 4,
        min: 10,
        max: 17,
        standardDev: 2.1,
        isStrength: true,
        isWeakness: false,
        trend: "INCREASE",
        progressionRate: 6,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.studentAnalytics.upsert).mockResolvedValue({ id: "an1" } as unknown as StudentAnalytics);
  vi.mocked(prisma.studentAnalytics.findUnique).mockResolvedValue({ id: "an1" } as unknown as StudentAnalytics);
  vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValue([] as unknown as StudentAnalytics[]);
  vi.mocked(prisma.subjectPerformance.deleteMany).mockResolvedValue({ count: 0 } as unknown as Prisma.BatchPayload);
  vi.mocked(prisma.subjectPerformance.upsert).mockResolvedValue({} as unknown as SubjectPerformance);
  vi.mocked(prisma.gradeHistory.deleteMany).mockResolvedValue({ count: 0 } as unknown as Prisma.BatchPayload);
  vi.mocked(prisma.gradeHistory.create).mockResolvedValue({} as unknown as GradeHistory);
  vi.mocked(prisma.gradeHistory.upsert).mockResolvedValue({} as unknown as GradeHistory);
});

describe("persistStudentAnalyticsSnapshot", () => {
  it("upsert le snapshot, les performances matière et l'historique de notes", async () => {
    vi.mocked(generateStudentAnalytics).mockResolvedValue(snapshot() as unknown as AnalyticsSnapshotResult);

    const result = await persistStudentAnalyticsSnapshot("s1", "p1", "y1");

    // Snapshot principal
    const upsertArgs = vi.mocked(prisma.studentAnalytics.upsert).mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ studentId_periodId: { studentId: "s1", periodId: "p1" } });
    expect(upsertArgs.create).toMatchObject({ generalAverage: 12.5, riskLevel: "LOW" });

    // Performance matière upsertée sous l'analytics créé
    expect(vi.mocked(prisma.subjectPerformance.upsert).mock.calls[0][0]).toMatchObject({
      where: { analyticsId_subjectId: { analyticsId: "an1", subjectId: "math" } },
    });

    // Historique : moyenne générale (subjectId null) recréée + moyenne matière upsertée
    expect(vi.mocked(prisma.gradeHistory.create).mock.calls[0][0].data).toMatchObject({
      studentId: "s1",
      subjectId: null,
      average: 12.5,
      rank: 3,
    });
    expect(vi.mocked(prisma.gradeHistory.upsert).mock.calls[0][0]).toMatchObject({
      where: {
        studentId_subjectId_periodId: { studentId: "s1", subjectId: "math", periodId: "p1" },
      },
    });

    expect(result).toEqual({ id: "an1" });
  });

  it("sans moyenne générale : pas de ligne d'historique générale", async () => {
    vi.mocked(generateStudentAnalytics).mockResolvedValue(
      snapshot({ generalAverage: null, subjectPerformances: [] }) as unknown as AnalyticsSnapshotResult
    );

    await persistStudentAnalyticsSnapshot("s1", "p1", "y1");

    expect(prisma.gradeHistory.create).not.toHaveBeenCalled();
    // Sans matière active, l'historique par matière est purgé
    expect(prisma.gradeHistory.deleteMany).toHaveBeenCalledWith({
      where: { studentId: "s1", periodId: "p1", subjectId: { not: null } },
    });
    // Et les performances orphelines aussi
    expect(prisma.subjectPerformance.deleteMany).toHaveBeenCalledWith({
      where: { analyticsId: "an1" },
    });
  });
});

describe("syncAnalyticsAfterGradeChange", () => {
  it("ne fait rien si l'évaluation est introuvable", async () => {
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(null);

    await syncAnalyticsAfterGradeChange("ev1", ["s1"]);
    expect(generateStudentAnalytics).not.toHaveBeenCalled();
  });

  it("synchronise chaque élève (dédupliqué) sur la période de l'évaluation puis les périodes futures", async () => {
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue({
      periodId: "p1",
      period: { academicYearId: "y1", sequence: 1 },
    } as unknown as Evaluation);
    vi.mocked(generateStudentAnalytics).mockResolvedValue(snapshot() as unknown as AnalyticsSnapshotResult);
    // Une analytics future existante pour s1 → re-synchronisée
    vi.mocked(prisma.studentAnalytics.findMany).mockResolvedValueOnce([
      { studentId: "s1", periodId: "p2" },
    ] as unknown as StudentAnalytics[]);

    await syncAnalyticsAfterGradeChange("ev1", ["s1", "s2", "s1"]);

    const calls = vi.mocked(generateStudentAnalytics).mock.calls;
    // 2 élèves uniques sur p1 + 1 resync future (s1, p2)
    expect(calls).toHaveLength(3);
    expect(calls).toEqual(
      expect.arrayContaining([
        ["s1", "p1", "y1"],
        ["s2", "p1", "y1"],
        ["s1", "p2", "y1"],
      ])
    );
    // La recherche des périodes futures filtre par sequence > 1
    expect(vi.mocked(prisma.studentAnalytics.findMany).mock.calls[0][0].where).toMatchObject({
      period: { sequence: { gt: 1 } },
    });
  });
});

describe("syncAnalyticsForClassPeriod", () => {
  it("synchronise tous les inscrits actifs de la classe", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: "s1" },
      { studentId: "s2" },
    ] as unknown as Enrollment[]);
    vi.mocked(generateStudentAnalytics).mockResolvedValue(snapshot() as unknown as AnalyticsSnapshotResult);

    await syncAnalyticsForClassPeriod("cl1", "p1", "y1");

    expect(generateStudentAnalytics).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.enrollment.findMany).mock.calls[0][0].where).toMatchObject({
      classId: "cl1",
      status: "ACTIVE",
    });
  });
});

describe("syncAllStudentsForSchool", () => {
  it("compte les succès et les erreurs sans interrompre la boucle", async () => {
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { studentId: "s1", classId: "cl1" },
      { studentId: "s2", classId: "cl1" },
    ] as unknown as Enrollment[]);
    vi.mocked(prisma.period.findMany).mockResolvedValue([{ id: "p1" }] as unknown as Period[]);
    vi.mocked(generateStudentAnalytics)
      .mockResolvedValueOnce(snapshot() as unknown as AnalyticsSnapshotResult)
      .mockRejectedValueOnce(new Error("boom"));

    const result = await syncAllStudentsForSchool("school1", "y1");

    expect(result).toEqual({ processed: 1, errors: 1 });
  });
});
