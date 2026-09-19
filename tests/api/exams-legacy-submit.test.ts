import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/security/tenant", () => ({ assertModelAccess: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    examSession: { upsert: vi.fn(), update: vi.fn() },
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
const tx = (prisma as unknown as { __tx: { examSession: { upsert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }; examAnswer: { createMany: ReturnType<typeof vi.fn> } } }).__tx;

function exam(overrides: Record<string, unknown> = {}) {
  return {
    id: examId,
    totalPoints: 20,
    passingScore: 10,
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
    vi.mocked(prisma.examSession.findUnique).mockResolvedValue(null as never);
    vi.mocked(assertModelAccess).mockResolvedValue(null);
    tx.examSession.upsert.mockResolvedValue({ id: "sess-1" });
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

  it("note la première soumission et la marque soumise", async () => {
    const res = await submit({ answers: { [qA]: " b ", [qB]: "A" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toBe(10);
    expect(body.isPassed).toBe(true);
    const created = tx.examAnswer.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(2);
  });
});
