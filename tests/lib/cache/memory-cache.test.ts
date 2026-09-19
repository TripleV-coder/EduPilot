import { describe, expect, it } from "vitest";
import { MemoryCache } from "@/lib/cache/redis";

/**
 * N28 — le cache mémoire (cache de production : instance unique sans Upstash,
 * décision du propriétaire) était une Map sans borne dont les entrées expirées
 * n'étaient retirées qu'à la relecture de la même clé. Les clés portent l'URL,
 * ses paramètres (curseur, recherche) et l'utilisateur : la mémoire du serveur
 * croissait jusqu'au redémarrage.
 */
describe("MemoryCache borné (N28)", () => {
  it("évince les entrées les plus anciennes au-delà du nombre maximal", async () => {
    const cache = new MemoryCache({ maxEntries: 3, maxBytes: 1_000_000 });
    for (const key of ["a", "b", "c", "d"]) await cache.set(key, { key }, 60);

    expect(cache.size).toBe(3);
    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("d")).toEqual({ key: "d" });
  });

  it("évince au-delà du volume maximal estimé (octets)", async () => {
    const cache = new MemoryCache({ maxEntries: 100, maxBytes: 2_500 });
    const big = "x".repeat(1_000);
    for (const key of ["a", "b", "c"]) await cache.set(key, { big }, 60);

    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("c")).toEqual({ big });
    expect(cache.bytes).toBeLessThanOrEqual(2_500);
  });

  it("ne garde pas une valeur plus grosse que le volume maximal", async () => {
    const cache = new MemoryCache({ maxEntries: 100, maxBytes: 100 });
    await cache.set("huge", { data: "y".repeat(500) }, 60);

    expect(await cache.get("huge")).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("purge les entrées expirées jamais relues lors des écritures suivantes", async () => {
    let now = 1_000_000;
    const cache = new MemoryCache({ maxEntries: 100, maxBytes: 1_000_000, now: () => now, sweepIntervalMs: 60_000 });
    for (const key of ["old1", "old2", "old3"]) await cache.set(key, { key }, 10);
    expect(cache.size).toBe(3);

    now += 120_000; // expirées depuis longtemps, et intervalle de purge écoulé
    await cache.set("fresh", { key: "fresh" }, 60);

    expect(cache.size).toBe(1);
    expect(await cache.get("fresh")).toEqual({ key: "fresh" });
  });

  it("réécrire une clé remplace sa taille au lieu de l'additionner", async () => {
    const cache = new MemoryCache({ maxEntries: 10, maxBytes: 1_000_000 });
    await cache.set("k", { v: "x".repeat(100) }, 60);
    const once = cache.bytes;
    await cache.set("k", { v: "x".repeat(100) }, 60);

    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(once);
  });

  it("clear(pattern) et delete tiennent la comptabilité à jour", async () => {
    const cache = new MemoryCache({ maxEntries: 10, maxBytes: 1_000_000 });
    await cache.set("api:a", 1, 60);
    await cache.set("api:b", 2, 60);
    await cache.set("other", 3, 60);
    await cache.clear("api:*");
    await cache.delete("other");

    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });
});
