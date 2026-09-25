/**
 * Couverture des routes IA unifiées : /api/ai/v2, /api/ai/v2/governance, /api/ai/local.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "../../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/ai/ai-service", () => {
  class AIServiceError extends Error {
    status: number;
    code: string;
    constructor(message: string, status = 400, code = "AI_SERVICE_ERROR") {
      super(message);
      this.name = "AIServiceError";
      this.status = status;
      this.code = code;
    }
  }
  return { AIServiceError, aiService: { processChat: vi.fn(), executeGovernance: vi.fn(), getStatus: vi.fn() } };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import { AIServiceError, aiService } from "@/lib/ai/ai-service";
import { checkRateLimit } from "@/lib/rate-limit";
import * as v2 from "@/app/api/ai/v2/route";
import * as gov from "@/app/api/ai/v2/governance/route";
import * as local from "@/app/api/ai/local/route";

const status = {
  operational: true,
  modelLoaded: false,
  loadTime: 12,
  externalConfigured: true,
  n8nConfigured: false,
  runtimeMode: "external",
};

const asRole = (role: string, id = "u-1") =>
  vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA, id }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true, reset: new Date() } as never);
  vi.mocked(aiService.getStatus).mockReturnValue(status as never);
  vi.mocked(aiService.processChat).mockResolvedValue({ response: "Bonjour" } as never);
  vi.mocked(aiService.executeGovernance).mockResolvedValue({ alerts: [{ id: "a1" }] } as never);
  asRole("TEACHER");
});

describe("POST /api/ai/v2", () => {
  const post = (body: unknown) => v2.POST(makeRequest("http://localhost/api/ai/v2", { method: "POST", body }));

  it("exige une session (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await post({ message: "x" })).status).toBe(401);
  });

  it("applique la limite de débit (429)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, reset: new Date(Date.now() + 5000) } as never);
    const res = await post({ message: "x" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("chat par défaut : options par défaut et école active", async () => {
    asRole("PARENT", "u-par");
    const res = await post({ message: "Bonjour" });
    expect(res.status).toBe(200);
    expect(aiService.processChat).toHaveBeenCalledWith({
      message: "Bonjour",
      userId: "u-par",
      userRole: "PARENT",
      schoolId: FIXTURES.schoolA,
      stream: false,
      options: { maxLength: 1024, temperature: 0.7, useKnowledgeBase: true, useContext: true, language: "fr" },
    });
  });

  it("chat : respecte les options fournies", async () => {
    await post({
      endpoint: "chat",
      message: "Hi",
      stream: true,
      options: { maxLength: 50, temperature: 0.2, useKnowledgeBase: false, useContext: false, language: "en" },
    });
    expect(vi.mocked(aiService.processChat).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        stream: true,
        options: { maxLength: 50, temperature: 0.2, useKnowledgeBase: false, useContext: false, language: "en" },
      })
    );
  });

  it("chat : exige un message (400)", async () => {
    const res = await post({ endpoint: "chat" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("MISSING_MESSAGE");
  });

  it("gouvernance : exige une action (400)", async () => {
    const res = await post({ endpoint: "governance" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("MISSING_ACTION");
  });

  it("gouvernance : studentId explicite prioritaire, classId depuis data", async () => {
    await post({ endpoint: "governance", action: "analyze-student", studentId: "stu-1", data: { studentId: "stu-2", classId: "cls-1" } });
    expect(aiService.executeGovernance).toHaveBeenCalledWith(
      expect.objectContaining({ action: "analyze-student", studentId: "stu-1", classId: "cls-1", schoolId: FIXTURES.schoolA })
    );
  });

  it("gouvernance : studentId repris de data s'il est une chaîne", async () => {
    await post({ endpoint: "governance", action: "predict-grades", data: { studentId: "stu-2", classId: 5 } });
    expect(aiService.executeGovernance).toHaveBeenCalledWith(expect.objectContaining({ studentId: "stu-2", classId: undefined }));
  });

  it("gouvernance : sans data, pas d'élève ni de classe", async () => {
    await post({ endpoint: "governance", action: "analyze-school" });
    expect(aiService.executeGovernance).toHaveBeenCalledWith(expect.objectContaining({ studentId: undefined, classId: undefined }));
  });

  it("rejette un point de terminaison inconnu (400)", async () => {
    const res = await post({ endpoint: "hack", message: "x" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_ENDPOINT");
  });

  it.skip("BUG: une AIServiceError du chat doit garder son statut métier (403), pas un 500", async () => {
    // `return handleChat(...)` sans await : la promesse rejetée échappe au try/catch
    // de la route, createApiHandler la transforme en 500 générique.
    vi.mocked(aiService.processChat).mockRejectedValueOnce(new AIServiceError("Accès refusé à cet élève", 403, "FORBIDDEN"));
    const res = await post({ message: "x" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Accès refusé à cet élève", code: "FORBIDDEN" });
  });

  it("une erreur du chat aboutit aujourd'hui à un 500 générique sans fuite", async () => {
    vi.mocked(aiService.processChat).mockRejectedValueOnce(new Error("stack secrète"));
    const res = await post({ message: "x" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secrète");
  });

  it("relaie une AIServiceError levée avant l'aiguillage (catch de la route)", async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new AIServiceError("Service IA indisponible", 503, "UNAVAILABLE"));
    const res = await post({ message: "x" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Service IA indisponible", code: "UNAVAILABLE" });
  });

  it("masque les erreurs inattendues levées dans la route (500)", async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new Error("redis mot de passe"));
    const res = await post({ message: "x" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur interne du serveur", code: "INTERNAL_ERROR" });
  });
});

describe("GET /api/ai/v2", () => {
  const get = (qs = "") => v2.GET(makeRequest(`http://localhost/api/ai/v2${qs}`));

  it("renvoie l'état du moteur par défaut", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      status: {
        operational: true,
        version: "2.0.0",
        model: { loaded: false, loadTime: 12 },
        providers: { externalConfigured: true, n8nConfigured: false, runtimeMode: "external" },
      },
    });
  });

  it("renvoie les alertes de détection de risque de l'école", async () => {
    asRole("DIRECTOR", "u-dir");
    const res = await get("?endpoint=alerts");
    expect(await res.json()).toEqual({ success: true, alerts: [{ id: "a1" }] });
    expect(aiService.executeGovernance).toHaveBeenCalledWith({
      action: "detect-at-risk",
      userId: "u-dir",
      userRole: "DIRECTOR",
      schoolId: FIXTURES.schoolA,
    });
  });

  it("renvoie une liste vide si aucune alerte", async () => {
    vi.mocked(aiService.executeGovernance).mockResolvedValueOnce({} as never);
    expect(await (await get("?endpoint=alerts")).json()).toEqual({ success: true, alerts: [] });
  });

  it("rejette un point de terminaison inconnu (400)", async () => {
    expect((await get("?endpoint=zzz")).status).toBe(400);
  });

  it("relaie une AIServiceError et masque les autres erreurs", async () => {
    vi.mocked(aiService.executeGovernance).mockRejectedValueOnce(new AIServiceError("Rôle non autorisé", 403, "FORBIDDEN"));
    expect((await get("?endpoint=alerts")).status).toBe(403);
    vi.mocked(aiService.getStatus).mockImplementationOnce(() => {
      throw new Error("boom interne");
    });
    const res = await get();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
});

describe("/api/ai/v2/governance", () => {
  const post = (body: unknown) => gov.POST(makeRequest("http://localhost/api/ai/v2/governance", { method: "POST", body }));
  const get = (qs = "") => gov.GET(makeRequest(`http://localhost/api/ai/v2/governance${qs}`));

  it("POST applique la limite de débit (429)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, reset: new Date(Date.now() + 1000) } as never);
    expect((await post({ action: "analyze-class" })).status).toBe(429);
  });

  it("POST rejette une action absente ou hors liste (400)", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ action: "drop-database" })).status).toBe(400);
    expect(aiService.executeGovernance).not.toHaveBeenCalled();
  });

  it("POST exécute l'action avec l'école active et la classe demandée", async () => {
    asRole("TEACHER", "u-t");
    const res = await post({ action: "analyze-class", data: { classId: "cls-1" } });
    expect(res.status).toBe(200);
    expect(aiService.executeGovernance).toHaveBeenCalledWith({
      action: "analyze-class",
      userId: "u-t",
      userRole: "TEACHER",
      schoolId: FIXTURES.schoolA,
      classId: "cls-1",
      data: { classId: "cls-1" },
    });
  });

  it("POST relaie une AIServiceError, masque le reste", async () => {
    vi.mocked(aiService.executeGovernance).mockRejectedValueOnce(new AIServiceError("Classe hors périmètre", 403, "FORBIDDEN"));
    const r1 = await post({ action: "analyze-class" });
    expect(r1.status).toBe(403);
    expect((await r1.json()).code).toBe("FORBIDDEN");
    vi.mocked(aiService.executeGovernance).mockRejectedValueOnce(new Error("interne"));
    const r2 = await post({ action: "analyze-school" });
    expect(r2.status).toBe(500);
    expect(await r2.json()).toEqual({ error: "Erreur interne du serveur" });
  });

  it("GET liste les actions disponibles avec leur description", async () => {
    const body = await (await get("?endpoint=actions")).json();
    expect(body.actions).toHaveLength(5);
    expect(body.actions[0]).toEqual({ id: "analyze-student", description: "Analyser le profil et les performances d'un élève" });
  });

  it("GET renvoie les alertes (vide par défaut)", async () => {
    expect(await (await get("?endpoint=alerts")).json()).toEqual({ success: true, alerts: [{ id: "a1" }] });
    vi.mocked(aiService.executeGovernance).mockResolvedValueOnce({} as never);
    expect(await (await get("?endpoint=alerts")).json()).toEqual({ success: true, alerts: [] });
  });

  it("GET renvoie l'état et les capacités par défaut", async () => {
    const body = await (await get()).json();
    expect(body.status.capabilities).toContain("detect-at-risk");
    expect(body.status.providers.runtimeMode).toBe("external");
  });

  it("GET relaie une AIServiceError, masque le reste", async () => {
    vi.mocked(aiService.executeGovernance).mockRejectedValueOnce(new AIServiceError("Refus", 403, "X"));
    expect((await get("?endpoint=alerts")).status).toBe(403);
    vi.mocked(aiService.getStatus).mockImplementationOnce(() => {
      throw new Error("interne");
    });
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur interne du serveur" });
  });
});

describe("/api/ai/local", () => {
  const post = (endpoint: string | null, body?: unknown) =>
    local.POST(makeRequest(`http://localhost/api/ai/local${endpoint ? `?endpoint=${endpoint}` : ""}`, { method: "POST", body }));

  it("GET renvoie l'état et les fonctionnalités", async () => {
    const body = await (await local.GET(makeRequest("http://localhost/api/ai/local"))).json();
    expect(body.status.features).toContain("chat");
    expect(body.status.modelLoaded).toBe(false);
  });

  it("GET masque une erreur interne (500)", async () => {
    vi.mocked(aiService.getStatus).mockImplementationOnce(() => {
      throw new Error("x");
    });
    expect((await local.GET(makeRequest("http://localhost/api/ai/local"))).status).toBe(500);
  });

  it("chat : valide le message et transmet l'école active", async () => {
    asRole("STUDENT", "u-s");
    const res = await post("chat", { message: "Salut" });
    expect(res.status).toBe(200);
    expect(aiService.processChat).toHaveBeenCalledWith({ message: "Salut", userId: "u-s", userRole: "STUDENT", schoolId: FIXTURES.schoolA });
  });

  it("chat : message vide refusé (400 détaillé)", async () => {
    const res = await post("chat", { message: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Données de requête invalides");
  });

  it("action : exécute une action de gouvernance autorisée", async () => {
    const res = await post("action", { action: "detect-at-risk", data: { a: 1 } });
    expect(res.status).toBe(200);
    expect(aiService.executeGovernance).toHaveBeenCalledWith(expect.objectContaining({ action: "detect-at-risk", data: { a: 1 }, schoolId: FIXTURES.schoolA }));
  });

  it("action : action inconnue refusée (400)", async () => {
    expect((await post("action", { action: "rm-rf" })).status).toBe(400);
  });

  it("analyze : traduit le type de données en action", async () => {
    const res = await post("analyze", { dataType: "class", data: { classId: "c" } });
    expect(await res.json()).toEqual({ success: true, result: { alerts: [{ id: "a1" }] } });
    expect(aiService.executeGovernance).toHaveBeenCalledWith(expect.objectContaining({ action: "analyze-class" }));
  });

  it("model : renvoie l'état de chargement du modèle", async () => {
    expect(await (await post("model", { force: true })).json()).toEqual({ success: true, loaded: false, loadTime: 12 });
  });

  it("history : renvoie un historique vide", async () => {
    expect(await (await post("history", {})).json()).toEqual({ success: true, actions: [] });
  });

  it("par défaut : chat avec message par défaut", async () => {
    await post(null, {});
    expect(vi.mocked(aiService.processChat).mock.calls[0][0].message).toBe("Hello");
    await post(null, { message: "Yo" });
    expect(vi.mocked(aiService.processChat).mock.calls[1][0].message).toBe("Yo");
  });

  it("corps illisible : traité comme vide", async () => {
    const request = makeRequest("http://localhost/api/ai/local", { method: "POST" });
    (request as unknown as { json: () => Promise<unknown> }).json = () => Promise.reject(new SyntaxError("Unexpected"));
    const res = await local.POST(request);
    expect(res.status).toBe(200);
    expect(vi.mocked(aiService.processChat).mock.calls[0][0].message).toBe("Hello");
  });

  it("relaie une AIServiceError et masque les erreurs inattendues", async () => {
    vi.mocked(aiService.processChat).mockRejectedValueOnce(new AIServiceError("Quota", 429, "QUOTA"));
    expect((await post("chat", { message: "a" })).status).toBe(429);
    vi.mocked(aiService.processChat).mockRejectedValueOnce(new Error("secret"));
    const res = await post("chat", { message: "a" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
