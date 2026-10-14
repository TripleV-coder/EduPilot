import { describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";
import {
    CONSUME_LUA,
    MemoryTokenBuckets,
    TAKE_UP_TO_LUA,
    consumeRedis,
    consumeTokens,
    perMinute,
    takeRedis,
} from "@/lib/resilience/token-bucket";

/**
 * Seaux à jetons : rafale bornée par la capacité, recharge continue, délai
 * exact avant le prochain jeton, et vérification compte + IP sans débit partiel.
 * L'implémentation mémoire est le miroir du script Lua ; le passage par Redis
 * est vérifié sur un faux client (arguments envoyés, lecture de la réponse).
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

describe("passage par Redis (script Lua)", () => {
    function fakeClient(reply: unknown) {
        const commands: Record<string, ReturnType<typeof vi.fn>> = {};
        const client = {
            defineCommand: vi.fn((name: string) => {
                commands[name] = vi.fn().mockResolvedValue(reply);
                (client as Record<string, unknown>)[name] = commands[name];
            }),
        };
        return { client: client as unknown as Redis, commands, defineCommand: client.defineCommand };
    }

    it("envoie clés, coût et (capacité, débit) par seau ; lit refus, restants et attente", async () => {
        const { client, commands } = fakeClient([2, 0, 600]);
        const specs = [perMinute("tb:user:a", 100), perMinute("tb:ip:1.2.3.4", 1000)];

        const result = await consumeRedis(client, specs);

        expect(commands.edupilotConsumeTokens).toHaveBeenCalledWith(
            2,
            "tb:user:a",
            "tb:ip:1.2.3.4",
            1,
            100,
            100 / 60_000,
            1000,
            1000 / 60_000,
        );
        expect(result).toEqual({ allowed: false, remaining: 0, retryAfterMs: 600, deniedIndex: 1 });
    });

    it("réponse « autorisé » : deniedIndex -1", async () => {
        const { client } = fakeClient([0, 41, 0]);
        expect(await consumeRedis(client, [perMinute("tb:ip:x", 100)])).toEqual({
            allowed: true,
            remaining: 41,
            retryAfterMs: 0,
            deniedIndex: -1,
        });
    });

    it("déclare les scripts une seule fois par client (ensuite EVALSHA)", async () => {
        const { client, defineCommand } = fakeClient([0, 1, 0]);
        await consumeRedis(client, [perMinute("tb:ip:x", 10)]);
        await consumeRedis(client, [perMinute("tb:ip:x", 10)]);
        expect(defineCommand).toHaveBeenCalledTimes(2); // consume + take, une fois
        expect(defineCommand).toHaveBeenCalledWith("edupilotConsumeTokens", { lua: CONSUME_LUA });
        expect(defineCommand).toHaveBeenCalledWith("edupilotTakeTokens", { numberOfKeys: 1, lua: TAKE_UP_TO_LUA });
    });

    it("takeRedis lit le nombre accordé et l'attente", async () => {
        const { client, commands } = fakeClient([5, 0]);
        expect(await takeRedis(client, perMinute("jobs:worker", 600), 20)).toEqual({ granted: 5, retryAfterMs: 0 });
        expect(commands.edupilotTakeTokens).toHaveBeenCalledWith("jobs:worker", 600, 600 / 60_000, 20);
    });

    it("le script prend l'horloge du serveur Redis, commune à tous les pods", () => {
        expect(CONSUME_LUA).toContain("redis.call('TIME')");
        expect(TAKE_UP_TO_LUA).toContain("redis.call('TIME')");
        expect(CONSUME_LUA).toContain("PEXPIRE");
    });
});

describe("consumeTokens sans REDIS_URL", () => {
    it("retombe sur la mémoire du processus", async () => {
        const key = `tb:test:${Math.random()}`;
        expect((await consumeTokens([perMinute(key, 1)])).allowed).toBe(true);
        expect((await consumeTokens([perMinute(key, 1)])).allowed).toBe(false);
    });
});
