import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getRequestId, REQUEST_ID_HEADER } from "@/lib/system/request-context";
import { logger } from "@/lib/utils/logger";
import { auth } from "@/lib/auth";
import { makeRequest } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

/**
 * Lot 7 — chaque requête porte un identifiant, renvoyé au client et présent
 * dans chaque ligne de journal : c'est ce qui permet à l'exploitant de relier
 * l'erreur affichée à une personne et les lignes écrites par le serveur.
 */
beforeEach(() => {
  vi.mocked(auth).mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("identifiant de requête sur les routes", () => {
  it("renvoie un identifiant dans la réponse", async () => {
    const handler = createApiHandler(async () => NextResponse.json({ ok: true }), { requireAuth: false });

    const res = await handler(makeRequest("http://localhost/api/test"));

    expect(res.headers.get(REQUEST_ID_HEADER)).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
  });

  it("reprend l'identifiant fourni par le client", async () => {
    const handler = createApiHandler(async () => NextResponse.json({ ok: true }), { requireAuth: false });

    const res = await handler(
      makeRequest("http://localhost/api/test", { headers: { [REQUEST_ID_HEADER]: "front-123456" } }),
    );

    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("front-123456");
  });

  it("le met à disposition du handler", async () => {
    let seen: string | undefined;
    const handler = createApiHandler(
      async () => {
        seen = getRequestId();
        return NextResponse.json({ ok: true });
      },
      { requireAuth: false },
    );

    const res = await handler(
      makeRequest("http://localhost/api/test", { headers: { [REQUEST_ID_HEADER]: "front-abcdef" } }),
    );

    expect(seen).toBe("front-abcdef");
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("front-abcdef");
  });

  it("l'identifiant est aussi présent sur une réponse d'erreur", async () => {
    const handler = createApiHandler(async () => { throw new Error("boum"); }, { requireAuth: false });

    const res = await handler(
      makeRequest("http://localhost/api/test", { headers: { [REQUEST_ID_HEADER]: "front-erreur1" } }),
    );

    expect(res.status).toBe(500);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("front-erreur1");
  });

  it("l'erreur interne est journalisée avec l'identifiant, et sans l'URL brute", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const written: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      written.push(args.map(String).join(" "));
    });
    const handler = createApiHandler(
      async () => { throw new Error("échec de la requête SQL"); },
      { requireAuth: false },
    );

    await handler(
      makeRequest("http://localhost/api/test?email=parent%40exemple.fr", {
        headers: { [REQUEST_ID_HEADER]: "front-journal1" },
      }),
    );

    const lines = written.filter((l) => l.includes("front-journal1"));
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]) as { requestId: string; context?: { path?: string } };
    expect(entry.requestId).toBe("front-journal1");
    // Le chemin est journalisé, jamais la chaîne de requête (audit Lot 6).
    expect(lines[0]).not.toContain("parent@exemple.fr");
    expect(entry.context?.path).toBe("/api/test");
  });

  it("n'écrit pas l'identifiant hors requête", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const written: string[] = [];
    vi.spyOn(console, "info").mockImplementation((line: unknown) => { written.push(String(line)); });

    logger.info("tâche de fond");

    expect(JSON.parse(written[0]).requestId).toBeUndefined();
  });
});
