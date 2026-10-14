import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cache partagé entre processus via REDIS_URL (capacité 2026-10-01) : avec
 * plusieurs processus, un cache mémoire par processus recalculait N fois.
 */
const fake = vi.hoisted(() => ({
    ready: true,
    failing: false,
    store: new Map<string, string>(),
}));

vi.mock("@/lib/redis/tcp", () => {
    const client = {
        options: { keyPrefix: "edupilot:" },
        get: vi.fn(async (key: string) => {
            if (fake.failing) throw new Error("timeout");
            return fake.store.get(`edupilot:${key}`) ?? null;
        }),
        set: vi.fn(async (key: string, value: string) => {
            if (fake.failing) throw new Error("timeout");
            fake.store.set(`edupilot:${key}`, value);
            return "OK";
        }),
        del: vi.fn(async (...keys: string[]) => {
            for (const key of keys) fake.store.delete(`edupilot:${key}`);
            return keys.length;
        }),
        scan: vi.fn(async (_cursor: string, _m: string, match: string) => {
            const prefix = match.replace(/\*$/, "");
            return ["0", [...fake.store.keys()].filter((key) => key.startsWith(prefix))];
        }),
    };
    return {
        getTcpRedis: () => (fake.ready ? client : null),
        tcpRedisCircuit: {
            run: async <T>(op: () => Promise<T>, fallback: () => T | Promise<T>) => {
                try {
                    return await op();
                } catch {
                    return fallback();
                }
            },
        },
    };
});

async function freshCache() {
    vi.resetModules();
    vi.stubEnv("REDIS_URL", "redis://cache.test:6379");
    const { getCacheService } = await import("@/lib/cache/redis");
    return getCacheService();
}

beforeEach(() => {
    fake.ready = true;
    fake.failing = false;
    fake.store.clear();
});

describe("cache Redis TCP (REDIS_URL)", () => {
    it("une valeur écrite par un processus est lue par un autre", async () => {
        const writer = await freshCache();
        await writer.set("api:/api/classes::u1", { body: [{ id: "c1" }], headers: {} }, 60);

        const reader = await freshCache();
        expect(await reader.get("api:/api/classes::u1")).toEqual({ body: [{ id: "c1" }], headers: {} });
        expect(fake.store.has("edupilot:cache:api:/api/classes::u1")).toBe(true);
    });

    it("Redis pas prêt ou en panne : cache mémoire du processus, sans erreur", async () => {
        const cache = await freshCache();
        fake.ready = false;
        await cache.set("k", { v: 1 }, 60);
        expect(await cache.get("k")).toEqual({ v: 1 });
        expect(fake.store.size).toBe(0);

        fake.ready = true;
        fake.failing = true;
        await cache.set("k2", { v: 2 }, 60);
        expect(await cache.get("k2")).toEqual({ v: 2 });
    });

    it("l'invalidation par motif efface les clés partagées (SCAN, préfixe retiré pour DEL)", async () => {
        const cache = await freshCache();
        await cache.set("api:/api/grades:a", 1, 60);
        await cache.set("api:/api/grades:b", 2, 60);
        await cache.set("api:/api/classes:a", 3, 60);

        await cache.clear("api:/api/grades*");

        expect(await cache.get("api:/api/grades:a")).toBeNull();
        expect(await cache.get("api:/api/grades:b")).toBeNull();
        expect(await cache.get("api:/api/classes:a")).toBe(3);
    });
});
