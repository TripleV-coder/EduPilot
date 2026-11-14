import { describe, it, expect, vi, beforeEach } from "vitest";

const gov = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("@/lib/ai/governance-service", () => ({ governanceService: { execute: gov.execute } }));

import { aiService, AIServiceError } from "@/lib/ai/ai-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AIServiceError", () => {
  it("porte statut et code, avec valeurs par défaut", () => {
    const e = new AIServiceError("oups");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("AIServiceError");
    expect(e.status).toBe(400);
    expect(e.code).toBe("AI_SERVICE_ERROR");
    expect(new AIServiceError("x", 404, "NF")).toMatchObject({ status: 404, code: "NF" });
  });
});

describe("aiService — gouvernance et statut", () => {
  it("délègue la gouvernance au service dédié", async () => {
    gov.execute.mockResolvedValueOnce({ success: true, action: "analyze-student", data: { ok: 1 } });
    const r = await aiService.executeGovernance({ action: "analyze-student", userId: "u", userRole: "SCHOOL_ADMIN" });
    expect(r).toMatchObject({ success: true, data: { ok: 1 } });
    expect(gov.execute).toHaveBeenCalledWith({ action: "analyze-student", userId: "u", userRole: "SCHOOL_ADMIN" }, expect.any(Number));
  });

  it("fonctionne toujours en mode local, quelle que soit la configuration", () => {
    process.env.N8N_HOST = "http://n8n";
    process.env.GOOGLE_AI_API_KEY = "clé";
    expect(aiService.getStatus()).toEqual({ operational: true, runtimeMode: "local" });
    delete process.env.N8N_HOST;
    delete process.env.GOOGLE_AI_API_KEY;
  });
});
