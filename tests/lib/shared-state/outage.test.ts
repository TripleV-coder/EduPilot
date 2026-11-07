import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H6 (repris pour PostgreSQL, 2026-11-07) — magasin partagé qui ne répond
 * plus : une requête attend au plus UNE fois le délai du coupe-circuit
 * (1 s), puis les limites passent en mémoire locale sans attendre, pendant
 * la période d'ouverture. L'application n'est jamais bloquée ni sans limite.
 */
const hang = () => new Promise<never>(() => {});

vi.mock("@/lib/prisma", () => ({
    prismaBase: { $queryRaw: vi.fn(hang), $executeRaw: vi.fn(hang) },
    default: {},
}));

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
    const started = performance.now();
    const value = await fn();
    return { ms: performance.now() - started, value };
}

describe("magasin partagé injoignable", () => {
    beforeEach(async () => {
        vi.resetModules();
        const { setSharedStoreEnabled } = await import("@/lib/shared-state/pg");
        setSharedStoreEnabled(true);
    });

    afterEach(async () => {
        const { setSharedStoreEnabled } = await import("@/lib/shared-state/pg");
        setSharedStoreEnabled(null);
    });

    it("rate-limit : un seul délai borné, puis réponses immédiates en mémoire", async () => {
        const { checkRateLimitKey } = await import("@/lib/rate-limit");
        const first = await timed(() => checkRateLimitKey("rl:outage:a", { maxAttempts: 5, windowMs: 60_000 }));
        expect(first.ms).toBeLessThan(1_300);
        expect(first.value.success).toBe(true);

        for (let i = 0; i < 10; i++) {
            const { ms, value } = await timed(() => checkRateLimitKey(`rl:outage:${i}`, { maxAttempts: 5, windowMs: 60_000 }));
            expect(ms).toBeLessThan(50);
            expect(value.success).toBe(true);
        }
    });

    it("les limites restent appliquées pendant la panne (repli mémoire exact)", async () => {
        const { checkRateLimitKey } = await import("@/lib/rate-limit");
        const config = { maxAttempts: 3, windowMs: 60_000 };
        const results = [];
        for (let i = 0; i < 5; i++) results.push((await checkRateLimitKey("rl:outage:brute", config)).success);
        expect(results).toEqual([true, true, true, false, false]);
    });

    it("seaux du proxy : réponses immédiates après le premier délai", async () => {
        const { consumeTokens, perMinute } = await import("@/lib/resilience/token-bucket");
        const first = await timed(() => consumeTokens([perMinute("tb:outage:user", 100)]));
        expect(first.ms).toBeLessThan(1_300);
        expect(first.value.allowed).toBe(true);

        const { ms, value } = await timed(() => consumeTokens([perMinute("tb:outage:user", 100)]));
        expect(ms).toBeLessThan(50);
        expect(value.allowed).toBe(true);
    });
});
