import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkRateLimitKey, releaseRateLimit, reserveLoginAttempt, resetRateLimit } from "@/lib/rate-limit";
import { CircuitBreaker, PgBreakerKV } from "@/lib/resilience/circuit-breaker";
import { CircuitOpenError } from "@/lib/resilience/errors";
import { SharedTokenBuckets, perMinute } from "@/lib/resilience/token-bucket";
import { setSharedStoreEnabled, storeCircuit, syncTokenBucket } from "@/lib/shared-state/pg";

/**
 * État partagé dans PostgreSQL (Redis retiré le 2026-11-07), sur une vraie
 * base, avec le rôle applicatif : limites de connexion exactes, seaux du
 * proxy communs à plusieurs processus, coupe-circuit vu par tous.
 */
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

beforeAll(() => setSharedStoreEnabled(true));
afterAll(() => setSharedStoreEnabled(null));

describe("limites de débit partagées (PostgreSQL)", () => {
    it("fenêtre fixe exacte sous rafale parallèle : jamais plus que la limite", async () => {
        const key = `rl:it:burst:${unique()}`;
        const results = await Promise.all(
            Array.from({ length: 40 }, () => checkRateLimitKey(key, { maxAttempts: 10, windowMs: 60_000 })),
        );
        expect(results.filter((r) => r.success)).toHaveLength(10);
        expect(storeCircuit.isOpen()).toBe(false);
    });

    it("une clé bloquée est refusée ensuite, jusqu'à la fin de sa fenêtre", async () => {
        const key = `rl:it:block:${unique()}`;
        const config = { maxAttempts: 2, windowMs: 60_000 };
        await checkRateLimitKey(key, config);
        await checkRateLimitKey(key, config);
        const denied = await checkRateLimitKey(key, config);
        expect(denied.success).toBe(false);
        expect(denied.reset.getTime()).toBeGreaterThan(Date.now() + 50_000);
        expect((await checkRateLimitKey(key, config)).success).toBe(false);
    });

    it("connexion : seuls les échecs comptent (release) et la remise à zéro débloque", async () => {
        const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
        const account = `${unique()}@integration.test`;

        // 30 connexions RÉUSSIES (unité rendue) : jamais bloqué
        for (let i = 0; i < 30; i++) {
            const attempt = await reserveLoginAttempt("it-login", ip, account);
            expect(attempt.allowed).toBe(true);
            if (attempt.allowed) await attempt.release();
        }
        // 10 échecs (non rendus) : le 11e est refusé
        for (let i = 0; i < 10; i++) expect((await reserveLoginAttempt("it-login", ip, account)).allowed).toBe(true);
        expect((await reserveLoginAttempt("it-login", ip, account)).allowed).toBe(false);

        await resetRateLimit(`rl:it-login:account:${ip}:${account}`);
        expect((await reserveLoginAttempt("it-login", ip, account)).allowed).toBe(true);
    });

    it("release sur une clé absente : sans effet ni erreur", async () => {
        await expect(releaseRateLimit(`rl:it:absent:${unique()}`)).resolves.toBeUndefined();
    });
});

describe("seaux à jetons du proxy, communs à plusieurs processus", () => {
    it("4 processus, quota 200 : plafond global tenu, écart borné à un lot (10) par processus", async () => {
        const spec = perMinute(`tb:it:user:${unique()}`, 200);
        const debit = (s: typeof spec, pending: number) => syncTokenBucket(s.key, s.capacity, s.refillPerMs, pending);
        const processes = [0, 1, 2, 3].map(() => new SharedTokenBuckets(debit));

        let granted = 0;
        await Promise.all(
            processes.map(async (process) => {
                for (let i = 0; i < 150; i++) if ((await process.consume([spec])).allowed) granted += 1;
            }),
        );
        expect(granted).toBeGreaterThanOrEqual(200);
        // + quelques jetons de remplissage pendant le test (200/min ≈ 3/s)
        expect(granted).toBeLessThanOrEqual(200 + processes.length * 10 + 5);
    });
});

describe("coupe-circuit des fournisseurs, partagé", () => {
    it("ouvert par une instance, il l'est pour les autres", async () => {
        const name = `it-provider-${unique()}`;
        const settings = () => ({ failureThreshold: 3, openMs: 30_000 });
        const instanceA = new CircuitBreaker(name, { kv: new PgBreakerKV(), settings });
        const instanceB = new CircuitBreaker(name, { kv: new PgBreakerKV(), settings });

        for (let i = 0; i < 3; i++) {
            await expect(instanceA.execute(() => Promise.reject(new Error("fournisseur en panne")))).rejects.toThrow("fournisseur en panne");
        }
        expect(await instanceB.state()).toBe("open");
        await expect(instanceB.execute(() => Promise.resolve("ok"))).rejects.toBeInstanceOf(CircuitOpenError);
    });
});
