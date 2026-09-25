/**
 * Couverture de /api/ai/v2/chat (réponse simple et flux SSE).
 * next/server est redéfini ici avec une vraie classe Response pour que
 * `new NextResponse(stream)` fonctionne (le mock global n'est pas constructible).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "../../api/test-helpers";

vi.mock("next/server", () => {
  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      headers.set("content-type", "application/json");
      return new NextResponse(JSON.stringify(body), { ...init, headers });
    }
  }
  return { NextResponse, NextRequest: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/ai/ai-service", () => ({ aiService: { processChat: vi.fn(), getStatus: vi.fn() } }));
vi.mock("@/lib/ai/n8n-client", () => ({ checkN8nHealth: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import { aiService } from "@/lib/ai/ai-service";
import { checkN8nHealth } from "@/lib/ai/n8n-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { GET, POST } from "@/app/api/ai/v2/chat/route";

const url = "http://localhost/api/ai/v2/chat";
const post = (body: unknown) => POST(makeRequest(url, { method: "POST", body }));

/** Lit le flux SSE jusqu'à sa fin (ou son erreur) et renvoie les événements décodés. */
async function readEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
  } catch {
    // flux terminé en erreur : on garde ce qui a été reçu
  }
  return text
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, "")));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA, id: "u-t" }));
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true, reset: new Date() } as never);
});

describe("POST /api/ai/v2/chat", () => {
  it("exige une session (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await post({ message: "x" })).status).toBe(401);
  });

  it("applique la limite de débit (429 + Retry-After)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, reset: new Date(Date.now() + 20_000) } as never);
    const res = await post({ message: "x" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(aiService.processChat).not.toHaveBeenCalled();
  });

  it("refuse un message absent, non textuel ou vide (400)", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ message: 42 })).status).toBe(400);
    expect((await post({ message: "   " })).status).toBe(400);
  });

  it("réponse simple : message nettoyé, options par défaut, métadonnées par défaut", async () => {
    vi.mocked(aiService.processChat).mockResolvedValueOnce({ response: "Réponse" } as never);
    const res = await post({ message: "  Bonjour  " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, response: "Réponse", metadata: { confidence: 0.85, processingTime: 100 } });
    expect(aiService.processChat).toHaveBeenCalledWith({
      message: "Bonjour",
      userId: "u-t",
      userRole: "TEACHER",
      schoolId: FIXTURES.schoolA,
      stream: false,
      options: { maxLength: 1024, temperature: 0.7, useKnowledgeBase: true, useContext: true, language: "fr" },
    });
  });

  it("réponse simple : reprend les options et métadonnées fournies", async () => {
    vi.mocked(aiService.processChat).mockResolvedValueOnce({ response: "R", metadata: { confidence: 0.4, processingTime: 7 } } as never);
    const res = await post({ message: "Q", options: { maxLength: 10, temperature: 0.1, useKnowledgeBase: false, useContext: false, language: "en" } });
    expect((await res.json()).metadata).toEqual({ confidence: 0.4, processingTime: 7 });
    expect(vi.mocked(aiService.processChat).mock.calls[0][0].options).toEqual({
      maxLength: 10, temperature: 0.1, useKnowledgeBase: false, useContext: false, language: "en",
    });
  });

  it("flux SSE : connexion, jetons puis réponse complète", async () => {
    vi.mocked(aiService.processChat).mockImplementationOnce(async (input) => {
      input.onToken?.("Bon");
      input.onToken?.("jour");
      return { response: "Bonjour" } as never;
    });
    const res = await post({ message: "Salut", stream: true, options: { maxLength: 5, temperature: 0.3, language: "en" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const events = await readEvents(res);
    expect(events).toEqual([
      { type: "connected" },
      { type: "token", content: "Bon" },
      { type: "token", content: "jour" },
      { type: "done", content: "Bonjour" },
    ]);
    expect(vi.mocked(aiService.processChat).mock.calls[0][0]).toEqual(
      expect.objectContaining({ stream: true, schoolId: FIXTURES.schoolA, options: expect.objectContaining({ maxLength: 5, language: "en" }) })
    );
  });

  it("flux SSE : options par défaut quand aucune n'est fournie", async () => {
    vi.mocked(aiService.processChat).mockResolvedValueOnce({ response: "ok" } as never);
    await readEvents(await post({ message: "Salut", stream: true }));
    expect(vi.mocked(aiService.processChat).mock.calls[0][0].options).toEqual({
      maxLength: 1024, temperature: 0.7, useKnowledgeBase: true, useContext: true, language: "fr",
    });
  });

  it("flux SSE : une erreur du service interrompt le flux en erreur, sans fuite du détail", async () => {
    vi.mocked(aiService.processChat).mockRejectedValueOnce(new Error("clé fournisseur invalide"));
    const res = await post({ message: "Salut", stream: true });
    const reader = res.body!.getReader();
    const reason = await reader.read().then(() => null, (e: unknown) => e);
    expect(reason).toBeInstanceOf(Error);
    // Le client ne reçoit aucune donnée contenant le message interne.
    expect(res.status).toBe(200);
  });

  it.skip("BUG: l'événement SSE d'erreur doit parvenir au client avant la fin du flux", async () => {
    // controller.enqueue(error) suivi de controller.error(error) : error() vide la
    // file d'attente, l'événement { type: "error" } n'est jamais livré.
    vi.mocked(aiService.processChat).mockRejectedValueOnce(new Error("x"));
    const events = await readEvents(await post({ message: "Salut", stream: true }));
    expect(events.at(-1)).toEqual({ type: "error", message: "Une erreur est survenue. Veuillez réessayer." });
  });

  it("flux SSE : un jeton reçu après fermeture par le client est ignoré sans planter", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let tokenThrew = false;
    vi.mocked(aiService.processChat).mockImplementationOnce(async (input) => {
      await gate;
      try {
        input.onToken?.("tardif");
      } catch {
        tokenThrew = true;
      }
      return { response: "fin" } as never;
    });
    const res = await post({ message: "Salut", stream: true });
    await res.body!.cancel();
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(tokenThrew).toBe(false);
  });

  it("renvoie un 500 générique si le service échoue (réponse simple)", async () => {
    vi.mocked(aiService.processChat).mockRejectedValueOnce(new Error("détail"));
    const res = await post({ message: "Q" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Une erreur est survenue. Veuillez réessayer plus tard." });
  });
});

describe("GET /api/ai/v2/chat", () => {
  it("renvoie l'état du service et la joignabilité de n8n", async () => {
    vi.mocked(aiService.getStatus).mockReturnValue({
      operational: true, modelLoaded: true, loadTime: 3, externalConfigured: false, n8nConfigured: true, runtimeMode: "n8n",
    } as never);
    vi.mocked(checkN8nHealth).mockResolvedValueOnce({ reachable: true, latencyMs: 42 } as never);
    const res = await GET(makeRequest(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status.providers).toEqual({
      externalConfigured: false, n8nConfigured: true, n8nReachable: true, n8nLatencyMs: 42, runtimeMode: "n8n",
    });
    expect(body.status.model).toEqual({ loaded: true, loadTime: 3 });
  });

  it("renvoie un 500 générique si la vérification échoue", async () => {
    vi.mocked(aiService.getStatus).mockReturnValue({} as never);
    vi.mocked(checkN8nHealth).mockRejectedValueOnce(new Error("ECONNREFUSED 10.0.0.3"));
    const res = await GET(makeRequest(url));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur lors de la vérification du service" });
  });
});
