import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as POST_BATCH } from "@/app/api/orientation/batch-analyze/route";
import { POST as POST_GENERATE } from "@/app/api/orientation/generate-ai/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { aiService } from "@/lib/ai/ai-service";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ai/ai-service", () => ({
  aiService: { executeGovernance: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    enrollment: { findMany: vi.fn() },
  },
}));

function makeStudent(studentId: string, name: string, orientations: unknown[] = []) {
  return {
    id: studentId,
    user: { firstName: name.split(" ")[0], lastName: name.split(" ")[1] },
    studentOrientations: orientations,
  };
}

function makeGovernanceResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    action: "recommend-orientation",
    data: { series: "SERIE_C", justification: "Profil scientifique solide" },
    confidence: 0.75,
    executionTime: 42,
    recommendations: ["SERIE_D"],
    ...overrides,
  };
}

describe("POST /api/orientation/batch-analyze", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_BATCH(makeRequest("http://localhost/api/orientation/batch-analyze", { method: "POST", body: { academicYearId: "ay1" } }), { session: null });
    expect(res.status).toBe(401);
  });

  it("should return 400 when academicYearId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_BATCH(makeRequest("http://localhost/api/orientation/batch-analyze", { method: "POST", body: {} }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("academicYearId requis");
  });

  it("should return empty results when no student to analyze", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([]);
    const res = await POST_BATCH(makeRequest("http://localhost/api/orientation/batch-analyze", { method: "POST", body: { academicYearId: "ay1" } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Tous les élèves ont déjà une orientation ou aucun élève trouvé.");
    expect(body.results).toEqual([]);
    expect(aiService.executeGovernance).not.toHaveBeenCalled();
  });

  it("should skip students with a validated orientation", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { id: "enr1", student: makeStudent("stu1", "Awa Diallo", [{ status: "VALIDATED" }]) },
      { id: "enr2", student: makeStudent("stu2", "Jean Mensah") },
    ] as never);
    vi.mocked(aiService.executeGovernance).mockResolvedValue(makeGovernanceResult() as never);
    const res = await POST_BATCH(makeRequest("http://localhost/api/orientation/batch-analyze", { method: "POST", body: { academicYearId: "ay1", classId: "cl1" } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalFound).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].studentId).toBe("stu2");
  });

  it("should analyze students and return AI results", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { id: "enr1", student: makeStudent("stu1", "Awa Diallo", [{ status: "PENDING" }]) },
      { id: "enr2", student: makeStudent("stu2", "Jean Mensah") },
    ] as never);
    vi.mocked(aiService.executeGovernance).mockResolvedValue(makeGovernanceResult() as never);
    const res = await POST_BATCH(makeRequest("http://localhost/api/orientation/batch-analyze", { method: "POST", body: { academicYearId: "ay1" } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(body.totalFound).toBe(2);
    expect(body.results[0]).toEqual({
      studentId: "stu1",
      studentName: "Awa Diallo",
      series: "SERIE_C",
      justification: "Profil scientifique solide",
      alternatives: ["SERIE_D"],
      confidence: 0.75,
      success: true,
    });
    expect(aiService.executeGovernance).toHaveBeenCalledWith(
      expect.objectContaining({ action: "recommend-orientation", studentId: "stu1", data: { academicYearId: "ay1" } })
    );
  });

  it("should mark individual failures without failing the batch", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
      { id: "enr1", student: makeStudent("stu1", "Awa Diallo") },
      { id: "enr2", student: makeStudent("stu2", "Jean Mensah") },
    ] as never);
    vi.mocked(aiService.executeGovernance)
      .mockResolvedValueOnce(makeGovernanceResult() as never)
      .mockRejectedValueOnce(new Error("AI timeout"));
    const res = await POST_BATCH(makeRequest("http://localhost/api/orientation/batch-analyze", { method: "POST", body: { academicYearId: "ay1" } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.results[1]).toEqual({
      studentId: "stu2",
      studentName: "Jean Mensah",
      error: "Échec de l'analyse",
      success: false,
    });
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.enrollment.findMany).mockRejectedValue(new Error("db down"));
    const res = await POST_BATCH(makeRequest("http://localhost/api/orientation/batch-analyze", { method: "POST", body: { academicYearId: "ay1" } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de l'analyse globale");
  });
});

describe("POST /api/orientation/generate-ai", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_GENERATE(makeRequest("http://localhost/api/orientation/generate-ai", { method: "POST", body: {} }), { session: null });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST_GENERATE(makeRequest("http://localhost/api/orientation/generate-ai", { method: "POST", body: {} }), { session: makeSession("PARENT") });
    expect(res.status).toBe(403);
  });

  it("should return 400 when studentId or academicYearId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_GENERATE(makeRequest("http://localhost/api/orientation/generate-ai", { method: "POST", body: { studentId: FIXTURES.studentA } }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("studentId et academicYearId requis");
  });

  it("should return recommendations from the AI service", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(aiService.executeGovernance).mockResolvedValue(makeGovernanceResult({
      data: { series: "SERIE_C", justification: "Profil scientifique solide", engine: "template" },
      recommendations: ["SERIE_D", "SERIE_E"],
    }) as never);
    const res = await POST_GENERATE(makeRequest("http://localhost/api/orientation/generate-ai", {
      method: "POST",
      body: { studentId: FIXTURES.studentA, academicYearId: "ay1" },
    }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.studentId).toBe(FIXTURES.studentA);
    expect(body.recommendations).toHaveLength(3);
    expect(body.recommendations[0]).toEqual({ series: "SERIE_C", justification: "Profil scientifique solide", score: 75 });
    expect(body.recommendations[1]).toEqual({ series: "SERIE_D", score: 65, justification: "Alternative suggérée par l'IA" });
    expect(body.engine).toBe("template");
    expect(aiService.executeGovernance).toHaveBeenCalledWith(
      expect.objectContaining({ action: "recommend-orientation", studentId: FIXTURES.studentA, data: { academicYearId: "ay1" } })
    );
  });

  it("should return 500 when the AI analysis reports failure", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(aiService.executeGovernance).mockResolvedValue(makeGovernanceResult({ success: false }) as never);
    const res = await POST_GENERATE(makeRequest("http://localhost/api/orientation/generate-ai", {
      method: "POST",
      body: { studentId: FIXTURES.studentA, academicYearId: "ay1" },
    }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("L'analyse IA a échoué");
  });

  it("should return 500 when the AI service throws", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(aiService.executeGovernance).mockRejectedValue(new Error("provider down"));
    const res = await POST_GENERATE(makeRequest("http://localhost/api/orientation/generate-ai", {
      method: "POST",
      body: { studentId: FIXTURES.studentA, academicYearId: "ay1" },
    }), { session: makeSession("DIRECTOR") });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("provider down");
  });
});