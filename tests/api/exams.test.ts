import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prismaMock: Record<string, any> = {
    examTemplate: { findUnique: vi.fn() },
    examSession: { findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    examAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    enrollment: { findFirst: vi.fn() },
  };
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => Promise<unknown>)(prismaMock)
  );
  return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { POST as POST_START } from "@/app/api/exams/[id]/start/route";
import { POST as POST_SUBMIT } from "@/app/api/exams/[id]/submit/route";

const examId = cuid("examen1");
const examSessionId = cuid("session1");
const questionA = cuid("question1");
const questionB = cuid("question2");
const routeParams = { params: Promise.resolve({ id: examId }) };

function examTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: examId,
    isPublished: true,
    totalPoints: 20,
    questions: [
      { id: questionA, correctAnswer: "B", points: 12, type: "MCQ", question: "Q1", order: 1, options: [] },
      { id: questionB, correctAnswer: "C", points: 8, type: "MCQ", question: "Q2", order: 2, options: [] },
    ],
    classSubject: { class: { id: cuid("classe6a"), schoolId: FIXTURES.schoolA } },
    ...overrides,
  };
}

/**
 * examTemplate.findUnique sert au guard tenant (select schoolId imbriqué)
 * puis à la route (include questions).
 */
function mockExamLookups(record: ReturnType<typeof examTemplate> | null) {
  vi.mocked(prisma.examTemplate.findUnique).mockImplementation(async (args: any) => {
    if (args?.select) {
      if (!record) return null;
      return {
        classSubject: {
          class: { schoolId: (record.classSubject as any).class.schoolId },
        },
      } as any;
    }
    return record as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/exams/[id]/start", () => {
  it("refuse tout rôle non STUDENT (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);

    const response = await POST_START(
      makeRequest(`http://localhost:3000/api/exams/${examId}/start`, { method: "POST" }),
      routeParams
    );
    expect(response.status).toBe(403);
  });

  it("masque un examen d'une autre école (404 via guard tenant)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    mockExamLookups(
      examTemplate({ classSubject: { class: { id: cuid("classeb"), schoolId: FIXTURES.schoolB } } })
    );

    const response = await POST_START(
      makeRequest(`http://localhost:3000/api/exams/${examId}/start`, { method: "POST" }),
      routeParams
    );
    expect(response.status).toBe(403);
  });

  it("rejette un examen déjà commencé (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    mockExamLookups(examTemplate());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examSession.findFirst).mockResolvedValue({ id: examSessionId } as any);

    const response = await POST_START(
      makeRequest(`http://localhost:3000/api/exams/${examId}/start`, { method: "POST" }),
      routeParams
    );

    expect(response.status).toBe(400);
    expect(prisma.examSession.create).not.toHaveBeenCalled();
  });

  it("masque un examen non publié (404)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    mockExamLookups(examTemplate({ isPublished: false }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examSession.findFirst).mockResolvedValue(null);

    const response = await POST_START(
      makeRequest(`http://localhost:3000/api/exams/${examId}/start`, { method: "POST" }),
      routeParams
    );
    expect(response.status).toBe(404);
  });

  it("exige une inscription active dans la classe (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    mockExamLookups(examTemplate());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examSession.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue(null);

    const response = await POST_START(
      makeRequest(`http://localhost:3000/api/exams/${examId}/start`, { method: "POST" }),
      routeParams
    );
    expect(response.status).toBe(403);
  });

  it("démarre la session (201) sans exposer les bonnes réponses", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    mockExamLookups(examTemplate());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examSession.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: cuid("inscription1") } as any);
    vi.mocked(prisma.examSession.create).mockImplementation(async (args: any) => ({
      id: examSessionId,
      ...args.data,
      examTemplate: { questions: [{ id: questionA }, { id: questionB }] },
    }) as any);

    const response = await POST_START(
      makeRequest(`http://localhost:3000/api/exams/${examId}/start`, { method: "POST" }),
      routeParams
    );

    expect(response.status).toBe(201);
    const createArgs = vi.mocked(prisma.examSession.create).mock.calls[0][0] as any;
    expect(createArgs.data).toMatchObject({
      examTemplateId: examId,
      studentId: FIXTURES.studentA,
      totalPoints: 20,
    });
    // Le select des questions renvoyées au candidat exclut correctAnswer
    expect(createArgs.include.examTemplate.include.questions.select).not.toHaveProperty(
      "correctAnswer"
    );
  });

  it("convertit un conflit P2002 (double clic) en 400 « déjà commencé »", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    mockExamLookups(examTemplate());
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examSession.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: cuid("inscription1") } as any);
    vi.mocked(prisma.examSession.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002" })
    );

    const response = await POST_START(
      makeRequest(`http://localhost:3000/api/exams/${examId}/start`, { method: "POST" }),
      routeParams
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("déjà commencé");
  });
});

describe("POST /api/exams/[id]/submit", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await POST_SUBMIT(
      makeRequest(`http://localhost:3000/api/exams/${examId}/submit`, {
        method: "POST",
        body: { answers: {} },
      }),
      routeParams
    );
    expect(response.status).toBe(401);
  });

  it("refuse un TEACHER (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);

    const response = await POST_SUBMIT(
      makeRequest(`http://localhost:3000/api/exams/${examId}/submit`, {
        method: "POST",
        body: { answers: {} },
      }),
      routeParams
    );
    expect(response.status).toBe(403);
  });

  it("score la copie : points des bonnes réponses, réussite à la moitié des points", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(examTemplate() as any);
    vi.mocked(prisma.examSession.upsert).mockResolvedValue({ id: examSessionId } as any);
    vi.mocked(prisma.examAnswer.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.examAnswer.createMany).mockResolvedValue({ count: 2 } as any);
    vi.mocked(prisma.examSession.update).mockImplementation(async (args: any) => ({
      id: examSessionId,
      ...args.data,
    }) as any);

    // Q1 correcte (12 pts), Q2 fausse (0 pt) → 12/20, admis (≥ 10)
    const response = await POST_SUBMIT(
      makeRequest(`http://localhost:3000/api/exams/${examId}/submit`, {
        method: "POST",
        body: { answers: { [questionA]: "B", [questionB]: "A" } },
      }),
      routeParams
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.score).toBe(12);
    expect(body.isPassed).toBe(true);

    // Les réponses sont persistées avec correction par question
    const answerRows = vi.mocked(prisma.examAnswer.createMany).mock.calls[0][0].data;
    expect(answerRows).toEqual([
      expect.objectContaining({ questionId: questionA, isCorrect: true, pointsEarned: 12 }),
      expect.objectContaining({ questionId: questionB, isCorrect: false, pointsEarned: 0 }),
    ]);
    // Les anciennes réponses sont purgées avant ré-écriture (resoumission idempotente)
    expect(prisma.examAnswer.deleteMany).toHaveBeenCalledWith({
      where: { examSessionId },
    });
  });

  it("échoue sous la moitié des points (isPassed=false)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(examTemplate() as any);
    vi.mocked(prisma.examSession.upsert).mockResolvedValue({ id: examSessionId } as any);
    vi.mocked(prisma.examAnswer.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.examAnswer.createMany).mockResolvedValue({ count: 2 } as any);
    vi.mocked(prisma.examSession.update).mockImplementation(async (args: any) => ({
      id: examSessionId,
      ...args.data,
    }) as any);

    // Seule Q2 correcte (8 pts) → 8/20, recalé (< 10)
    const response = await POST_SUBMIT(
      makeRequest(`http://localhost:3000/api/exams/${examId}/submit`, {
        method: "POST",
        body: { answers: { [questionA]: "D", [questionB]: "C" } },
      }),
      routeParams
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.score).toBe(8);
    expect(body.isPassed).toBe(false);
  });

  it("retourne 404 si l'examen n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT") as any);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({
      id: FIXTURES.studentA,
    } as any);
    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(null);

    const response = await POST_SUBMIT(
      makeRequest(`http://localhost:3000/api/exams/${examId}/submit`, {
        method: "POST",
        body: { answers: {} },
      }),
      routeParams
    );
    expect(response.status).toBe(404);
  });
});
