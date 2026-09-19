import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REQUEST_ID_HEADER,
  getRequestId,
  requestIdFromHeaders,
  runWithRequestId,
} from "@/lib/system/request-context";

/**
 * Lot 7 — sans identifiant de requête, deux erreurs signalées par deux
 * utilisateurs à la même minute sont indiscernables dans le journal. Chaque
 * requête en porte un, repris de l'appelant quand il en fournit un sain.
 */
describe("identifiant de requête", () => {
  it("n'existe pas hors d'une requête", () => {
    expect(getRequestId()).toBeUndefined();
  });

  it("est lisible partout dans la portée de la requête", async () => {
    const seen = await runWithRequestId("req-abcdef12", async () => {
      await Promise.resolve();
      return getRequestId();
    });
    expect(seen).toBe("req-abcdef12");
  });

  it("ne fuit pas d'une requête à l'autre", async () => {
    await runWithRequestId("req-premier1", async () => undefined);
    expect(getRequestId()).toBeUndefined();
  });

  it("en génère un quand l'appelant n'en fournit pas", () => {
    const id = requestIdFromHeaders(new Headers());
    expect(id).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    expect(requestIdFromHeaders(new Headers())).not.toBe(id);
  });

  it("reprend celui de l'appelant pour relier les journaux du client et du serveur", () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: "front-9f2c1a7b" });
    expect(requestIdFromHeaders(headers)).toBe("front-9f2c1a7b");
  });

  it("refuse un identifiant forgé plutôt que de l'écrire dans le journal", () => {
    // Les sauts de ligne sont déjà refusés par Headers ; restent les guillemets
    // et les espaces, qui suffiraient à fabriquer une fausse ligne JSON.
    const injection = new Headers({ [REQUEST_ID_HEADER]: 'x", "level": "error", "message": "faux' });
    const id = requestIdFromHeaders(injection);
    expect(id).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    expect(id).not.toContain("faux");
  });

  it("refuse un identifiant trop long ou trop court", () => {
    expect(requestIdFromHeaders(new Headers({ [REQUEST_ID_HEADER]: "court" }))).not.toBe("court");
    const long = "a".repeat(200);
    expect(requestIdFromHeaders(new Headers({ [REQUEST_ID_HEADER]: long }))).not.toBe(long);
  });

  it("tolère l'absence d'en-têtes (tâche de fond, cron)", () => {
    expect(requestIdFromHeaders(undefined)).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
  });
});

describe("journaux JSON", () => {
  beforeEach(() => {
    // Le format JSON n'est produit qu'en production.
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("portent l'identifiant de la requête en cours", async () => {
    const { logger } = await import("@/lib/utils/logger");
    const written: string[] = [];
    vi.spyOn(console, "info").mockImplementation((line: unknown) => { written.push(String(line)); });

    await runWithRequestId("req-traceable", async () => {
      logger.info("import terminé");
    });

    expect(written).toHaveLength(1);
    const entry = JSON.parse(written[0]) as { requestId?: string; message: string };
    expect(entry.requestId).toBe("req-traceable");
    expect(entry.message).toBe("import terminé");
  });

  it("restent valides hors requête (cron, démarrage)", async () => {
    const { logger } = await import("@/lib/utils/logger");
    const written: string[] = [];
    vi.spyOn(console, "info").mockImplementation((line: unknown) => { written.push(String(line)); });

    logger.info("démarrage");

    const entry = JSON.parse(written[0]) as { requestId?: string };
    expect(entry.requestId).toBeUndefined();
  });
});
