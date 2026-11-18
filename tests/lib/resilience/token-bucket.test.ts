import { describe, expect, it } from "vitest";
import {
    MemoryTokenBuckets,
    SYNC_INTERVAL_MS,
    SharedTokenBuckets,
    consumeTokens,
    perMinute,
    type BucketSpec,
} from "@/lib/resilience/token-bucket";

/**
 * Seaux à jetons : rafale bornée par la capacité, recharge continue, délai
 * exact avant le prochain jeton, et vérification compte + IP sans débit partiel.
 * Le magasin partagé (`SharedTokenBuckets`) est vérifié contre un modèle
 * exact de la fonction SQL `edupilot_sync_token_buckets` (seau commun à plusieurs
 * processus) : aller-retours économisés, plafond global, écart borné.
 */

function clock(start = 1_000_000) {
    let now = start;
    return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("MemoryTokenBuckets.consume", () => {
    it("laisse passer une rafale égale à la capacité, puis refuse", () => {
        const time = clock();
        const buckets = new MemoryTokenBuckets(time.now);
        const spec = perMinute("tb:user:a", 100);

        for (let i = 0; i < 100; i++) expect(buckets.consume([spec]).allowed).toBe(true);
        const denied = buckets.consume([spec]);
        expect(denied).toMatchObject({ allowed: false, remaining: 0, deniedIndex: 0 });
    });

    it("donne le délai exact avant le prochain jeton (100/min ⇒ 600 ms)", () => {
        const time = clock();
        const buckets = new MemoryTokenBuckets(time.now);
        const spec = perMinute("tb:user:a", 100);
        for (let i = 0; i < 100; i++) buckets.consume([spec]);

        expect(buckets.consume([spec]).retryAfterMs).toBe(600);
        time.advance(300);
        expect(buckets.consume([spec]).retryAfterMs).toBe(300);
    });

    it("se recharge en continu, sans dépasser la capacité", () => {
        const time = clock();
        const buckets = new MemoryTokenBuckets(time.now);
        const spec = perMinute("tb:user:a", 100);
        for (let i = 0; i < 100; i++) buckets.consume([spec]);

        time.advance(600);
        expect(buckets.consume([spec]).allowed).toBe(true);
        expect(buckets.consume([spec]).allowed).toBe(false);

        time.advance(60 * 60_000);
        expect(buckets.consume([spec]).remaining).toBe(99);
    });

    it("compte et IP : si l'un est vide, aucun n'est débité", () => {
        const time = clock();
        const buckets = new MemoryTokenBuckets(time.now);
        const user = perMinute("tb:user:a", 2);
        const ip = perMinute("tb:ip:1.2.3.4", 10);

        buckets.consume([user, ip]);
        buckets.consume([user, ip]);
        const denied = buckets.consume([user, ip]);
        expect(denied).toMatchObject({ allowed: false, deniedIndex: 0 });

        // L'IP n'a perdu que les 2 jetons réellement consommés.
        expect(buckets.consume([ip]).remaining).toBe(7);
    });

    it("signale le seau de l'IP quand c'est lui qui est vide", () => {
        const buckets = new MemoryTokenBuckets(clock().now);
        const ip = perMinute("tb:ip:1.2.3.4", 1);
        buckets.consume([perMinute("tb:user:a", 100), ip]);
        expect(buckets.consume([perMinute("tb:user:b", 100), ip])).toMatchObject({ allowed: false, deniedIndex: 1 });
    });

    it("les seaux de deux comptes sont indépendants", () => {
        const buckets = new MemoryTokenBuckets(clock().now);
        buckets.consume([perMinute("tb:user:a", 1)]);
        expect(buckets.consume([perMinute("tb:user:a", 1)]).allowed).toBe(false);
        expect(buckets.consume([perMinute("tb:user:b", 1)]).allowed).toBe(true);
    });
});

describe("MemoryTokenBuckets.takeUpTo", () => {
    it("accorde autant de jetons que disponibles, puis le délai du suivant", () => {
        const time = clock();
        const buckets = new MemoryTokenBuckets(time.now);
        const spec = perMinute("jobs:worker", 30);

        expect(buckets.takeUpTo(spec, 20)).toEqual({ granted: 20, retryAfterMs: 0 });
        expect(buckets.takeUpTo(spec, 20)).toEqual({ granted: 10, retryAfterMs: 0 });
        expect(buckets.takeUpTo(spec, 20)).toEqual({ granted: 0, retryAfterMs: 2_000 });

        time.advance(4_000);
        expect(buckets.takeUpTo(spec, 20).granted).toBe(2);
    });
});

/** Modèle exact de `edupilot_sync_token_buckets` : un seau commun, compteur d'appels. */
function sharedStore(now: () => number) {
    const buckets = new Map<string, { tokens: number; at: number }>();
    const store = {
        calls: 0,
        debit: async (spec: BucketSpec, pending: number) => {
            store.calls += 1;
            const t = now();
            const state = buckets.get(spec.key) ?? { tokens: spec.capacity, at: t };
            const level = Math.min(spec.capacity, state.tokens + Math.max(0, t - state.at) * spec.refillPerMs) - pending;
            buckets.set(spec.key, { tokens: level, at: t });
            return { level };
        },
        level: (key: string) => buckets.get(key)?.tokens,
    };
    return store;
}

describe("SharedTokenBuckets (magasin PostgreSQL)", () => {
    // 6 000 / min : lot de synchronisation = 5 % = 300 jetons, remplissage négligeable à l'échelle du test
    const big = (key = "tb:user:a") => perMinute(key, 6_000);

    it("accorde localement : bien moins d'un aller-retour par requête (Redis : un par requête)", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);

        for (let i = 0; i < 1_000; i++) {
            expect((await buckets.consume([big()])).allowed).toBe(true);
            time.advance(1);
        }
        // 1 000 requêtes en 1 s : synchronisation tous les 300 jetons accordés
        expect(store.calls).toBeLessThanOrEqual(5);
    });

    it("un seul processus : plafond exact (rafale = capacité, puis refus)", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);
        const spec = perMinute("tb:ip:1.2.3.4", 100);

        const outcomes = [];
        for (let i = 0; i < 150; i++) outcomes.push((await buckets.consume([spec])).allowed);
        expect(outcomes.filter(Boolean)).toHaveLength(100);
        expect(outcomes.slice(0, 100).every(Boolean)).toBe(true);
    });

    it("refus sur un niveau récent : aucun aller-retour (rafale contre un seau vide)", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);
        const spec = perMinute("tb:ip:robot", 20);
        for (let i = 0; i < 20; i++) await buckets.consume([spec]);
        await buckets.consume([spec]); // vide : synchronise et refuse
        const callsWhenEmpty = store.calls;

        for (let i = 0; i < 500; i++) expect((await buckets.consume([spec])).allowed).toBe(false);
        expect(store.calls).toBe(callsWhenEmpty);
    });

    it("donne le délai avant le prochain jeton quand le seau est vide", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);
        const spec = perMinute("tb:user:b", 100);
        for (let i = 0; i < 100; i++) await buckets.consume([spec]);
        const denied = await buckets.consume([spec]);
        expect(denied.allowed).toBe(false);
        expect(denied.retryAfterMs).toBeGreaterThan(0);
        expect(denied.retryAfterMs).toBeLessThanOrEqual(600);
    });

    it("plusieurs processus : plafond global respecté, écart borné à un lot par processus", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const processes = [0, 1, 2, 3].map(() => new SharedTokenBuckets(store.debit, time.now));
        const spec = perMinute("tb:user:multi", 1_000); // lot = 50

        let granted = 0;
        for (let round = 0; round < 1_500; round++) {
            const process = processes[round % processes.length];
            if ((await process.consume([spec])).allowed) granted += 1;
        }
        expect(granted).toBeGreaterThanOrEqual(1_000);
        expect(granted).toBeLessThanOrEqual(1_000 + processes.length * 50);
    });

    it("la consommation accordée localement finit inscrite dans le seau commun", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);
        const spec = perMinute("tb:user:flush", 6_000);
        for (let i = 0; i < 10; i++) await buckets.consume([spec]);
        time.advance(SYNC_INTERVAL_MS);
        await buckets.consume([spec]); // niveau trop ancien : synchronise et inscrit les 10
        expect(store.level("tb:user:flush")).toBeLessThanOrEqual(6_000 - 10 + 1);
    });

    it("compte et IP : si l'un est vide, aucun n'est débité", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);
        const user = perMinute("tb:user:c", 100);
        const ip = perMinute("tb:ip:5.6.7.8", 2);
        await buckets.consume([user, ip]);
        await buckets.consume([user, ip]);
        const denied = await buckets.consume([user, ip]);
        expect(denied).toMatchObject({ allowed: false, deniedIndex: 1 });
        // Le seau du compte n'a perdu que les 2 jetons accordés
        const afterwards = await buckets.consume([user]);
        expect(afterwards.remaining).toBe(100 - 3);
    });

    it("les appels simultanés sur un seau partagent une seule synchronisation", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);
        const spec = big("tb:user:concurrent");
        const results = await Promise.all(Array.from({ length: 50 }, () => buckets.consume([spec])));
        expect(results.every((r) => r.allowed)).toBe(true);
        expect(store.calls).toBe(1);
    });

    it("takeUpTo : accorde le disponible et l'inscrit aussitôt", async () => {
        const time = clock();
        const store = sharedStore(time.now);
        const buckets = new SharedTokenBuckets(store.debit, time.now);
        const spec = perMinute("jobs:worker", 10);
        expect((await buckets.takeUpTo(spec, 25)).granted).toBe(10);
        expect(store.level("jobs:worker")).toBeLessThanOrEqual(0.01);
        const none = await buckets.takeUpTo(spec, 5);
        expect(none.granted).toBe(0);
        expect(none.retryAfterMs).toBeGreaterThan(0);
    });
});

describe("consumeTokens en tests unitaires (magasin partagé inactif)", () => {
    it("retombe sur la mémoire du processus", async () => {
        const key = `tb:test:${Math.random()}`;
        expect((await consumeTokens([perMinute(key, 1)])).allowed).toBe(true);
        expect((await consumeTokens([perMinute(key, 1)])).allowed).toBe(false);
    });
});
