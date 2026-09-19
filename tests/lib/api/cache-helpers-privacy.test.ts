import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const store = new Map<string, unknown>();
vi.mock("@/lib/cache/redis", () => ({
  getCacheService: () => ({
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: unknown) => { store.set(key, value); },
    delete: async (key: string) => { store.delete(key); },
    clear: async () => { store.clear(); },
  }),
}));

import { withCache } from "@/lib/api/cache-helpers";

/**
 * N29 — withCache sert des réponses propres à un utilisateur (clé portant
 * son identifiant : notes, paiements, messages). Avec « Cache-Control: public »,
 * un proxy ou un cache partagé (réseau d'établissement) peut les stocker et les
 * resservir à un autre utilisateur.
 */
describe("withCache — en-têtes de cache (N29)", () => {
  const handler = async () => NextResponse.json({ grades: [12, 15] });

  it("réponse calculée (MISS) : jamais « public », toujours « private »", async () => {
    store.clear();
    const res = await withCache(handler, { key: "api:/api/grades:user:u1", ttl: 60 });
    const cc = res.headers.get("Cache-Control") ?? "";

    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(cc).not.toMatch(/\bpublic\b/);
    expect(cc).toMatch(/\bprivate\b/);
  });

  it("réponse servie du cache (HIT) : jamais « public », toujours « private »", async () => {
    store.clear();
    await withCache(handler, { key: "api:/api/grades:user:u2", ttl: 60 });
    const res = await withCache(handler, { key: "api:/api/grades:user:u2", ttl: 60 });
    const cc = res.headers.get("Cache-Control") ?? "";

    expect(res.headers.get("X-Cache")).toBe("HIT");
    expect(cc).not.toMatch(/\bpublic\b/);
    expect(cc).toMatch(/\bprivate\b/);
  });
});
