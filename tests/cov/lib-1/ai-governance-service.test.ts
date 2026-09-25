import { describe, it, expect, vi, beforeEach } from "vitest";

const env = vi.hoisted(() => ({ ai: { enabled: false, hasExternalKeys: false } }));

vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
    class: { findUnique: vi.fn(), count: vi.fn() },
    studentAnalytics: { findFirst: vi.fn(), findMany: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    period: { findFirst: vi.fn() },
    attendance: { findMany: vi.fn() },
    behaviorIncident: { findMany: vi.fn() },
    payment: { aggregate: vi.fn() },
    enrollment: { findMany: vi.fn() },
    gradeHistory: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/env", () => ({ appEnv: env }));
vi.mock("@/lib/analytics/service", () => ({ analyticsService: { getSchoolStats: vi.fn() } }));
vi.mock("@/lib/services/analytics-sync", () => ({ persistStudentAnalyticsSnapshot: vi.fn() }));
vi.mock("@/lib/services/ai-predictive", () => ({ generateStudentPredictions: vi.fn() }));
vi.mock("@/lib/services/ai-predictive/predict-failure", () => ({ predictFailureRisk: vi.fn() }));
vi.mock("@/lib/ai/external-client", () => ({ callExternalAI: vi.fn() }));
vi.mock("@/lib/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import prisma from "@/lib/prisma";
import { governanceService, hasExternalAIConfigured } from "@/lib/ai/governance-service";
import { analyticsService } from "@/lib/analytics/service";
import { persistStudentAnalyticsSnapshot } from "@/lib/services/analytics-sync";
import { generateStudentPredictions } from "@/lib/services/ai-predictive";
import { predictFailureRisk } from "@/lib/services/ai-predictive/predict-failure";
import { callExternalAI } from "@/lib/ai/external-client";
import { logger } from "@/lib/utils/logger";

/** Charge JSON inspectée librement dans les assertions (forme = sortie de JSON.parse). */
type Json = { [key: string]: ReturnType<typeof JSON.parse> };
type Req = Parameters<typeof governanceService.execute>[0];
const SCHOOL = "school-a";
const m = <T>(fn: T) => vi.mocked(fn as unknown as (...args: unknown[]) => unknown);

function req(overrides: Partial<Req>): Req {
  return { action: "analyze-student", userId: "u-1", userRole: "SCHOOL_ADMIN", schoolId: SCHOOL, ...overrides } as Req;
}

async function run(r: Req) {
  return governanceService.execute(r, Date.now());
}

async function failure(r: Req) {
  try {
    await run(r);
    return null;
  } catch (e) {
    const err = e as { code?: string; status?: number; message?: string };
    return { code: err.code, status: err.status, message: err.message };
  }
}

function setExternal(on: boolean) {
  env.ai.enabled = on;
  env.ai.hasExternalKeys = on;
}

/** Analyse individuelle (forme analyticsInclude). */
function studentAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    studentId: "stu-1",
    generalAverage: 9.5,
    classRank: 12,
    classSize: 30,
    performanceLevel: "INSUFFICIENT",
    consistencyRate: 60,
    progressionRate: -1.2,
    riskLevel: "HIGH",
    riskFactors: ["Moyenne faible"],
    period: { id: "p-1", name: "Trimestre 1", sequence: 1 },
    academicYear: { id: "ay-1", name: "2025-2026" },
    subjectPerformances: [
      { subjectId: "sub-m", average: 7, trend: "DOWN", progressionRate: -2, isStrength: false, isWeakness: true, subject: { id: "sub-m", name: "Maths", code: "M" } },
      { subjectId: "sub-f", average: null, trend: null, progressionRate: null, isStrength: true, isWeakness: false, subject: { id: "sub-f", name: "Français", code: "F" } },
    ],
    ...overrides,
  };
}

/** Ligne d'analyse établissement/classe (forme schoolAnalyticsInclude). */
function row(studentId: string, riskLevel: string, generalAverage: number | null, opts: { className?: string | null; firstName?: string; seq?: number } = {}) {
  return {
    studentId,
    riskLevel,
    generalAverage,
    classRank: 1,
    riskFactors: [`facteur-${studentId}`],
    period: { id: "p", name: "T", sequence: opts.seq ?? 1 },
    analyzedAt: null,
    createdAt: null,
    student: {
      id: studentId,
      userId: `u-${studentId}`,
      schoolId: SCHOOL,
      user: opts.firstName === undefined ? { firstName: studentId.toUpperCase(), lastName: "Nom" } : { firstName: opts.firstName, lastName: null },
      enrollments: opts.className === null ? [] : [{ class: { id: "c", name: opts.className ?? "6e A" } }],
    },
  };
}

const studentRecord = {
  id: "stu-1",
  userId: "user-stu-1",
  schoolId: SCHOOL,
  matricule: "MAT-1",
  user: { firstName: "Koffi", lastName: "Adjovi" },
  enrollments: [{ class: { id: "cl-1", name: "3e A" }, academicYear: { id: "ay-1", name: "2025-2026" } }],
};

beforeEach(() => {
  vi.clearAllMocks();
  setExternal(false);
  m(prisma.attendance.findMany).mockResolvedValue([]);
  m(prisma.behaviorIncident.findMany).mockResolvedValue([]);
  m(prisma.studentAnalytics.findMany).mockResolvedValue([]);
  m(prisma.enrollment.findMany).mockResolvedValue([]);
  m(prisma.gradeHistory.findMany).mockResolvedValue([]);
  m(prisma.academicYear.findFirst).mockResolvedValue(null);
});

describe("gouvernance IA — aiguillage", () => {
  it("refuse une action inconnue (400 INVALID_ACTION)", async () => {
    expect(await failure(req({ action: "hack" }))).toMatchObject({ code: "INVALID_ACTION", status: 400, message: "Action IA non prise en charge: hack" });
  });

  it("indique si l'IA externe est configurée (activée ET clés présentes)", () => {
    expect(hasExternalAIConfigured()).toBe(false);
    env.ai.enabled = true;
    expect(hasExternalAIConfigured()).toBe(false);
    env.ai.hasExternalKeys = true;
    expect(hasExternalAIConfigured()).toBe(true);
  });

  it.each([
    ["analyze-student", "MISSING_STUDENT_ID"],
    ["predict-grades", "MISSING_STUDENT_ID"],
    ["recommend-orientation", "MISSING_STUDENT_ID"],
    ["analyze-risk", "MISSING_STUDENT_ID"],
    ["generate-action-plan", "MISSING_STUDENT_ID"],
    ["draft-report-comment", "MISSING_STUDENT_ID"],
    ["analyze-class", "MISSING_CLASS_ID"],
  ])("exige l'identifiant cible pour %s", async (action, code) => {
    expect(await failure(req({ action, studentId: "", classId: "", data: { studentId: 3, classId: "" } }))).toMatchObject({ code, status: 400 });
  });

  it.each(["analyze-student", "predict-grades", "recommend-orientation", "analyze-risk", "generate-action-plan", "draft-report-comment"])(
    "renvoie 404 quand l'élève n'existe pas (%s)",
    async (action) => {
      m(prisma.studentProfile.findUnique).mockResolvedValueOnce(null);
      expect(await failure(req({ action, data: { studentId: "absent" } }))).toMatchObject({ code: "STUDENT_NOT_FOUND", status: 404 });
      expect(prisma.studentProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "absent" } }));
    }
  );

  it.each(["analyze-class", "detect-at-risk"])("renvoie 404 quand la classe n'existe pas (%s)", async (action) => {
    m(prisma.class.findUnique).mockResolvedValueOnce(null);
    expect(await failure(req({ action, data: { classId: "c-x" } }))).toMatchObject({ code: "CLASS_NOT_FOUND", status: 404 });
  });

  it("refuse l'accès à un élève d'un autre établissement", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce({ ...studentRecord, schoolId: "school-b" });
    expect(await failure(req({ studentId: "stu-1" }))).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("gouvernance IA — analyse d'un élève", () => {
  it("assemble métriques, forces/faiblesses, prédiction et recommandations dédoublonnées", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics());
    m(prisma.attendance.findMany).mockResolvedValueOnce([{ status: "PRESENT" }, { status: "LATE" }, { status: "ABSENT" }]);
    m(prisma.behaviorIncident.findMany).mockResolvedValueOnce([{ severity: "LOW", description: "retard" }]);
    m(predictFailureRisk).mockResolvedValueOnce({
      probability: 62,
      level: "HIGH",
      factors: ["notes"],
      causalFactors: [{ factor: "notes" }],
      recommendations: ["Tutorat", "Renforcer les matières faibles: Maths."],
    });

    const res = await run(req({ studentId: "stu-1" }));
    const data = res.data as Json;
    expect(res).toMatchObject({ success: true, action: "analyze-student", confidence: 0.88, alerts: [] });
    expect(res.executionTime).toBeGreaterThanOrEqual(0);
    expect(res.recommendations).toEqual([
      "Tutorat",
      "Renforcer les matières faibles: Maths.",
      "Améliorer l'assiduité pour réduire le risque académique.",
    ]);
    expect(data.status).toBe("analyzed");
    expect(data.student).toEqual({ id: "stu-1", name: "Koffi Adjovi", matricule: "MAT-1", class: { id: "cl-1", name: "3e A" }, academicYear: { id: "ay-1", name: "2025-2026" } });
    expect(data.analyticsPeriod).toEqual({ periodId: "p-1", periodName: "Trimestre 1", academicYearId: "ay-1", academicYearName: "2025-2026" });
    expect(data.metrics).toMatchObject({ averageGrade: 9.5, attendanceRate: 66.67, consistencyRate: 60, progressionRate: -1.2, riskLevel: "HIGH", incidentCount: 1 });
    expect(data.strengths).toEqual(["Français"]);
    expect(data.weaknesses).toEqual(["Maths"]);
    expect(data.subjectPerformance[1]).toMatchObject({ subjectName: "Français", average: null, progressionRate: null });
    expect(data.prediction).toEqual({ probability: 62, level: "HIGH", factors: ["notes"], causalFactors: [{ factor: "notes" }] });
  });

  it("signale des données insuffisantes et tolère l'échec de la prédiction", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce({ ...studentRecord, user: null, enrollments: [] });
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(null);
    m(predictFailureRisk).mockRejectedValueOnce("indisponible");

    const res = await run(req({ userRole: "STUDENT", userId: "user-stu-1", data: { studentId: "stu-1" } }));
    const data = res.data as Json;
    expect(res.confidence).toBe(0.45);
    expect(res.recommendations).toEqual([]);
    expect(data.status).toBe("insufficient_data");
    expect(data.student).toMatchObject({ name: "", class: null, academicYear: null });
    expect(data.analyticsPeriod).toBeNull();
    expect(data.prediction).toBeNull();
    expect(data.metrics).toMatchObject({ averageGrade: null, attendanceRate: null, consistencyRate: null, progressionRate: null, riskFactors: [], classRank: null });
    expect(data.subjectPerformance).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith("AI student failure prediction unavailable", expect.objectContaining({ error: "indisponible" }));
  });

  it("journalise le message d'une Error levée par la prédiction et gère les métriques nulles", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(
      studentAnalytics({ generalAverage: null, consistencyRate: null, progressionRate: null, subjectPerformances: [] })
    );
    m(prisma.attendance.findMany).mockResolvedValueOnce([{ status: "PRESENT" }]);
    m(predictFailureRisk).mockRejectedValueOnce(new Error("modèle absent"));
    const res = await run(req({ studentId: "stu-1" }));
    expect((res.data as Json).metrics).toMatchObject({ averageGrade: null, attendanceRate: 100, consistencyRate: null, progressionRate: null });
    expect(res.recommendations).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith("AI student failure prediction unavailable", expect.objectContaining({ error: "modèle absent" }));
  });

  it("rafraîchit l'instantané analytique quand aucune analyse n'existe (année la plus récente)", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce(studentAnalytics());
    m(prisma.academicYear.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "ay-old" });
    m(prisma.period.findFirst).mockResolvedValueOnce({ id: "p-9" });
    m(persistStudentAnalyticsSnapshot).mockResolvedValueOnce(undefined);
    m(predictFailureRisk).mockResolvedValueOnce(null);

    const res = await run(req({ studentId: "stu-1" }));
    expect(persistStudentAnalyticsSnapshot).toHaveBeenCalledWith("stu-1", "p-9", "ay-old");
    expect((res.data as Json).status).toBe("analyzed");
  });

  it("poursuit malgré l'échec du rafraîchissement (année courante, erreur non-Error)", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(null);
    m(prisma.academicYear.findFirst).mockResolvedValueOnce({ id: "ay-cur" });
    m(prisma.period.findFirst).mockResolvedValueOnce({ id: "p-1" });
    m(persistStudentAnalyticsSnapshot).mockRejectedValueOnce("verrou");
    m(predictFailureRisk).mockResolvedValueOnce(null);

    const res = await run(req({ studentId: "stu-1" }));
    expect((res.data as Json).status).toBe("insufficient_data");
    expect(logger.warn).toHaveBeenCalledWith(
      "Unable to refresh student analytics snapshot for AI governance",
      expect.objectContaining({ academicYearId: "ay-cur", periodId: "p-1", error: "verrou" })
    );
  });

  it("journalise le message d'une Error de rafraîchissement ; sans période, ne rafraîchit pas", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(null);
    m(prisma.academicYear.findFirst).mockResolvedValue({ id: "ay-cur" });
    m(prisma.period.findFirst).mockResolvedValueOnce({ id: "p-1" }).mockResolvedValueOnce(null);
    m(persistStudentAnalyticsSnapshot).mockRejectedValueOnce(new Error("timeout"));
    m(predictFailureRisk).mockResolvedValue(null);

    await run(req({ studentId: "stu-1" }));
    expect(logger.warn).toHaveBeenCalledWith("Unable to refresh student analytics snapshot for AI governance", expect.objectContaining({ error: "timeout" }));
    await run(req({ studentId: "stu-1" }));
    expect(persistStudentAnalyticsSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("gouvernance IA — analyse d'une classe", () => {
  const classRecord = {
    id: "cl-1",
    name: "6e A",
    schoolId: SCHOOL,
    classLevel: { name: "6e", level: 6 },
    enrollments: [
      { studentId: "a", academicYearId: "ay-1" },
      { studentId: "b", academicYearId: "ay-1" },
      { studentId: "c", academicYearId: "ay-1" },
      { studentId: "d", academicYearId: "ay-1" },
      { studentId: "e", academicYearId: "ay-1" },
    ],
  };

  it("calcule moyenne, assiduité, élèves à risque triés et alertes", async () => {
    m(prisma.class.findUnique).mockResolvedValueOnce(classRecord);
    m(prisma.studentAnalytics.findMany).mockResolvedValueOnce([
      row("a", "LOW", 12),
      row("b", "HIGH", 8, { className: null }),
      row("c", "CRITICAL", 5),
      row("d", "HIGH", null),
      row("e", "MEDIUM", 9),
      row("f", "HIGH", 7),
    ]);
    m(prisma.attendance.findMany).mockResolvedValueOnce([{ status: "ABSENT" }, { status: "PRESENT" }]);

    const res = await run(req({ action: "analyze-class", classId: "cl-1" }));
    const data = res.data as Json;
    expect(prisma.studentAnalytics.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: { in: ["a", "b", "c", "d", "e"] }, student: { schoolId: SCHOOL }, academicYearId: "ay-1" } })
    );
    expect(res.confidence).toBe(0.84);
    expect(data.status).toBe("analyzed");
    expect(data.class).toEqual({ id: "cl-1", name: "6e A", level: { name: "6e", level: 6 } });
    expect(data.totals).toEqual({ activeStudents: 5, analyticsCoverage: 6 });
    expect(data.metrics).toEqual({ classAverage: 8.2, attendanceRate: 50, atRiskCount: 5, criticalRiskCount: 1 });
    expect(data.distribution.riskLevels).toEqual({ LOW: 1, HIGH: 3, CRITICAL: 1, MEDIUM: 1 });
    // Tri : gravité décroissante puis moyenne croissante (inconnue en dernier).
    expect(data.atRiskStudents.map((s: { id: string }) => s.id)).toEqual(["c", "f", "b", "d", "e"]);
    // Sans inscription active, la classe courante sert de libellé.
    expect(data.atRiskStudents[2].className).toBe("6e A");
    expect(data.topStudents.map((s: { id: string }) => s.id)).toEqual(["a", "e", "b", "f", "c"]);
    expect(res.recommendations).toEqual([
      "La moyenne de classe est insuffisante: prévoir un plan de remédiation.",
      "Le taux d'assiduité de la classe est faible: renforcer le suivi des absences.",
      "Prioriser un suivi ciblé pour 5 élèves à risque.",
    ]);
    expect(res.alerts?.[0]).toMatchObject({ id: "risk_c", type: "critical" });
  });

  it("bascule sur toutes les années quand l'année ciblée n'a pas d'analyse (plusieurs années)", async () => {
    m(prisma.class.findUnique).mockResolvedValueOnce({
      ...classRecord,
      enrollments: [
        { studentId: "a", academicYearId: "ay-1" },
        { studentId: "b", academicYearId: "ay-2" },
      ],
    });
    m(prisma.studentAnalytics.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([row("a", "LOW", 15, { seq: 1 }), row("a", "LOW", 16, { seq: 2 })]);

    const res = await run(req({ action: "analyze-class", data: { classId: "cl-1" } }));
    expect(vi.mocked(prisma.studentAnalytics.findMany).mock.calls[0][0]).toMatchObject({ where: { academicYearId: { in: ["ay-1", "ay-2"] } } });
    expect(vi.mocked(prisma.studentAnalytics.findMany).mock.calls[1][0]).toMatchObject({ where: { studentId: { in: ["a", "b"] }, student: { schoolId: SCHOOL } } });
    const data = res.data as Json;
    // Dédoublonnage : l'analyse la plus récente (séquence 2) est retenue.
    expect(data.topStudents).toEqual([{ id: "a", name: "A Nom", averageGrade: 16, classRank: 1 }]);
    expect(res.recommendations).toEqual([]);
    expect(data.metrics.attendanceRate).toBeNull();
  });

  it("signale des données insuffisantes pour une classe vide", async () => {
    m(prisma.class.findUnique).mockResolvedValueOnce({ ...classRecord, enrollments: [] });
    const res = await run(req({ action: "analyze-class", classId: "cl-1" }));
    expect(prisma.studentAnalytics.findMany).not.toHaveBeenCalled();
    expect(res.confidence).toBe(0.4);
    expect((res.data as Json).status).toBe("insufficient_data");
    expect((res.data as Json).metrics.classAverage).toBeNull();
  });

  it("refuse un enseignant sans profil ou non rattaché à la classe, accepte l'enseignant rattaché", async () => {
    const teacher = req({ action: "analyze-class", classId: "cl-1", userRole: "TEACHER" });
    m(prisma.class.findUnique).mockResolvedValue({ ...classRecord, enrollments: [] });
    m(prisma.teacherProfile.findUnique).mockResolvedValueOnce(null);
    expect(await failure(teacher)).toMatchObject({ code: "FORBIDDEN", message: "Profil enseignant introuvable" });

    m(prisma.teacherProfile.findUnique).mockResolvedValue({ id: "t-1" });
    m(prisma.class.count).mockResolvedValueOnce(0);
    expect(await failure(teacher)).toMatchObject({ code: "FORBIDDEN", message: "Accès refusé: cette classe n'est pas rattachée à cet enseignant" });

    m(prisma.class.count).mockResolvedValueOnce(1);
    expect((await run(teacher)).success).toBe(true);
    expect(prisma.class.count).toHaveBeenLastCalledWith({
      where: { id: "cl-1", OR: [{ mainTeacherId: "t-1" }, { classSubjects: { some: { teacherId: "t-1" } } }] },
    });
  });

  it("refuse un parent (rôle hors personnel)", async () => {
    m(prisma.class.findUnique).mockResolvedValueOnce(classRecord);
    expect(await failure(req({ action: "analyze-class", classId: "cl-1", userRole: "PARENT" }))).toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});

describe("gouvernance IA — analyse d'établissement", () => {
  const stats = { studentsCount: 300, teachersCount: 20, classesCount: 12 };

  it("exige un établissement", async () => {
    expect(await failure(req({ action: "analyze-school", schoolId: null }))).toMatchObject({ code: "MISSING_SCHOOL_ID" });
  });

  it("réserve l'analyse établissement à la direction", async () => {
    expect(await failure(req({ action: "analyze-school", userRole: "TEACHER" }))).toMatchObject({ code: "FORBIDDEN" });
  });

  it("consolide statistiques, revenus vérifiés et risques sur l'année courante", async () => {
    m(prisma.academicYear.findFirst).mockResolvedValueOnce({ id: "ay-1" });
    m(analyticsService.getSchoolStats).mockResolvedValueOnce(stats);
    m(prisma.payment.aggregate).mockResolvedValueOnce({ _sum: { amount: 150000 }, _count: 3 });
    m(prisma.enrollment.findMany).mockResolvedValueOnce([{ studentId: "a" }, { studentId: "b" }, { studentId: "c" }]);
    m(prisma.studentAnalytics.findMany).mockResolvedValueOnce([row("a", "CRITICAL", 6, { className: null }), row("b", "LOW", 14), row("c", "MEDIUM", 11)]);

    const res = await run(req({ action: "analyze-school", userRole: "SUPER_ADMIN", schoolId: "autre", data: { schoolId: SCHOOL } }));
    const data = res.data as Json;
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE", class: { schoolId: SCHOOL }, academicYearId: "ay-1" } }));
    expect(res.confidence).toBe(0.82);
    expect(data.totals).toEqual({ students: 300, teachers: 20, classes: 12, analyticsCoverage: 3 });
    expect(data.metrics).toEqual({ overallAverage: 10.33, atRiskCount: 2, criticalRiskCount: 1, verifiedPaymentsCount: 3, verifiedRevenue: 150000 });
    expect(data.topAtRiskStudents[0]).toMatchObject({ id: "a", className: null });
    expect(res.recommendations).toEqual(["2 élèves nécessitent un suivi renforcé à l'échelle de l'établissement."]);
  });

  it("recommande une stratégie quand le niveau est faible et qu'aucun paiement n'est vérifié (sans année)", async () => {
    m(analyticsService.getSchoolStats).mockResolvedValueOnce(stats);
    m(prisma.payment.aggregate).mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 });
    m(prisma.enrollment.findMany).mockResolvedValueOnce([{ studentId: "a" }]);
    m(prisma.studentAnalytics.findMany).mockResolvedValueOnce([row("a", "LOW", 8)]);

    const res = await run(req({ action: "analyze-school" }));
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE", class: { schoolId: SCHOOL } } }));
    expect(res.recommendations).toEqual([
      "Le niveau académique global est insuffisant: une stratégie pédagogique est nécessaire.",
      "Aucun paiement vérifié n'a été consolidé pour la période courante.",
    ]);
    expect((res.data as Json).metrics.verifiedRevenue).toBe(0);
  });

  it("signale des données insuffisantes sans analyse", async () => {
    m(analyticsService.getSchoolStats).mockResolvedValueOnce(stats);
    m(prisma.payment.aggregate).mockResolvedValueOnce({ _sum: { amount: 10 }, _count: 1 });
    const res = await run(req({ action: "analyze-school" }));
    expect(res.confidence).toBe(0.38);
    expect((res.data as Json).status).toBe("insufficient_data");
    expect((res.data as Json).metrics.overallAverage).toBeNull();
  });
});

describe("gouvernance IA — détection des élèves à risque", () => {
  it("détecte à l'échelle d'une classe", async () => {
    m(prisma.class.findUnique).mockResolvedValueOnce({ id: "cl-1", schoolId: SCHOOL, enrollments: [{ studentId: "a", academicYearId: "ay-1" }, { studentId: "b", academicYearId: "ay-1" }] });
    m(prisma.studentAnalytics.findMany).mockResolvedValueOnce([row("a", "MEDIUM", null), row("b", "HIGH", 9, { className: null })]);
    const res = await run(req({ action: "detect-at-risk", classId: "cl-1" }));
    const data = res.data as Json;
    expect(data.scope).toEqual({ type: "class", schoolId: SCHOOL, classId: "cl-1" });
    expect(data).toMatchObject({ status: "analyzed", totalStudents: 2, atRiskCount: 2, highRiskCount: 1 });
    expect(data.atRiskStudents.map((s: { id: string }) => s.id)).toEqual(["b", "a"]);
    expect(data.atRiskStudents[0].className).toBeNull();
    expect(res.confidence).toBe(0.86);
    expect(res.recommendations).toEqual(["Mettre en place un suivi individualisé pour les élèves à risque prioritaire."]);
    expect(res.alerts).toHaveLength(2);
  });

  it("détecte à l'échelle de l'établissement et ne trouve aucun élève à risque", async () => {
    m(prisma.academicYear.findFirst).mockResolvedValueOnce({ id: "ay-1" });
    m(prisma.enrollment.findMany).mockResolvedValueOnce([{ studentId: "a" }]);
    m(prisma.studentAnalytics.findMany).mockResolvedValueOnce([row("a", "LOW", 14)]);
    const res = await run(req({ action: "detect-at-risk" }));
    expect((res.data as Json).scope).toEqual({ type: "school", schoolId: SCHOOL });
    expect(res.recommendations).toEqual(["Aucun élève à risque moyen ou élevé n'a été détecté sur le périmètre courant."]);
  });

  it("sans année scolaire ni analyses, renvoie des données insuffisantes", async () => {
    const res = await run(req({ action: "detect-at-risk" }));
    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "ACTIVE", class: { schoolId: SCHOOL } } }));
    expect(res.confidence).toBe(0.4);
    expect((res.data as Json).status).toBe("insufficient_data");
  });

  it("exige un établissement hors périmètre classe", async () => {
    expect(await failure(req({ action: "detect-at-risk", schoolId: undefined }))).toMatchObject({ code: "MISSING_SCHOOL_ID" });
  });
});

describe("gouvernance IA — prédiction des notes", () => {
  const history = [
    { subjectId: "m", subject: { id: "m", name: "Maths" }, period: { name: "T1" }, average: "10" },
    { subjectId: "m", subject: { id: "m", name: "Maths" }, period: { name: "T2" }, average: "8" },
    { subjectId: "f", subject: { id: "f", name: "Français" }, period: { name: "T1" }, average: 12 },
    { subjectId: "f", subject: { id: "f", name: "Français" }, period: { name: "T2" }, average: 14 },
    { subjectId: "a", subject: { id: "a", name: "Anglais" }, period: { name: "T1" }, average: 11 },
    { subjectId: "a", subject: { id: "a", name: "Anglais" }, period: { name: "T2" }, average: 11.3 },
    { subjectId: "h", subject: { id: "h", name: "Histoire" }, period: { name: "T1" }, average: 19.5 },
    { subjectId: null, subject: null, period: { name: "T1" }, average: 5 },
    { subjectId: "x", subject: null, period: { name: "T1" }, average: 5 },
  ];

  it("projette chaque matière (tendance, bornes 0-20) et reprend la prédiction générale", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(generateStudentPredictions).mockResolvedValueOnce({
      predictions: { nextPeriodGrade: { predicted: 11, confidence: 99, range: [10, 12], modelUsed: "linear", warning: "Baisse en maths" } },
    });
    m(prisma.gradeHistory.findMany).mockResolvedValueOnce(history);

    const res = await run(req({ action: "predict-grades", studentId: "stu-1" }));
    const data = res.data as Json;
    expect(res.confidence).toBe(0.95);
    expect(data.status).toBe("predicted");
    expect(data.student).toEqual({ id: "stu-1", name: "Koffi Adjovi" });
    expect(data.generalAveragePrediction).toEqual({ predicted: 11, confidence: 99, range: [10, 12], modelUsed: "linear", warning: "Baisse en maths" });
    expect(data.subjectPredictions).toEqual([
      { subjectId: "a", subjectName: "Anglais", latestAverage: 11.3, lastPeriod: "T2", trend: "stable", projectedAverage: 11.6, dataPoints: 2 },
      { subjectId: "f", subjectName: "Français", latestAverage: 14, lastPeriod: "T2", trend: "up", projectedAverage: 16, dataPoints: 2 },
      { subjectId: "h", subjectName: "Histoire", latestAverage: 19.5, lastPeriod: "T1", trend: "stable", projectedAverage: 19.5, dataPoints: 1 },
      { subjectId: "m", subjectName: "Maths", latestAverage: 8, lastPeriod: "T2", trend: "down", projectedAverage: 6, dataPoints: 2 },
    ]);
    expect(res.recommendations).toEqual([
      "Baisse en maths",
      "Renforcer prioritairement les matières projetées sous 10/20: Maths.",
    ]);
  });

  it("borne la confiance basse et renvoie un avertissement nul", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(generateStudentPredictions).mockResolvedValueOnce({
      predictions: { nextPeriodGrade: { predicted: 9, confidence: 2, range: [8, 10], modelUsed: "avg" } },
    });
    const res = await run(req({ action: "predict-grades", studentId: "stu-1" }));
    expect(res.confidence).toBe(0.1);
    expect((res.data as Json).generalAveragePrediction.warning).toBeNull();
    expect(res.recommendations).toEqual([]);
  });

  it("tolère l'échec du moteur de prédiction (données insuffisantes)", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord).mockResolvedValueOnce(studentRecord);
    m(generateStudentPredictions).mockRejectedValueOnce("hors ligne").mockRejectedValueOnce(new Error("panne"));
    const res = await run(req({ action: "predict-grades", studentId: "stu-1" }));
    expect(res.confidence).toBe(0.35);
    expect(res.data).toMatchObject({ status: "insufficient_data", generalAveragePrediction: null, subjectPredictions: [] });
    expect(logger.warn).toHaveBeenCalledWith("Unable to compute student predictions", expect.objectContaining({ error: "hors ligne" }));
    await run(req({ action: "predict-grades", studentId: "stu-1" }));
    expect(logger.warn).toHaveBeenCalledWith("Unable to compute student predictions", expect.objectContaining({ error: "panne" }));
  });

  it("gère des prédictions sans projection générale", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(generateStudentPredictions).mockResolvedValueOnce({ predictions: {} });
    const res = await run(req({ action: "predict-grades", studentId: "stu-1" }));
    expect((res.data as Json).generalAveragePrediction).toBeNull();
  });
});

describe("gouvernance IA — orientation", () => {
  const record = { ...studentRecord, enrollments: [{ class: { name: "3e A" } }] };

  it("renvoie une recommandation par défaut sans analyses", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(null);
    const res = await run(req({ action: "recommend-orientation", studentId: "stu-1" }));
    expect(res.data).toEqual({ series: "SERIE_D", justification: "Données analytiques insuffisantes. Recommandation par défaut." });
    expect(res.confidence).toBe(0.3);
  });

  it("utilise le gabarit sans IA externe", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(
      studentAnalytics({ subjectPerformances: [{ subjectId: "m", average: 15, isStrength: true, isWeakness: false, subject: { name: "Mathématiques" } }] })
    );
    const res = await run(req({ action: "recommend-orientation", studentId: "stu-1" }));
    expect(res.confidence).toBe(0.75);
    expect((res.data as Json).series).toBe("SERIE_C");
    expect(res.recommendations).toEqual(["SERIE_D", "SERIE_E"]);
    expect(callExternalAI).not.toHaveBeenCalled();
  });

  it("adopte la réponse JSON de l'IA externe en gardant la synthèse du gabarit (pseudonymisée)", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics({ generalAverage: null }));
    m(callExternalAI).mockResolvedValueOnce({ success: true, response: 'Voici : {"series":"SERIE_A1","justification":"Lettres","alternatives":["SERIE_A2"]}' });
    const res = await run(req({ action: "recommend-orientation", studentId: "stu-1", userRole: "TEACHER" }));
    expect(res.confidence).toBe(0.9);
    expect(res.data).toMatchObject({ series: "SERIE_A1", justification: "Lettres", alternatives: ["SERIE_A2"] });
    expect((res.data as Json).synthesis).toContain("Koffi Adjovi");
    const call = m(callExternalAI).mock.calls[0][0] as { message: string; role: string; studentData: Record<string, unknown> };
    expect(call.role).toBe("TEACHER");
    expect(call.message).toContain("K. A.");
    expect(call.message).not.toContain("Koffi");
    expect(call.studentData).toMatchObject({ generalAverage: 0, currentClass: "3e A" });
    expect((call.studentData.subjects as Array<{ average: number }>)[1].average).toBe(0);
  });

  it("garde le gabarit si l'IA externe échoue, ne renvoie pas de JSON ou lève", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValue({ ...record, enrollments: [] });
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(studentAnalytics());
    m(callExternalAI)
      .mockResolvedValueOnce({ success: false, response: "" })
      .mockResolvedValueOnce({ success: true, response: "pas de json" })
      .mockRejectedValueOnce(new Error("réseau"));
    for (let i = 0; i < 3; i++) {
      const res = await run(req({ action: "recommend-orientation", studentId: "stu-1" }));
      expect(res.confidence).toBe(0.75);
    }
    expect(logger.warn).toHaveBeenCalledWith("Orientation via external AI failed, keeping template", expect.any(Object));
  });

  it("renvoie une liste de recommandations vide si l'IA omet les alternatives", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics());
    m(callExternalAI).mockResolvedValueOnce({ success: true, response: '{"series":"SERIE_B","justification":"Éco"}' });
    const res = await run(req({ action: "recommend-orientation", studentId: "stu-1" }));
    expect(res.recommendations).toEqual([]);
  });
});

describe("gouvernance IA — analyse de risque et intervention", () => {
  const record = { ...studentRecord, enrollments: [{ class: { name: "4e B" } }] };
  const risk = (probability: number) => ({
    probability,
    level: probability >= 75 ? "CRITICAL" : "HIGH",
    factors: ["notes", "absences"],
    causalFactors: [{ factor: "notes" }],
    recommendations: ["Tutorat en maths"],
  });

  it("renvoie la synthèse par gabarit alimentée par le moteur prédictif", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(predictFailureRisk).mockResolvedValueOnce(risk(80));
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics());
    const res = await run(req({ action: "analyze-risk", studentId: "stu-1" }));
    const data = res.data as Json;
    expect(res.confidence).toBe(0.78);
    expect(data).toMatchObject({ riskLevel: "CRITICAL", riskScore: 80, factors: ["notes", "absences"], priority: "CRITICAL" });
    expect(data.recommendations[0]).toBe("Tutorat en maths");
    expect(data.summary).toContain("Koffi Adjovi présente un risque d'échec critique (probabilité estimée : 80 %)");
    expect(data.suggestedActions.length).toBeGreaterThan(0);
  });

  it.each([
    [80, "CRITICAL"],
    [60, "HIGH"],
    [40, "MEDIUM"],
  ])("utilise la réponse de l'IA externe (probabilité %i → priorité demandée %s)", async (probability, priority) => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(predictFailureRisk).mockResolvedValueOnce(risk(probability));
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(null);
    m(prisma.academicYear.findFirst).mockResolvedValue(null);
    m(callExternalAI).mockResolvedValueOnce({ success: true, response: '```json\n{"riskLevel":"HIGH","recommendations":["Répétiteur"]}\n```' });
    const res = await run(req({ action: "analyze-risk", studentId: "stu-1" }));
    expect(res.confidence).toBe(0.9);
    expect(res.data).toMatchObject({ riskLevel: "HIGH", recommendations: ["Répétiteur"] });
    // Résumé absent de la réponse : celui du gabarit est conservé.
    expect((res.data as Json).summary).toContain("présente un risque d'échec");
    const call = m(callExternalAI).mock.calls[0][0] as { message: string };
    expect(call.message).toContain(`"priority": "${priority}"`);
    expect(call.message).not.toContain("Koffi");
  });

  it("garde le résumé fourni par l'IA externe", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce({ ...record, enrollments: [] });
    m(predictFailureRisk).mockResolvedValueOnce(risk(50));
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics());
    m(callExternalAI).mockResolvedValueOnce({ success: true, response: '{"summary":"Synthèse IA"}' });
    const res = await run(req({ action: "analyze-risk", studentId: "stu-1" }));
    expect((res.data as Json).summary).toBe("Synthèse IA");
  });

  it("revient aux gabarits si l'IA externe échoue, ne renvoie rien d'exploitable ou lève", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValue(record);
    m(predictFailureRisk).mockResolvedValue(risk(60));
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(studentAnalytics());
    m(callExternalAI)
      .mockResolvedValueOnce({ success: false, response: "" })
      .mockResolvedValueOnce({ success: true, response: "rien" })
      .mockRejectedValueOnce(new Error("quota"));
    for (let i = 0; i < 3; i++) {
      expect((await run(req({ action: "analyze-risk", studentId: "stu-1" }))).confidence).toBe(0.78);
    }
    expect(logger.warn).toHaveBeenCalledWith("Risk intervention via external AI failed, using templates", expect.any(Object));
  });
});

describe("gouvernance IA — plan d'action", () => {
  const record = { ...studentRecord, enrollments: [{ class: { name: "5e C" } }] };

  it.each([
    ["CRITICAL", "CRITICAL"],
    ["HIGH", "HIGH"],
    ["LOW", "MEDIUM"],
  ])("produit un plan par gabarit (risque %s → priorité %s)", async (riskLevel, priority) => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics({ riskLevel, generalAverage: 12 }));
    const res = await run(req({ action: "generate-action-plan", studentId: "stu-1" }));
    expect(res.confidence).toBe(0.85);
    expect(res.data).toMatchObject({ title: "Plan de remédiation — Koffi Adjovi", priority });
  });

  it("produit un plan par gabarit sans analyses ni classe", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce({ ...studentRecord, user: null, enrollments: [] });
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(null);
    const res = await run(req({ action: "generate-action-plan", studentId: "stu-1" }));
    expect(callExternalAI).not.toHaveBeenCalled();
    expect(res.data).toMatchObject({ title: "Plan de remédiation — l'élève", priority: "HIGH" });
  });

  it("adopte le plan JSON de l'IA externe (prompt pseudonymisé)", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(record);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics());
    m(callExternalAI).mockResolvedValueOnce({ success: true, response: '{"title":"Plan IA","steps":["a"]}' });
    const res = await run(req({ action: "generate-action-plan", studentId: "stu-1" }));
    expect(res.data).toEqual({ title: "Plan IA", steps: ["a"] });
    const call = m(callExternalAI).mock.calls[0][0] as { message: string };
    expect(call.message).toContain("K. A.");
    expect(call.message).toContain("Faiblesses: Maths");
  });

  it("revient au gabarit si l'IA externe échoue, répond sans JSON ou lève", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValue(record);
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(studentAnalytics());
    m(callExternalAI)
      .mockResolvedValueOnce({ success: false, response: "" })
      .mockResolvedValueOnce({ success: true, response: "texte libre" })
      .mockRejectedValueOnce(new Error("boom"));
    for (let i = 0; i < 3; i++) {
      const res = await run(req({ action: "generate-action-plan", studentId: "stu-1" }));
      expect((res.data as Json).suggestedBy).toBe("EduPilot — moteur par gabarits");
    }
    expect(logger.warn).toHaveBeenCalledWith("Failed to generate action plan via external AI", expect.any(Object));
  });
});

describe("gouvernance IA — appréciation de bulletin", () => {
  it("rédige l'appréciation par gabarit (confiance 0.85 sans IA externe)", async () => {
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics({ generalAverage: 15 }));
    const res = await run(req({ action: "draft-report-comment", studentId: "stu-1" }));
    expect(res.confidence).toBe(0.85);
    expect((res.data as { comment: string }).comment).toContain("Koffi Adjovi affiche de très bons résultats (15.00/20)");
  });

  it("utilise l'appréciation de l'IA externe en retirant les guillemets", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValueOnce(studentAnalytics({ generalAverage: "13.456", progressionRate: 2 }));
    m(callExternalAI).mockResolvedValueOnce({ success: true, response: '"Bon trimestre, continuez."' });
    const res = await run(req({ action: "draft-report-comment", studentId: "stu-1" }));
    expect(res.confidence).toBe(0.9);
    expect(res.data).toEqual({ comment: "Bon trimestre, continuez." });
    const call = m(callExternalAI).mock.calls[0][0] as { message: string };
    expect(call.message).toContain("Moyenne générale: 13.46/20. Tendance: En progrès.");
    expect(call.message).not.toContain("Koffi");
  });

  it("garde le gabarit si l'IA externe renvoie un texte vide, échoue ou lève (tendance en baisse, moyenne nulle)", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValue(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(studentAnalytics({ generalAverage: null, progressionRate: null }));
    m(callExternalAI)
      .mockResolvedValueOnce({ success: true, response: "   " })
      .mockResolvedValueOnce({ success: false, response: "x" })
      .mockRejectedValueOnce(new Error("503"));
    for (let i = 0; i < 3; i++) {
      const res = await run(req({ action: "draft-report-comment", studentId: "stu-1" }));
      expect((res.data as { comment: string }).comment).toContain("ne dispose pas encore de notes suffisantes");
    }
    const call = m(callExternalAI).mock.calls[0][0] as { message: string };
    expect(call.message).toContain("Moyenne générale: 0.00/20. Tendance: En baisse.");
    expect(logger.warn).toHaveBeenCalledWith("Failed to draft comment via external AI, keeping template", expect.any(Object));
  });

  it("n'appelle pas l'IA externe sans analyses", async () => {
    setExternal(true);
    m(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord);
    m(prisma.studentAnalytics.findFirst).mockResolvedValue(null);
    const res = await run(req({ action: "draft-report-comment", studentId: "stu-1" }));
    expect(callExternalAI).not.toHaveBeenCalled();
    expect(res.confidence).toBe(0.9);
  });
});
