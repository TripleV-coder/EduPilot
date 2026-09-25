import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const gov = vi.hoisted(() => ({ external: false, execute: vi.fn() }));

vi.mock("@/lib/ai/governance-service", () => ({
  governanceService: { execute: gov.execute },
  hasExternalAIConfigured: () => gov.external,
}));
vi.mock("@/lib/ai/external-client", () => ({ callExternalAI: vi.fn() }));
vi.mock("@/lib/ai/n8n-client", () => ({ chatWithAI: vi.fn() }));
vi.mock("@/lib/analytics/service", () => ({ analyticsService: { getSchoolStats: vi.fn() } }));
vi.mock("@/lib/utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { aiService, AIServiceError } from "@/lib/ai/ai-service";
import { callExternalAI } from "@/lib/ai/external-client";
import { chatWithAI } from "@/lib/ai/n8n-client";
import { analyticsService } from "@/lib/analytics/service";
import { logger } from "@/lib/utils/logger";

const baseChat = { message: "Bonjour", userId: "u-1", userRole: "TEACHER" };
const savedHost = process.env.N8N_HOST;

beforeEach(() => {
  vi.clearAllMocks();
  gov.external = false;
  delete process.env.N8N_HOST;
});

afterEach(() => {
  vi.useRealTimers();
  if (savedHost === undefined) delete process.env.N8N_HOST;
  else process.env.N8N_HOST = savedHost;
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

describe("aiService.processChat — routeur 3 couches", () => {
  it("répond par gabarit (couche 2) sans cloud configuré", async () => {
    const r = await aiService.processChat(baseChat);
    expect(r.success).toBe(true);
    expect(r.response).toContain("EduPilot AI");
    expect(r.metadata).toMatchObject({ engine: "template", layer: 2, confidence: 0.72, sources: ["templates", "knowledge_base"] });
    expect(callExternalAI).not.toHaveBeenCalled();
  });

  it("n'initialise le service qu'une seule fois", async () => {
    vi.resetModules();
    const fresh = await import("@/lib/ai/ai-service");
    const { logger: freshLogger } = await import("@/lib/utils/logger");
    vi.mocked(freshLogger.info).mockClear();
    await fresh.aiService.processChat(baseChat);
    await fresh.aiService.processChat(baseChat);
    expect(vi.mocked(freshLogger.info).mock.calls.filter((c) => c[0] === "Initializing AI Service (3-layer router)...")).toHaveLength(1);
  });

  it("utilise l'IA externe (couche 3) avec les options de langue et longueur", async () => {
    gov.external = true;
    vi.mocked(callExternalAI).mockResolvedValueOnce({ success: true, response: "Réponse cloud", provider: "groq" });
    const r = await aiService.processChat({ ...baseChat, options: { language: "en", maxLength: 99, temperature: 0.3 } });
    expect(r.response).toBe("Réponse cloud");
    expect(r.metadata).toMatchObject({ engine: "external", layer: 3, confidence: 0.9, sources: ["knowledge_base", "context"] });
    expect(callExternalAI).toHaveBeenCalledWith({ message: "Bonjour", role: "TEACHER", language: "en", maxTokens: 99, temperature: 0.3 });
  });

  it("bascule sur les gabarits si l'IA externe échoue ou lève (Error ou non)", async () => {
    gov.external = true;
    vi.mocked(callExternalAI)
      .mockResolvedValueOnce({ success: false, response: "", provider: null })
      .mockRejectedValueOnce(new Error("quota"))
      .mockRejectedValueOnce("coupure");
    for (let i = 0; i < 3; i++) {
      expect((await aiService.processChat(baseChat)).metadata?.engine).toBe("template");
    }
    expect(logger.warn).toHaveBeenCalledWith("External AI failed, falling back to templates", { module: "ai-service", error: "quota" });
    expect(logger.warn).toHaveBeenCalledWith("External AI failed, falling back to templates", { module: "ai-service", error: "coupure" });
  });

  it("passe par n8n avec le contexte établissement quand N8N_HOST est défini", async () => {
    process.env.N8N_HOST = "http://n8n";
    vi.mocked(analyticsService.getSchoolStats).mockResolvedValueOnce({ studentsCount: 10 } as never);
    vi.mocked(chatWithAI).mockResolvedValueOnce({ response: "via n8n" });
    const r = await aiService.processChat({ ...baseChat, schoolId: "s-1" });
    expect(r.response).toBe("via n8n");
    expect(r.metadata).toMatchObject({ engine: "n8n", layer: 3, confidence: 0.82 });
    expect(chatWithAI).toHaveBeenCalledWith("Bonjour", { userRole: "TEACHER", userId: "u-1", schoolId: "s-1", context: { studentsCount: 10 } });
  });

  it("appelle n8n sans contexte si le chargement des statistiques échoue", async () => {
    process.env.N8N_HOST = "http://n8n";
    vi.mocked(analyticsService.getSchoolStats).mockRejectedValueOnce(new Error("db")).mockRejectedValueOnce("db2");
    vi.mocked(chatWithAI).mockResolvedValue({ response: "ok" });
    await aiService.processChat({ ...baseChat, schoolId: "s-1" });
    await aiService.processChat({ ...baseChat, schoolId: "s-1" });
    expect(vi.mocked(chatWithAI).mock.calls[0][1]).toMatchObject({ context: {} });
    expect(logger.warn).toHaveBeenCalledWith("Failed to load context for AI", { module: "ai-service", error: "db" });
    expect(logger.warn).toHaveBeenCalledWith("Failed to load context for AI", { module: "ai-service", error: "db2" });
  });

  it("revient aux gabarits si n8n renvoie une réponse non textuelle ou lève", async () => {
    process.env.N8N_HOST = "http://n8n";
    vi.mocked(chatWithAI)
      .mockResolvedValueOnce({ response: 42 } as never)
      .mockRejectedValueOnce(new Error("N8N_ERROR"))
      .mockRejectedValueOnce("hors ligne");
    for (let i = 0; i < 3; i++) {
      expect((await aiService.processChat(baseChat)).metadata?.engine).toBe("template");
    }
    expect(analyticsService.getSchoolStats).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("n8n failed, falling back to templates", { module: "ai-service", error: "N8N_ERROR" });
    expect(logger.warn).toHaveBeenCalledWith("n8n failed, falling back to templates", { module: "ai-service", error: "hors ligne" });
  });

  it("diffuse la réponse par morceaux en mode streaming", async () => {
    vi.useFakeTimers();
    gov.external = true;
    const para1 = "Court paragraphe.";
    const para2 = "Ceci est un long paragraphe qui dépasse largement cinquante caractères pour être découpé.";
    vi.mocked(callExternalAI).mockResolvedValueOnce({ success: true, response: `${para1}\n\n${para2}`, provider: "groq" });
    const tokens: string[] = [];
    const p = aiService.processChat({ ...baseChat, stream: true, onToken: (t) => tokens.push(t) });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(tokens[0]).toBe(para1);
    expect(tokens.length).toBeGreaterThan(2);
    expect(tokens.slice(1).join("")).toBe(para2);
    expect(tokens.slice(1).every((t) => t.length <= 30 || !t.trim().includes(" "))).toBe(true);
    expect(r.response).toBe(`${para1}\n\n${para2}`);
  });

  it("gère un premier mot plus long que la taille de morceau", async () => {
    vi.useFakeTimers();
    gov.external = true;
    const word = "a".repeat(60);
    vi.mocked(callExternalAI).mockResolvedValueOnce({ success: true, response: word, provider: "groq" });
    const tokens: string[] = [];
    const p = aiService.processChat({ ...baseChat, stream: true, onToken: (t) => tokens.push(t) });
    await vi.runAllTimersAsync();
    await p;
    expect(tokens).toEqual([word]);
  });

  it("ne diffuse rien sans callback onToken", async () => {
    const r = await aiService.processChat({ ...baseChat, stream: true });
    expect(r.success).toBe(true);
  });
});

describe("aiService — gouvernance et statut", () => {
  it("délègue la gouvernance au service dédié", async () => {
    gov.execute.mockResolvedValueOnce({ success: true, action: "analyze-student", data: { ok: 1 } });
    const r = await aiService.executeGovernance({ action: "analyze-student", userId: "u", userRole: "SCHOOL_ADMIN" });
    expect(r).toMatchObject({ success: true, data: { ok: 1 } });
    expect(gov.execute).toHaveBeenCalledWith({ action: "analyze-student", userId: "u", userRole: "SCHOOL_ADMIN" }, expect.any(Number));
  });

  it("indique le mode autonome ou cloud selon la configuration", () => {
    expect(aiService.getStatus()).toMatchObject({ operational: true, modelLoaded: true, externalConfigured: false, n8nConfigured: false, templatesAvailable: true, runtimeMode: "autonomous" });
    process.env.N8N_HOST = "http://n8n";
    expect(aiService.getStatus()).toMatchObject({ n8nConfigured: true, runtimeMode: "cloud_enhanced" });
    delete process.env.N8N_HOST;
    gov.external = true;
    expect(aiService.getStatus()).toMatchObject({ externalConfigured: true, runtimeMode: "cloud_enhanced" });
  });
});
