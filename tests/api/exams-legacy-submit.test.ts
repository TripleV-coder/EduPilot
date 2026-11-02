import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/tenant", () => ({ assertModelAccess: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    examSession: { updateMany: vi.fn(), update: vi.fn() },
    examAnswer: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  return {
    default: {
      studentProfile: { findUnique: vi.fn() },
      examTemplate: { findUnique: vi.fn() },
      examSession: { findUnique: vi.fn() },
      enrollment: { findFirst: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx,
    },
  };
});

import prisma from "@/lib/prisma";
import { assertModelAccess } from "@/lib/security/tenant";
import { POST } from "@/app/api/exams/[id]/submit/route";

const examId = cuid("examlegacy");
const qA = cuid("questa");
const qB = cuid("questb");
const params = { params: Promise.resolve({ id: examId }) };
const url = `http://localhost/api/exams/${examId}/submit`;
const tx = (prisma as unknown as { __tx: { examSession: { updateMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }; examAnswer: { createMany: ReturnType<typeof vi.fn> } } }).__tx;
const openSession = () => ({ id: "sess-1", submittedAt: null, startedAt: new Date(Date.now() - 10 * 60_000) });

function exam(overrides: Record<string, unknown> = {}) {
  return {
    id: examId,
    totalPoints: 20,
    passingScore: 10,
    duration: 30,
    isPublished: true,
    classSubject: { classId: "class-1" },
    questions: [
      { id: qA, type: "MCQ", points: 10, correctAnswer: "B" },
      { id: qB, type: "MCQ", points: 10, correctAnswer: "C" },
    ],
    ...overrides,
  };
}

function submit(body: unknown) {
  return POST(makeRequest(url, { method: "POST", body }), params);
}

describe("POST /api/exams/[id]/submit (parcours de la page de passage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { id: "user-stu" }));
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "stu-1" } as never);
    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValue(exam() as never);
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValue({ id: "enr-1" } as never);
    vi.mocked(prisma.examSession.findUnique).mockResolvedValue(openSession() as never);
    vi.mocked(assertModelAccess).mockResolvedValue(null);
    tx.examSession.updateMany.mockResolvedValue({ count: 1 });
    tx.examSession.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "sess-1", ...data }));
  });

  it("refuse l'examen d'un autre établissement (garde de tenant)", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(assertModelAccess).mockResolvedValueOnce(NextResponse.json({ error: "Examen non trouvé" }, { status: 404 }));
    const res = await submit({ answers: { [qA]: "B" } });
    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse un examen non publié (404)", async () => {
    vi.mocked(prisma.examTemplate.findUnique).mockResolvedValueOnce(exam({ isPublished: false }) as never);
    const res = await submit({ answers: { [qA]: "B" } });
    expect(res.status).toBe(404);
  });

  it("refuse un élève qui n'est pas inscrit dans la classe (403)", async () => {
    vi.mocked(prisma.enrollment.findFirst).mockResolvedValueOnce(null as never);
    const res = await submit({ answers: { [qA]: "B" } });
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse une seconde soumission : le score ne sert plus d'oracle (409)", async () => {
    vi.mocked(prisma.examSession.findUnique).mockResolvedValueOnce({ id: "sess-1", submittedAt: new Date() } as never);
    const res = await submit({ answers: { [qA]: "B", [qB]: "C" } });
    expect(res.status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejette un corps sans réponses (400, pas 500)", async () => {
    const res = await submit({});
    expect(res.status).toBe(400);
  });

  it("rejette des réponses non textuelles (400)", async () => {
    const res = await submit({ answers: { [qA]: { $ne: null } } });
    expect(res.status).toBe(400);
  });

  it("refuse une soumission sans session ouverte par /start (409)", async () => {
    vi.mocked(prisma.examSession.findUnique).mockResolvedValueOnce(null as never);
    const res = await submit({ answers: { [qA]: "B" } });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("EXAM_NOT_STARTED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse une soumission après l'échéance + la marge (TD-023, 409)", async () => {
    // Durée 30 min, départ il y a 32 min : au-delà de la marge de 60 s
    vi.mocked(prisma.examSession.findUnique).mockResolvedValueOnce({
      id: "sess-1",
      submittedAt: null,
      startedAt: new Date(Date.now() - 32 * 60_000),
    } as never);
    const res = await submit({ answers: { [qA]: "B", [qB]: "C" } });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("EXAM_TIME_EXPIRED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepte la soumission automatique arrivée dans la marge", async () => {
    vi.mocked(prisma.examSession.findUnique).mockResolvedValueOnce({
      id: "sess-1",
      submittedAt: null,
      startedAt: new Date(Date.now() - (30 * 60_000 + 20_000)),
    } as never);
    const res = await submit({ answers: { [qA]: "B" } });
    expect(res.status).toBe(200);
  });

  it("deux envois simultanés : un seul est noté (clôture conditionnelle, 409)", async () => {
    tx.examSession.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await submit({ answers: { [qA]: "B" } });
    expect(res.status).toBe(409);
    expect(tx.examAnswer.createMany).not.toHaveBeenCalled();
  });

  it("note la première soumission et la marque soumise", async () => {
    const res = await submit({ answers: { [qA]: " b ", [qB]: "A" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(10);
    expect(body.isPassed).toBe(true);
    const created = tx.examAnswer.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(2);
    // Temps passé calculé depuis le départ serveur (≈ 10 min)
    const updateData = tx.examSession.update.mock.calls[0][0].data;
    expect(updateData.timeSpent).toBeGreaterThanOrEqual(599);
    expect(tx.examSession.updateMany.mock.calls[0][0].where).toEqual({ id: "sess-1", submittedAt: null });
  });
});
