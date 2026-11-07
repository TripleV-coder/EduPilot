import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { studentProfile: { findUnique: vi.fn() } } }));
vi.mock("@/lib/ai/ai-service", () => {
  class AIServiceError extends Error {
    status = 400;
    code = "AI_SERVICE_ERROR";
  }
  return { AIServiceError, aiService: { executeGovernance: vi.fn(), getStatus: vi.fn() } };
});
vi.mock("@/lib/ai/assistant/engine", () => ({ answerQuestion: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import { aiService } from "@/lib/ai/ai-service";
import { answerQuestion } from "@/lib/ai/assistant/engine";
import { checkRateLimit } from "@/lib/rate-limit";
import * as analyzeRisk from "@/app/api/ai/analyze-risk/route";
import * as chat from "@/app/api/ai/v2/chat/route";

// Les routes IA lisent largement la base (analyses, risques, périmètre) :
// elles refusent (429) avant tout calcul quand la limite stricte est atteinte.
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolA }));
  vi.mocked(checkRateLimit).mockResolvedValue({ success: false, reset: new Date(Date.now() + 30_000) } as never);
});

describe("limite stricte des routes IA", () => {
  it.each([
    ["analyze-risk", () => analyzeRisk.POST(makeRequest("http://localhost/api/ai/analyze-risk", { method: "POST", body: { studentId: "s1" } }))],
    ["chat", () => chat.POST(makeRequest("http://localhost/api/ai/v2/chat", { method: "POST", body: { message: "Bonjour" } }))],
  ])("%s répond 429 avec Retry-After sans rien calculer", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(aiService.executeGovernance).not.toHaveBeenCalled();
    expect(answerQuestion).not.toHaveBeenCalled();
  });
});
