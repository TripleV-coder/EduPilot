import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H6 — panne Redis réelle (aucun mock réseau) : Upstash pointé vers un port
 * fermé. Avant correctif, chaque appel attendait ~4,3 s (tentatives + attente
 * exponentielle) ; critère : latence < 300 ms et l'application continue.
 */
const UNREACHABLE = "http://127.0.0.1:1";

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
    const started = performance.now();
    const value = await fn();
    return { ms: performance.now() - started, value };
}

describe("Redis injoignable", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv("UPSTASH_REDIS_REST_URL", UNREACHABLE);
        vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "jeton-de-test");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("le rate-limit du middleware répond en moins de 300 ms et laisse passer", async () => {
        const { checkRateLimit, apiLimiter } = await import("@/lib/rate-limit");

        for (let i = 0; i < 10; i++) {
            const { ms, value } = await timed(() => checkRateLimit(apiLimiter, "198.51.100.1"));
            expect(ms).toBeLessThan(300);
            expect(value.success).toBe(true);
        }
    });

    it("le rate-limit des routes d'authentification répond en moins de 300 ms", async () => {
        const { checkRateLimit } = await import("@/lib/auth/rate-limiter");

        for (let i = 0; i < 10; i++) {
            const { ms, value } = await timed(() =>
                checkRateLimit(`rl:outage:${i}`, { maxAttempts: 5, windowMs: 60_000 }),
            );
            expect(ms).toBeLessThan(300);
            expect(value.allowed).toBe(true);
        }
    });

    it("le miroir de maintenance répond en moins de 300 ms (état inconnu → on laisse passer)", async () => {
        const { readEdgeMaintenanceState } = await import("@/lib/system/maintenance-edge");

        for (let i = 0; i < 5; i++) {
            const { ms, value } = await timed(() => readEdgeMaintenanceState());
            expect(ms).toBeLessThan(300);
            expect(value).toBeNull();
        }
    });
});
