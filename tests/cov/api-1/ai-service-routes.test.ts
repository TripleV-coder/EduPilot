/**
 * Couverture des routes IA de gouvernance : /api/ai/v2 et /api/ai/v2/governance (100 % local).
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
  return { AIServiceError, aiService: { executeGovernance: vi.fn(), getStatus: vi.fn() } };
});
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import { AIServiceError, aiService } from "@/lib/ai/ai-service";
import { checkRateLimit } from "@/lib/rate-limit";
import * as v2 from "@/app/api/ai/v2/route";
import * as gov from "@/app/api/ai/v2/governance/route";

const status = { operational: true, runtimeMode: "local" };

const asRole = (role: string, id = "u-1") =>
  vi.mocked(auth).mockResolvedValue(makeSession(role, { schoolId: FIXTURES.schoolA, id }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true, reset: new Date() } as never);
  vi.mocked(aiService.getStatus).mockReturnValue(status as never);
  vi.mocked(aiService.executeGovernance).mockResolvedValue({ alerts: [{ id: "a1" }] } as never);
  asRole("TEACHER");
});

describe("POST /api/ai/v2", () => {
  const post = (body: unknown) => v2.POST(makeRequest("http://localhost/api/ai/v2", { method: "POST", body }));

  it("exige une session (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await post({ endpoint: "governance", action: "analyze-school" })).status).toBe(401);
  });

  it("applique la limite de débit (429)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, reset: new Date(Date.now() + 5000) } as never);
    const res = await post({ endpoint: "governance", action: "analyze-school" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
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



  it("relaie une AIServiceError levée avant l'aiguillage (catch de la route)", async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new AIServiceError("Service IA indisponible", 503, "UNAVAILABLE"));
    const res = await post({ endpoint: "governance", action: "analyze-school" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Service IA indisponible", code: "UNAVAILABLE" });
  });

  it("masque les erreurs inattendues levées dans la route (500)", async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new Error("redis mot de passe"));
    const res = await post({ endpoint: "governance", action: "analyze-school" });
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
        runtimeMode: "local",
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
    expect(body.status.runtimeMode).toBe("local");
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
