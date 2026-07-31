import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { buildN8nHeaders, checkN8nHealth, chatWithAI } from "@/lib/ai/n8n-client";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  delete process.env.N8N_WEBHOOK_SECRET;
  delete process.env.N8N_HOST;
});

describe("buildN8nHeaders — authentification des webhooks", () => {
  it("ne met aucun header sans clé ni secret", () => {
    const headers = buildN8nHeaders({ a: 1 });
    expect(headers["X-N8N-API-KEY"]).toBeUndefined();
    expect(headers["X-EduPilot-Signature"]).toBeUndefined();
  });

  it("signe le payload en HMAC-SHA256 quand N8N_WEBHOOK_SECRET est défini", () => {
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
    const headers = buildN8nHeaders({ message: "bonjour" });
    expect(headers["X-EduPilot-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("produit une signature différente pour des payloads différents", () => {
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
    const sig1 = buildN8nHeaders({ message: "a" })["X-EduPilot-Signature"];
    const sig2 = buildN8nHeaders({ message: "b" })["X-EduPilot-Signature"];
    expect(sig1).not.toBe(sig2);
  });

  it("produit une signature stable pour le même payload", () => {
    process.env.N8N_WEBHOOK_SECRET = "test-secret";
    const sig1 = buildN8nHeaders({ message: "même" })["X-EduPilot-Signature"];
    const sig2 = buildN8nHeaders({ message: "même" })["X-EduPilot-Signature"];
    expect(sig1).toBe(sig2);
  });
});

describe("checkN8nHealth — joignabilité de l'instance", () => {
  it("retourne configured=false sans N8N_HOST", async () => {
    const health = await checkN8nHealth();
    expect(health).toEqual({ configured: false, reachable: false, latencyMs: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retourne reachable=true avec latence quand /healthz répond", async () => {
    process.env.N8N_HOST = "https://n8n.test";
    fetchMock.mockResolvedValue(jsonResponse({ status: "ok" }));

    const health = await checkN8nHealth();
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(true);
    expect(typeof health.latencyMs).toBe("number");
  });

  it("retourne reachable=false quand n8n est injoignable", async () => {
    process.env.N8N_HOST = "https://n8n.test";
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const health = await checkN8nHealth();
    expect(health.configured).toBe(true);
    expect(health.reachable).toBe(false);
    expect(health.latencyMs).toBeNull();
  });
});

describe("chatWithAI — politique réseau", () => {
  it("retourne la réponse du webhook chat", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ response: "Bonjour, comment puis-je aider ?" }));

    const result = await chatWithAI("salut", { userRole: "STUDENT" });
    expect(result.response).toContain("Bonjour");
  });

  it("retry une fois sur 503 puis réussit", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "busy" }, 503))
      .mockResolvedValueOnce(jsonResponse({ response: "ok après retry" }));

    const result = await chatWithAI("salut", {});
    expect(result.response).toBe("ok après retry");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lève une erreur N8N_ERROR après épuisement des retries", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "down" }, 503));

    await expect(chatWithAI("salut", {})).rejects.toThrow(/N8N_ERROR/);
  });

  it("n'effectue PAS de retry sur une 400 (erreur non transitoire)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "bad payload" }, 400));

    await expect(chatWithAI("salut", {})).rejects.toThrow(/N8N_ERROR: 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
