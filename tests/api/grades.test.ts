import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, any> = {
    evaluation: { findUnique: vi.fn() },
    enrollment: { count: vi.fn() },
    grade: { upsert: vi.fn(), findMany: vi.fn() },
    period: { findUnique: vi.fn(), findFirst: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prismaMock)
  );
  return { default: prismaMock };
});
// La synchro analytics post-saisie est un service lourd testé séparément
vi.mock("@/lib/services/analytics-sync", () => ({
  syncAnalyticsAfterGradeChange: vi.fn().mockResolvedValue(undefined),
}));

import prisma from "@/lib/prisma";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";
import { invalidateCache } from "@/lib/api/cache-helpers";
import { POST as POST_BATCH } from "@/app/api/grades/batch/route";
import { GET as GET_STATISTICS } from "@/app/api/grades/statistics/route";

const evaluationId = cuid("eval1");
const teacherUserId = cuid("userteacher1");

function evaluationRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: evaluationId,
    maxGrade: 20,
    classSubject: {
      classId: cuid("classe6a"),
      class: { schoolId: FIXTURES.schoolA },
      teacher: { userId: teacherUserId },
    },
    period: { endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000), name: "Trimestre 1" },
    ...overrides,
  };
}

function gradeRecord(value: number, maxGrade = 20, overrides: Record<string, unknown> = {}) {
  return {
    id: cuid(`grade${value}`),
    studentId: FIXTURES.studentA,
    value,
    evaluation: {
      maxGrade,
      classSubject: {
        subject: { name: "Mathématiques" },
        class: { id: cuid("classe6a"), name: "6e A" },
      },
      period: { name: "Trimestre 1" },
      type: { name: "Devoir" },
    },
    student: { user: { firstName: "Awa", lastName: "Dossou" } },
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await invalidateCache("api:*");
});

describe("POST /api/grades/batch", () => {
  const validBody = {
    evaluationId,
    grades: [
      { studentId: FIXTURES.studentA, value: 15 },
      { studentId: FIXTURES.studentB, value: 8, comment: "Doit progresser" },
    ],
  };

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(401);
  });

  it("refuse un STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("retourne 404 si l'évaluation n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }) as any);
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(null);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(404);
  });

  it("refuse la saisie sur une période clôturée (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }) as any);
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(
      evaluationRecord({
        period: { endDate: new Date("2025-12-31"), name: "Trimestre 1" },
      }) as any
    );

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );

    expect(response.status).toBe(400);
    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it("bloque la saisie cross-tenant (évaluation d'une autre école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(
      evaluationRecord({
        classSubject: {
          classId: cuid("classeb"),
          class: { schoolId: FIXTURES.schoolB },
          teacher: { userId: teacherUserId },
        },
      }) as any
    );

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("un TEACHER ne peut noter que ses propres matières (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("autreprof") }) as any);
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as any);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("anti-fraude : bloque les étudiants non inscrits dans la classe (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }) as any);
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as any);
    // 2 étudiants soumis, mais 1 seul inscrit actif dans la classe
    vi.mocked(prisma.enrollment.count).mockResolvedValue(1);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );

    expect(response.status).toBe(400);
    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it("rejette une note supérieure au barème (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }) as any);
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as any);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(2);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", {
        method: "POST",
        body: {
          evaluationId,
          grades: [{ studentId: FIXTURES.studentA, value: 25 }],
        },
      })
    );

    expect(response.status).toBe(400);
    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it("upsert toutes les notes en transaction et synchronise les analytics (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }) as any);
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as any);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.grade.upsert).mockResolvedValue({ id: cuid("grade1") } as any);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ success: true, count: 2 });
    expect(prisma.grade.upsert).toHaveBeenCalledTimes(2);
    // Clé composite évaluation+étudiant : pas de doublon possible
    expect(vi.mocked(prisma.grade.upsert).mock.calls[0][0].where).toEqual({
      evaluationId_studentId: { evaluationId, studentId: FIXTURES.studentA },
    });
    expect(syncAnalyticsAfterGradeChange).toHaveBeenCalledWith(evaluationId, [
      FIXTURES.studentA,
      FIXTURES.studentB,
    ]);
  });
});

describe("GET /api/grades/statistics", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET_STATISTICS(
      makeRequest("http://localhost:3000/api/grades/statistics")
    );
    expect(response.status).toBe(401);
  });

  it("refuse un compte sans établissement (403 NO_SCHOOL)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: null }) as any);

    const response = await GET_STATISTICS(
      makeRequest("http://localhost:3000/api/grades/statistics")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("NO_SCHOOL");
  });

  it("calcule moyenne, extrêmes, distribution et taux de réussite (notes normalisées sur 20)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    vi.mocked(prisma.grade.findMany).mockResolvedValue([
      gradeRecord(18), // excellent
      gradeRecord(14), // good
      gradeRecord(12), // average
      gradeRecord(4), // poor
      gradeRecord(40, 50), // 16/20 après normalisation → excellent
    ] as any);

    const response = await GET_STATISTICS(
      makeRequest("http://localhost:3000/api/grades/statistics")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    const stats = body.statistics;
    expect(stats.totalGrades).toBe(5);
    expect(stats.average).toBe(12.8); // (18+14+12+4+16)/5
    expect(stats.highest).toBe(18);
    expect(stats.lowest).toBe(4);
    expect(stats.passRate).toBe(80); // 4 notes ≥ 10 sur 5
    expect(stats.gradeDistribution).toEqual({ excellent: 2, good: 1, average: 1, poor: 1 });
    expect(stats.bySubject["Mathématiques"].count).toBe(5);

    // Isolation tenant : filtre école dans la requête
    expect(vi.mocked(prisma.grade.findMany).mock.calls[0][0].where.evaluation).toMatchObject({
      classSubject: { class: { schoolId: FIXTURES.schoolA } },
    });
  });

  it("régression : supporte des dizaines de milliers de notes sans stack overflow", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN") as any);
    const manyGrades = Array.from({ length: 50000 }, (_, index) =>
      gradeRecord((index % 20) + 0.5)
    );
    vi.mocked(prisma.grade.findMany).mockResolvedValue(manyGrades as any);

    const response = await GET_STATISTICS(
      makeRequest("http://localhost:3000/api/grades/statistics")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.statistics.totalGrades).toBe(50000);
    expect(body.statistics.highest).toBe(19.5);
    expect(body.statistics.lowest).toBe(0.5);
  });

  it("classe les élèves et calcule le rang quand type=class", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const classId = cuid("classe6a");
    // 1er findMany : stats globales — 2e : notes du classement
    vi.mocked(prisma.grade.findMany)
      .mockResolvedValueOnce([gradeRecord(12)] as any)
      .mockResolvedValueOnce([
        gradeRecord(12, 20, { studentId: FIXTURES.studentA }),
        gradeRecord(16, 20, {
          studentId: FIXTURES.studentB,
          student: { user: { firstName: "Bio", lastName: "Soglo" } },
        }),
      ] as any);

    const response = await GET_STATISTICS(
      makeRequest(
        `http://localhost:3000/api/grades/statistics?type=class&classId=${classId}&studentId=${FIXTURES.studentA}`
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ranking.totalStudents).toBe(2);
    expect(body.ranking.rank).toBe(2); // studentA (12) derrière studentB (16)
    expect(body.ranking.topStudent.studentId).toBe(FIXTURES.studentB);
    expect(body.ranking.bottomStudent.studentId).toBe(FIXTURES.studentA);
  });

  it("calcule la tendance par rapport à la période précédente", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const periodId = cuid("periode2");
    vi.mocked(prisma.grade.findMany)
      // Période courante : moyenne 14
      .mockResolvedValueOnce([gradeRecord(14)] as any)
      // Période précédente : moyenne 10 → tendance "up"
      .mockResolvedValueOnce([
        { value: 10, evaluation: { maxGrade: 20 } },
      ] as any);
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      academicYearId: cuid("annee2026"),
      sequence: 2,
    } as any);
    vi.mocked(prisma.period.findFirst).mockResolvedValue({ id: cuid("periode1") } as any);

    const response = await GET_STATISTICS(
      makeRequest(`http://localhost:3000/api/grades/statistics?periodId=${periodId}`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trend).toBe("up");
  });
});
