/**
 * Couverture des routes IA adossées à n8n / au service IA :
 * /api/ai/analyze, /api/ai/predict-failure, /api/ai/chatbot, /api/ai/analyze-risk.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "../../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    parentStudent: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/ai/n8n-client", () => ({
  analyzeStudentPerformance: vi.fn(),
  predictFailureRisk: vi.fn(),
  chatWithAI: vi.fn(),
}));
vi.mock("@/lib/ai/ai-service", () => ({ aiService: { executeGovernance: vi.fn() } }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import prisma from "@/lib/prisma";
import { analyzeStudentPerformance, predictFailureRisk, chatWithAI } from "@/lib/ai/n8n-client";
import { aiService } from "@/lib/ai/ai-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { POST as analyzePOST } from "@/app/api/ai/analyze/route";
import { POST as predictPOST } from "@/app/api/ai/predict-failure/route";
import { POST as chatbotPOST } from "@/app/api/ai/chatbot/route";
import { POST as riskPOST } from "@/app/api/ai/analyze-risk/route";

const asRole = (role: string, opts: { id?: string; schoolId?: string | null } = {}) =>
  vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA, ...opts }));
const req = (path: string, body: unknown) => makeRequest(`http://localhost/api/ai/${path}`, { method: "POST", body });

const studentRecord = (over: Record<string, unknown> = {}) => ({
  id: "stu-1",
  userId: "u-stu",
  schoolId: FIXTURES.schoolA,
  user: { firstName: "Koffi", lastName: "Adjovi", schoolId: FIXTURES.schoolA },
  grades: [
    { value: 12, evaluation: { maxGrade: 20, date: new Date("2026-01-10"), classSubject: { subject: { name: "Maths" } } } },
  ],
  attendances: [{ status: "ABSENT" }, { status: "LATE" }, { status: "PRESENT" }, { status: "ABSENT" }],
  behaviorIncidents: [{ id: "inc-1" }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true, reset: new Date() } as never);
  vi.mocked(analyzeStudentPerformance).mockResolvedValue({ summary: "ok" } as never);
  vi.mocked(predictFailureRisk).mockResolvedValue({ risk: "LOW" } as never);
  vi.mocked(chatWithAI).mockResolvedValue({ reply: "Bonjour" } as never);
});

describe("POST /api/ai/analyze", () => {
  it("exige studentId (400)", async () => {
    asRole("TEACHER");
    expect((await analyzePOST(req("analyze", {}))).status).toBe(400);
  });

  it("renvoie 404 si l'élève n'existe pas", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await analyzePOST(req("analyze", { studentId: "stu-x" }))).status).toBe(404);
  });

  it("refuse un élève d'une autre école (403)", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord({ schoolId: FIXTURES.schoolB }) as never);
    expect((await analyzePOST(req("analyze", { studentId: "stu-1" }))).status).toBe(403);
    expect(analyzeStudentPerformance).not.toHaveBeenCalled();
  });

  it("pseudonymise l'élève et agrège absences/retards avant l'envoi à n8n", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    const res = await analyzePOST(req("analyze", { studentId: "stu-1", periodId: "per-1" }));
    expect(res.status).toBe(200);
    const findArgs = vi.mocked(prisma.studentProfile.findUnique).mock.calls[0][0] as { include: { grades: { where: unknown } } };
    expect(findArgs.include.grades.where).toEqual({ evaluation: { periodId: "per-1" } });
    const payload = vi.mocked(analyzeStudentPerformance).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload.studentName).not.toContain("Koffi");
    expect(payload.attendance).toEqual({ absences: 2, lates: 1 });
    expect(payload.incidents).toBe(1);
    expect(payload.grades).toEqual([{ subject: "Maths", grade: 12, max: 20, date: new Date("2026-01-10") }]);
  });

  it("sans période, ne filtre pas les notes", async () => {
    asRole("DIRECTOR");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    await analyzePOST(req("analyze", { studentId: "stu-1" }));
    const findArgs = vi.mocked(prisma.studentProfile.findUnique).mock.calls[0][0] as { include: { grades: { where: unknown } } };
    expect(findArgs.include.grades.where).toBeUndefined();
  });

  it("un élève ne peut analyser que lui-même (403 sinon)", async () => {
    asRole("STUDENT", { id: "u-autre" });
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    expect((await analyzePOST(req("analyze", { studentId: "stu-1" }))).status).toBe(403);
    asRole("STUDENT", { id: "u-stu" });
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    expect((await analyzePOST(req("analyze", { studentId: "stu-1" }))).status).toBe(200);
  });

  it("un parent sans profil est refusé (403)", async () => {
    asRole("PARENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await analyzePOST(req("analyze", { studentId: "stu-1" }))).status).toBe(403);
  });

  it("un parent non lié à l'élève est refusé (403)", async () => {
    asRole("PARENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ id: "par-1" } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValueOnce(null as never);
    expect((await analyzePOST(req("analyze", { studentId: "stu-1" }))).status).toBe(403);
    expect(vi.mocked(prisma.parentStudent.findUnique).mock.calls[0][0]).toEqual({
      where: { parentId_studentId: { parentId: "par-1", studentId: "stu-1" } },
    });
  });

  it("un parent lié à l'élève obtient l'analyse", async () => {
    asRole("PARENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    vi.mocked(prisma.parentProfile.findUnique).mockResolvedValueOnce({ id: "par-1" } as never);
    vi.mocked(prisma.parentStudent.findUnique).mockResolvedValueOnce({ parentId: "par-1" } as never);
    const res = await analyzePOST(req("analyze", { studentId: "stu-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ summary: "ok" });
  });

  it("renvoie un 500 générique si n8n échoue", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    vi.mocked(analyzeStudentPerformance).mockRejectedValueOnce(new Error("n8n token=abc"));
    const res = await analyzePOST(req("analyze", { studentId: "stu-1" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("token");
  });
});

describe("POST /api/ai/predict-failure", () => {
  it("applique la limite de débit stricte (429 + Retry-After)", async () => {
    asRole("TEACHER", { id: "u-t" });
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, reset: new Date(Date.now() + 30_000) } as never);
    const res = await predictPOST(req("predict-failure", { studentId: "stu-1" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(vi.mocked(checkRateLimit).mock.calls[0][1]).toContain("ai:predict-failure:u-t:");
  });

  it("exige studentId (400)", async () => {
    asRole("TEACHER");
    expect((await predictPOST(req("predict-failure", {}))).status).toBe(400);
  });

  it("renvoie 404 si l'élève n'existe pas", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(null as never);
    expect((await predictPOST(req("predict-failure", { studentId: "x" }))).status).toBe(404);
  });

  it("refuse un élève d'une autre école (403)", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord({ schoolId: FIXTURES.schoolB }) as never);
    expect((await predictPOST(req("predict-failure", { studentId: "stu-1" }))).status).toBe(403);
    expect(predictFailureRisk).not.toHaveBeenCalled();
  });

  it("refuse les parents (confidentialité, 403)", async () => {
    asRole("PARENT");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    expect((await predictPOST(req("predict-failure", { studentId: "stu-1" }))).status).toBe(403);
    expect(predictFailureRisk).not.toHaveBeenCalled();
  });

  it("transmet notes, absences et incidents à la prédiction", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValueOnce(studentRecord() as never);
    const res = await predictPOST(req("predict-failure", { studentId: "stu-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ risk: "LOW" });
    expect(predictFailureRisk).toHaveBeenCalledWith({
      grades: [{ subject: "Maths", value: 12, date: new Date("2026-01-10") }],
      absences: 2,
      incidents: 1,
    });
  });

  it("renvoie un 500 générique en cas d'erreur", async () => {
    asRole("TEACHER");
    vi.mocked(prisma.studentProfile.findUnique).mockRejectedValueOnce(new Error("db"));
    const res = await predictPOST(req("predict-failure", { studentId: "stu-1" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur lors de la prédiction" });
  });
});

describe("POST /api/ai/chatbot", () => {
  it("applique la limite de débit (429)", async () => {
    asRole("PARENT");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, reset: new Date(Date.now() + 10_000) } as never);
    const res = await chatbotPOST(req("chatbot", { message: "hi" }));
    expect(res.status).toBe(429);
    expect(chatWithAI).not.toHaveBeenCalled();
  });

  it("exige un message (400)", async () => {
    asRole("PARENT");
    expect((await chatbotPOST(req("chatbot", {}))).status).toBe(400);
  });

  it("transmet le contexte de l'utilisateur et de son école", async () => {
    asRole("PARENT", { id: "u-p" });
    const res = await chatbotPOST(req("chatbot", { message: "Notes ?" }));
    expect(res.status).toBe(200);
    expect(chatWithAI).toHaveBeenCalledWith("Notes ?", { userId: "u-p", schoolId: FIXTURES.schoolA, role: "PARENT", history: [] });
  });

  it("conserve l'historique fourni", async () => {
    asRole("TEACHER");
    const history = [{ role: "user", content: "a" }];
    await chatbotPOST(req("chatbot", { message: "b", history }));
    expect(vi.mocked(chatWithAI).mock.calls[0][1]).toEqual(expect.objectContaining({ history }));
  });

  it("renvoie un 500 générique si l'assistant échoue", async () => {
    asRole("TEACHER");
    vi.mocked(chatWithAI).mockRejectedValueOnce(new Error("clé API"));
    const res = await chatbotPOST(req("chatbot", { message: "b" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("clé");
  });
});

describe("POST /api/ai/analyze-risk", () => {
  it("exige studentId (400)", async () => {
    asRole("TEACHER");
    expect((await riskPOST(req("analyze-risk", {}))).status).toBe(400);
  });

  it("délègue à la gouvernance IA avec l'école active", async () => {
    asRole("TEACHER", { id: "u-t" });
    vi.mocked(aiService.executeGovernance).mockResolvedValueOnce({ risk: "HIGH" } as never);
    const res = await riskPOST(req("analyze-risk", { studentId: "stu-1", academicYearId: "ay-1" }));
    expect(res.status).toBe(200);
    expect(aiService.executeGovernance).toHaveBeenCalledWith({
      action: "analyze-risk",
      studentId: "stu-1",
      userId: "u-t",
      userRole: "TEACHER",
      schoolId: FIXTURES.schoolA,
      data: { academicYearId: "ay-1" },
    });
  });

  it("relaie le message et le statut d'une erreur du service IA", async () => {
    asRole("PARENT");
    const err = Object.assign(new Error("Élève introuvable"), { name: "AIServiceError", status: 404 });
    vi.mocked(aiService.executeGovernance).mockRejectedValueOnce(err);
    const res = await riskPOST(req("analyze-risk", { studentId: "stu-1" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Élève introuvable" });
  });

  it("masque les erreurs inattendues (500 générique)", async () => {
    asRole("TEACHER");
    vi.mocked(aiService.executeGovernance).mockRejectedValueOnce(new Error("SELECT * secret"));
    const res = await riskPOST(req("analyze-risk", { studentId: "stu-1" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur lors de l'analyse de risque" });
  });
});
