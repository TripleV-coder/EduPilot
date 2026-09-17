import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lot 7 — une installation locale sans Redis est un choix légitime, pas un
 * incident. L'avertissement était écrit à CHAQUE requête : constaté dans le
 * journal du serveur de production, trois lignes identiques en 300 ms. Sur une
 * machine d'école, c'est le disque qui finit par se remplir, et surtout le
 * journal qui devient illisible au moment où on en a besoin.
 */
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Redis non configuré", () => {
  it("n'est signalé qu'une fois, quel que soit le nombre de requêtes", async () => {
    const { logger } = await import("@/lib/utils/logger");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const { getRedisClient } = await import("@/lib/cache/redis");

    for (let i = 0; i < 25; i += 1) getRedisClient();

    const lines = warn.mock.calls.filter(([message]) => String(message).includes("Redis non configuré"));
    expect(lines).toHaveLength(1);
  });

  it("renvoie toujours null : le repli mémoire reste le comportement", async () => {
    const { getRedisClient } = await import("@/lib/cache/redis");
    expect(getRedisClient()).toBeNull();
  });
});
