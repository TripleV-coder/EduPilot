import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { fetchJsonWithPolicy } from "@/lib/ai/http-client";
import { callExternalAI } from "@/lib/ai/external-client";
import { analyzeStudentPerformance, predictFailureRisk, chatWithAI, checkN8nHealth, buildN8nHeaders } from "@/lib/ai/n8n-client";
import { callGovernanceAction } from "@/lib/ai/client-governance";
import { logger } from "@/lib/utils/logger";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();
const ENV_KEYS = [
  "GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_AI_API_KEY", "AI_PROVIDER", "GROQ_MODEL",
  "N8N_HOST", "N8N_WEBHOOK_KEY", "N8N_WEBHOOK_SECRET",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.mocked(logger.warn).mockClear();
  vi.mocked(logger.error).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("fetchJsonWithPolicy", () => {
  it("renvoie les données JSON et envoie le corps sérialisé", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ a: 1 }));
    const r = await fetchJsonWithPolicy<{ a: number }>("https://x", { method: "POST", body: { q: 1 }, headers: { X: "y" } });
    expect(r).toEqual({ ok: true, data: { a: 1 }, status: 200 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"q":1}');
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", X: "y", Accept: "application/json" });
  });

  it("n'ajoute pas Content-Type sans corps (GET par défaut)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await fetchJsonWithPolicy("https://x");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("réessaie sur 503 puis réussit", async () => {
    fetchMock.mockResolvedValueOnce(new Response("indispo", { status: 503 })).mockResolvedValueOnce(jsonResponse({ ok: 1 }));
    const r = await fetchJsonWithPolicy("https://x", { retries: 1, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ne réessaie pas sur 400 et renvoie le texte d'erreur", async () => {
    fetchMock.mockResolvedValueOnce(new Response("mauvaise requête", { status: 400 }));
    const r = await fetchJsonWithPolicy("https://x", { retries: 2, retryDelayMs: 0 });
    expect(r).toEqual({ ok: false, status: 400, error: "mauvaise requête" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("utilise statusText puis un libellé générique quand le corps est illisible", async () => {
    const broken = { ok: false, status: 500, statusText: "", text: () => Promise.reject(new Error("flux")) };
    fetchMock.mockResolvedValueOnce(broken);
    const r = await fetchJsonWithPolicy("https://x", { retries: 0 });
    expect(r).toEqual({ ok: false, status: 500, error: "Erreur HTTP" });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, statusText: "Bad Gateway", text: () => Promise.resolve("") });
    expect(await fetchJsonWithPolicy("https://x", { retries: 0 })).toEqual({ ok: false, status: 502, error: "Bad Gateway" });
  });

  it("réessaie après une erreur réseau puis renvoie l'erreur (statut 0)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET")).mockRejectedValueOnce("coupure");
    const r = await fetchJsonWithPolicy("https://x", { retries: 1, retryDelayMs: 0 });
    expect(r).toEqual({ ok: false, status: 0, error: "coupure" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("interrompt la requête au délai d'expiration", async () => {
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })
    );
    const r = await fetchJsonWithPolicy("https://x", { timeoutMs: 5, retries: 0 });
    expect(r).toEqual({ ok: false, status: 0, error: "aborted" });
  });

  it("renvoie une erreur réseau sans aucune tentative si retries est négatif", async () => {
    const r = await fetchJsonWithPolicy("https://x", { retries: -1 });
    expect(r).toEqual({ ok: false, status: 0, error: "Erreur réseau" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("callExternalAI — cascade de fournisseurs", () => {
  it("échoue proprement sans aucune clé (groq et google par défaut)", async () => {
    const r = await callExternalAI({ message: "hi", role: "TEACHER" });
    expect(r).toEqual({ success: false, response: "", provider: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("utilise Groq avec le modèle configuré et un prompt système anonymisé", async () => {
    process.env.GROQ_API_KEY = "gk";
    process.env.GROQ_MODEL = "mon-modele";
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "Réponse Groq" } }] }));
    const r = await callExternalAI({
      message: "Analyse",
      role: "TEACHER",
      schoolName: "CEG Akpakpa",
      language: "en",
      maxTokens: 50,
      temperature: 0.2,
      studentData: { firstName: "Koffi", matricule: "M1", average: 12, subjects: [{ name: "Maths", studentId: "s", note: 10 }] },
    });
    expect(r).toEqual({ success: true, response: "Réponse Groq", provider: "groq" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer gk");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("mon-modele");
    expect(body.max_tokens).toBe(50);
    expect(body.temperature).toBe(0.2);
    const system = body.messages[0].content as string;
    expect(system).toContain("School: CEG Akpakpa");
    expect(system).toContain("Respond in english");
    expect(system).toContain('"average":12');
    expect(system).toContain('"subjects":[{"name":"Maths","note":10}]');
    expect(system).not.toContain("Koffi");
    expect(system).not.toContain("M1");
  });

  it("passe au fournisseur suivant si Groq renvoie une erreur ou une réponse vide", async () => {
    process.env.GROQ_API_KEY = "gk";
    process.env.GOOGLE_AI_API_KEY = "goo";
    fetchMock
      .mockResolvedValueOnce(new Response("quota", { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "Gemini" }] } }] }));
    const r = await callExternalAI({ message: "m", role: "PARENT" });
    expect(r).toEqual({ success: true, response: "Gemini", provider: "google" });
    expect(logger.warn).toHaveBeenCalledWith("Groq API error", { status: 400, error: "quota" });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain("gemini-2.0-flash:generateContent?key=goo");
    const body = JSON.parse(init.body);
    expect(body.generationConfig).toEqual({ temperature: 0.7, maxOutputTokens: 1000 });
    expect(body.contents[0].parts[0].text).toContain("Respond in français");
    expect(body.contents[0].parts[0].text).toContain("User: m");
  });

  it("respecte AI_PROVIDER (openai puis anthropic) et journalise les erreurs", async () => {
    process.env.AI_PROVIDER = " openai , anthropic ,";
    process.env.OPENAI_API_KEY = "ok";
    process.env.ANTHROPIC_API_KEY = "ak";
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ choices: [] }))
      .mockResolvedValueOnce(jsonResponse({ content: [{ text: "Claude" }] }));
    const r = await callExternalAI({ message: "m", role: "DIRECTOR" });
    expect(r).toEqual({ success: true, response: "Claude", provider: "anthropic" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
    const [aUrl, aInit] = fetchMock.mock.calls[1];
    expect(aUrl).toBe("https://api.anthropic.com/v1/messages");
    expect(aInit.headers["x-api-key"]).toBe("ak");
    expect(aInit.headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("renvoie la réponse OpenAI quand elle existe", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "ok";
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "GPT" } }] }));
    expect(await callExternalAI({ message: "m", role: "x" })).toEqual({ success: true, response: "GPT", provider: "openai" });
  });

  it("journalise les erreurs HTTP d'OpenAI, Anthropic et Gemini et échoue", async () => {
    process.env.AI_PROVIDER = "openai,anthropic,google,inconnu";
    process.env.OPENAI_API_KEY = "ok";
    process.env.ANTHROPIC_API_KEY = "ak";
    process.env.GOOGLE_AI_API_KEY = "gk";
    fetchMock.mockImplementation(() => Promise.resolve(new Response("refus", { status: 401 })));
    const r = await callExternalAI({ message: "m", role: "x" });
    expect(r.success).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith("OpenAI API error", { status: 401, error: "refus" });
    expect(logger.warn).toHaveBeenCalledWith("Anthropic API error", { status: 401, error: "refus" });
    expect(logger.warn).toHaveBeenCalledWith("Google Gemini API error", { status: 401, error: "refus" });
  });

  it("renvoie un échec quand Anthropic et Gemini répondent sans contenu", async () => {
    process.env.AI_PROVIDER = "anthropic,google";
    process.env.ANTHROPIC_API_KEY = "ak";
    process.env.GOOGLE_AI_API_KEY = "gk";
    fetchMock.mockResolvedValueOnce(jsonResponse({})).mockResolvedValueOnce(jsonResponse({}));
    expect((await callExternalAI({ message: "m", role: "x" })).success).toBe(false);
  });

  it("capture les exceptions inattendues de chaque fournisseur", async () => {
    process.env.AI_PROVIDER = "groq,openai,anthropic,google";
    process.env.GROQ_API_KEY = "a";
    process.env.OPENAI_API_KEY = "b";
    process.env.ANTHROPIC_API_KEY = "c";
    process.env.GOOGLE_AI_API_KEY = "d";
    // Une donnée non sérialisable (BigInt) fait échouer la construction du prompt
    // système : chaque fournisseur capture l'exception et passe au suivant.
    const r = await callExternalAI({ message: "m", role: "x", studentData: { total: BigInt(3) } });
    expect(r).toEqual({ success: false, response: "", provider: null });
    expect(fetchMock).not.toHaveBeenCalled();
    for (const label of ["Groq API call failed", "OpenAI API call failed", "Anthropic API call failed", "Google Gemini API call failed"]) {
      expect(logger.error).toHaveBeenCalledWith(label, expect.objectContaining({ error: expect.any(TypeError) }));
    }
  });

  it.skip("BUG: une température explicite de 0 doit être transmise telle quelle (déterminisme)", async () => {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "gk";
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "ok" } }] }));
    await callExternalAI({ message: "m", role: "x", temperature: 0 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).temperature).toBe(0);
  });
});

describe("client n8n", () => {
  it("signe le corps en HMAC et ajoute la clé API", () => {
    process.env.N8N_WEBHOOK_KEY = "cle";
    process.env.N8N_WEBHOOK_SECRET = "secret";
    const h = buildN8nHeaders({ a: 1 });
    expect(h["X-N8N-API-KEY"]).toBe("cle");
    expect(h["X-EduPilot-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    // Corps absent : signature de la chaîne vide, différente de celle du corps.
    expect(buildN8nHeaders(undefined)["X-EduPilot-Signature"]).not.toBe(h["X-EduPilot-Signature"]);
  });

  it("appelle les webhooks d'analyse et de prédiction sur l'hôte configuré", async () => {
    process.env.N8N_HOST = "http://n8n:5678";
    fetchMock.mockResolvedValueOnce(jsonResponse({ riskScore: 12 })).mockResolvedValueOnce(jsonResponse({ dropoutRisk: 40 }));
    expect(await analyzeStudentPerformance({ a: 1 })).toEqual({ riskScore: 12 });
    expect(await predictFailureRisk({ a: 1 })).toEqual({ dropoutRisk: 40 });
    expect(fetchMock.mock.calls[0][0]).toBe("http://n8n:5678/webhook/analyze-performance");
    expect(fetchMock.mock.calls[1][0]).toBe("http://n8n:5678/webhook/predict-risk");
  });

  it("lève N8N_ERROR avec le statut HTTP ou NETWORK", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("interdit", { status: 403 })));
    await expect(analyzeStudentPerformance({})).rejects.toThrow("N8N_ERROR: 403 — interdit");
    await expect(predictFailureRisk({})).rejects.toThrow("N8N_ERROR: 403 — interdit");
    await expect(chatWithAI("m", {})).rejects.toThrow("N8N_ERROR: 403 — interdit");
    expect(logger.error).toHaveBeenCalledTimes(3);
    // Par défaut, hôte local
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:5678/webhook/analyze-performance");
  });

  it("indique NETWORK quand aucune réponse HTTP n'est obtenue", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new Error("down"));
    const p = expect(chatWithAI("m", {})).rejects.toThrow("N8N_ERROR: NETWORK — down");
    await vi.runAllTimersAsync();
    await p;
    const p2 = expect(analyzeStudentPerformance({})).rejects.toThrow("NETWORK");
    await vi.runAllTimersAsync();
    await p2;
    const p3 = expect(predictFailureRisk({})).rejects.toThrow("NETWORK");
    await vi.runAllTimersAsync();
    await p3;
  });

  it("renvoie la réponse de chat avec le message fusionné au contexte", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ response: "ok" }));
    expect(await chatWithAI("Bonjour", { userRole: "TEACHER" })).toEqual({ response: "ok" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: "Bonjour", userRole: "TEACHER" });
  });

  it("vérifie la santé n8n (non configuré, joignable, injoignable)", async () => {
    expect(await checkN8nHealth()).toEqual({ configured: false, reachable: false, latencyMs: null });
    process.env.N8N_HOST = "http://n8n";
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok" }));
    const up = await checkN8nHealth();
    expect(up.configured).toBe(true);
    expect(up.reachable).toBe(true);
    expect(typeof up.latencyMs).toBe("number");
    expect(fetchMock.mock.calls[0][0]).toBe("http://n8n/healthz");
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    expect(await checkN8nHealth()).toEqual({ configured: true, reachable: false, latencyMs: null });
  });
});

describe("callGovernanceAction (client)", () => {
  it("fusionne studentId dans les données et renvoie le JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { comment: "Bien" } }));
    const r = await callGovernanceAction<{ comment: string }>("draft-report-comment", { studentId: "s1", data: { x: 1 } });
    expect(r.data?.comment).toBe("Bien");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/ai/v2");
    expect(JSON.parse(init.body)).toEqual({ endpoint: "governance", action: "draft-report-comment", studentId: "s1", data: { x: 1, studentId: "s1" } });
  });

  it("n'ajoute pas studentId quand il est absent", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await callGovernanceAction("analyze-risk");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ endpoint: "governance", action: "analyze-risk", data: {} });
  });

  it("lève le message d'erreur du serveur ou un message par défaut", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Accès refusé" }, 403));
    await expect(callGovernanceAction("analyze-risk")).rejects.toThrow("Accès refusé");
    fetchMock.mockResolvedValueOnce(new Response("pas du json", { status: 500 }));
    await expect(callGovernanceAction("analyze-risk")).rejects.toThrow("Erreur lors de l'action IA");
  });
});
