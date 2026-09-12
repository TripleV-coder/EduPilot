import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Evaluation, Grade, Period } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, unknown> = {
    evaluation: { findUnique: vi.fn() },
    enrollment: { count: vi.fn() },
    grade: { upsert: vi.fn(), findMany: vi.fn() },
    period: { findUnique: vi.fn(), findFirst: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    classSubject: { count: vi.fn() },
    class: { count: vi.fn() },
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
// Agrégations SQL des statistiques : prouvées sur vrai PostgreSQL par
// tests/integration-db/grade-statistics.test.ts ; ici, la route seule.
vi.mock("@/lib/services/grade-statistics", () => ({
  aggregateGradeStatistics: vi.fn(),
  averageGrade: vi.fn(),
  rankStudents: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";
import { invalidateCache } from "@/lib/api/cache-helpers";
import { POST as POST_BATCH } from "@/app/api/grades/batch/route";
import { GET as GET_STATISTICS } from "@/app/api/grades/statistics/route";
import { aggregateGradeStatistics, averageGrade, rankStudents } from "@/lib/services/grade-statistics";

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
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT"));

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("retourne 404 si l'évaluation n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(null);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(404);
  });

  it("refuse la saisie sur une période clôturée (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(
      evaluationRecord({
        period: { endDate: new Date("2025-12-31"), name: "Trimestre 1" },
      }) as unknown as Evaluation
    );

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );

    expect(response.status).toBe(400);
    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it("bloque la saisie cross-tenant (évaluation d'une autre école)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(
      evaluationRecord({
        classSubject: {
          classId: cuid("classeb"),
          class: { schoolId: FIXTURES.schoolB },
          teacher: { userId: teacherUserId },
        },
      }) as unknown as Evaluation
    );

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("un TEACHER ne peut noter que ses propres matières (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("autreprof") }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as unknown as Evaluation);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );
    expect(response.status).toBe(403);
  });

  it("anti-fraude : bloque les étudiants non inscrits dans la classe (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as unknown as Evaluation);
    // 2 étudiants soumis, mais 1 seul inscrit actif dans la classe
    vi.mocked(prisma.enrollment.count).mockResolvedValue(1);

    const response = await POST_BATCH(
      makeRequest("http://localhost:3000/api/grades/batch", { method: "POST", body: validBody })
    );

    expect(response.status).toBe(400);
    expect(prisma.grade.upsert).not.toHaveBeenCalled();
  });

  it("rejette une note supérieure au barème (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as unknown as Evaluation);
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
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: teacherUserId }));
    vi.mocked(prisma.evaluation.findUnique).mockResolvedValue(evaluationRecord() as unknown as Evaluation);
    vi.mocked(prisma.enrollment.count).mockResolvedValue(2);
    vi.mocked(prisma.grade.upsert).mockResolvedValue({ id: cuid("grade1") } as unknown as Grade);

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
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: null }));

    const response = await GET_STATISTICS(
      makeRequest("http://localhost:3000/api/grades/statistics")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("NO_SCHOOL");
  });

  // Audit C3 / N10 : les 4 tests ci-dessous nourrissaient la route de notes
  // chargées en mémoire (grade.findMany, jusqu'à 50 000 lignes) et exigeaient
  // un classement nominatif pour tout rôle. Les agrégats sont désormais
  // calculés en SQL (service grade-statistics, prouvé sur vrai PostgreSQL) et
  // le classement nominatif est réservé au personnel concerné.
  function aggregate(overrides: Record<string, unknown> = {}) {
    return {
      totalGrades: 5,
      average: 12.8333,
      highest: 18,
      lowest: 4,
      passRate: 80,
      gradeDistribution: { excellent: 2, good: 1, average: 1, poor: 1 },
      bySubject: { Mathématiques: { average: 12.8333, count: 5 } },
      byType: { Devoir: { average: 12.8333, count: 5 } },
      ...overrides,
    };
  }

  it("délègue l'agrégation à la base, filtrée par école, et arrondit la réponse", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(aggregateGradeStatistics).mockResolvedValue(aggregate());

    const response = await GET_STATISTICS(
      makeRequest("http://localhost:3000/api/grades/statistics")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.statistics).toMatchObject({ totalGrades: 5, average: 12.83, passRate: 80 });
    expect(body.statistics.bySubject["Mathématiques"]).toEqual({ average: 12.83, count: 5 });
    expect(aggregateGradeStatistics).toHaveBeenCalledWith(expect.objectContaining({ schoolId: FIXTURES.schoolA }));
  });

  it("régression : ne charge plus aucune note en mémoire (agrégation SQL)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(aggregateGradeStatistics).mockResolvedValue(aggregate());

    const response = await GET_STATISTICS(
      makeRequest("http://localhost:3000/api/grades/statistics")
    );

    expect(response.status).toBe(200);
    expect(prisma.grade.findMany).not.toHaveBeenCalled();
  });

  it("classe les élèves et calcule le rang quand type=class (administration)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const classId = cuid("classe6a");
    vi.mocked(aggregateGradeStatistics).mockResolvedValue(aggregate());
    vi.mocked(rankStudents).mockResolvedValue([
      { studentId: FIXTURES.studentB, studentName: "Bio Soglo", average: 16, gradeCount: 1 },
      { studentId: FIXTURES.studentA, studentName: "Awa Dossou", average: 12, gradeCount: 1 },
    ]);

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
    expect(body.ranking.students).toHaveLength(2);
  });

  it("masque les noms du classement à un parent et refuse l'enfant d'un autre (N10)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValue({
      parentStudents: [{ studentId: FIXTURES.studentA }],
    } as never);
    vi.mocked(aggregateGradeStatistics).mockResolvedValue(aggregate());
    vi.mocked(rankStudents).mockResolvedValue([
      { studentId: FIXTURES.studentB, studentName: "Bio Soglo", average: 16, gradeCount: 1 },
      { studentId: FIXTURES.studentA, studentName: "Awa Dossou", average: 12, gradeCount: 1 },
    ]);

    const own = await GET_STATISTICS(
      makeRequest(
        `http://localhost:3000/api/grades/statistics?type=class&classId=${cuid("classe6a")}&studentId=${FIXTURES.studentA}`
      )
    );
    expect((await own.json()).ranking).toEqual({ totalStudents: 2, rank: 2, topStudent: null, bottomStudent: null });

    const other = await GET_STATISTICS(
      makeRequest(`http://localhost:3000/api/grades/statistics?studentId=${FIXTURES.studentB}`)
    );
    expect(other.status).toBe(403);
  });

  it("calcule la tendance par rapport à la période précédente", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const periodId = cuid("periode2");
    vi.mocked(aggregateGradeStatistics).mockResolvedValue(aggregate({ average: 14 }));
    vi.mocked(averageGrade).mockResolvedValue(10); // période précédente
    vi.mocked(prisma.period.findUnique).mockResolvedValue({
      academicYearId: cuid("annee2026"),
      sequence: 2,
    } as unknown as Period);
    vi.mocked(prisma.period.findFirst).mockResolvedValue({ id: cuid("periode1") } as unknown as Period);

    const response = await GET_STATISTICS(
      makeRequest(`http://localhost:3000/api/grades/statistics?periodId=${periodId}`)
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.trend).toBe("up");
    expect(averageGrade).toHaveBeenCalledWith(expect.objectContaining({ periodId: cuid("periode1") }));
  });
});
