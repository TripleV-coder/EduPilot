/**
 * Vérifie que le routeur IA fonctionne sans aucune clé cloud (mode autonome).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

vi.mock("@/lib/analytics/service", () => ({
    analyticsService: { getSchoolStats: vi.fn().mockResolvedValue({}) },
}));

vi.mock("@/lib/ai/external-client", () => ({
    callExternalAI: vi.fn(),
}));

vi.mock("@/lib/ai/n8n-client", () => ({
    chatWithAI: vi.fn(),
}));

describe("AIService — mode autonome sans clé API", () => {
    const savedEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
        process.env = {
            ...savedEnv,
            GROQ_API_KEY: "",
            OPENAI_API_KEY: "",
            ANTHROPIC_API_KEY: "",
            GOOGLE_AI_API_KEY: "",
            N8N_HOST: "",
            AI_ENABLED: "true",
        };
    });

    afterEach(() => {
        process.env = savedEnv;
    });

    it("getStatus signale le mode autonome sans providers cloud", async () => {
        const { aiService } = await import("@/lib/ai/ai-service");
        const status = aiService.getStatus();
        expect(status.operational).toBe(true);
        expect(status.templatesAvailable).toBe(true);
        expect(status.externalConfigured).toBe(false);
        expect(status.n8nConfigured).toBe(false);
        expect(status.runtimeMode).toBe("autonomous");
    });

    it("processChat renvoie une réponse gabarit sans 503", async () => {
        const { aiService } = await import("@/lib/ai/ai-service");
        const result = await aiService.processChat({
            message: "Bonjour, comment consulter les notes ?",
            userId: "user-test",
            userRole: "TEACHER",
        });

        expect(result.success).toBe(true);
        expect(result.response.length).toBeGreaterThan(10);
        expect(result.metadata?.engine).toBe("template");
        expect(result.metadata?.layer).toBe(2);
    });
});
