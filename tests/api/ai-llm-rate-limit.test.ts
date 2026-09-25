import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { studentProfile: { findUnique: vi.fn() } } }));
vi.mock("@/lib/ai/n8n-client", () => ({ analyzeStudentPerformance: vi.fn() }));
vi.mock("@/lib/ai/ai-service", () => {
  class AIServiceError extends Error {
    status = 400;
    code = "AI_SERVICE_ERROR";
  }
  return { AIServiceError, aiService: { processChat: vi.fn(), executeGovernance: vi.fn(), getStatus: vi.fn() } };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import { aiService } from "@/lib/ai/ai-service";
import { analyzeStudentPerformance } from "@/lib/ai/n8n-client";
import { checkRateLimit } from "@/lib/rate-limit";
import * as analyze from "@/app/api/ai/analyze/route";
import * as analyzeRisk from "@/app/api/ai/analyze-risk/route";
import * as local from "@/app/api/ai/local/route";

// Ces trois routes appellent un LLM facturé : elles doivent refuser (429)
// avant tout appel quand la limite stricte est atteinte.
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: FIXTURES.schoolA }));
  vi.mocked(checkRateLimit).mockResolvedValue({ success: false, reset: new Date(Date.now() + 30_000) } as never);
});

describe("limite stricte des routes LLM", () => {
  it.each([
    ["analyze", () => analyze.POST(makeRequest("http://localhost/api/ai/analyze", { method: "POST", body: { studentId: "s1" } }))],
    ["analyze-risk", () => analyzeRisk.POST(makeRequest("http://localhost/api/ai/analyze-risk", { method: "POST", body: { studentId: "s1" } }))],
    ["local", () => local.POST(makeRequest("http://localhost/api/ai/local?endpoint=chat", { method: "POST", body: { message: "Bonjour" } }))],
  ])("%s répond 429 avec Retry-After sans appeler le LLM", async (_name, call) => {
    const res = await call();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(analyzeStudentPerformance).not.toHaveBeenCalled();
    expect(aiService.processChat).not.toHaveBeenCalled();
    expect(aiService.executeGovernance).not.toHaveBeenCalled();
  });
});
