import { describe, expect, it, vi } from "vitest";
import { memoizeAsync } from "@/lib/cache/memo";

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("memoizeAsync — calculs de tableau de bord (capacité 2026-10-01, G4)", () => {
    it("20 demandes simultanées ne lancent qu'un calcul", async () => {
        const gate = deferred<number>();
        const compute = vi.fn((_school: string) => gate.promise);
        const memo = memoizeAsync({ ttlMs: 60_000, key: (school) => school, enabled: true }, compute);

        const pending = Array.from({ length: 20 }, () => memo("ecole-a"));
        gate.resolve(42);

        expect(await Promise.all(pending)).toEqual(Array(20).fill(42));
        expect(compute).toHaveBeenCalledTimes(1);
    });

    it("sert la valeur pendant la fenêtre puis recalcule", async () => {
        let clock = 0;
        const compute = vi.fn(async (school: string) => `${school}@${clock}`);
        const memo = memoizeAsync({ ttlMs: 1_000, key: (school) => school, now: () => clock, enabled: true }, compute);

        expect(await memo("a")).toBe("a@0");
        clock = 999;
        expect(await memo("a")).toBe("a@0");
        clock = 1_001;
        expect(await memo("a")).toBe("a@1001");
        expect(compute).toHaveBeenCalledTimes(2);
    });

    it("des clés différentes (autre établissement, autres filtres) ne se mélangent pas", async () => {
        const memo = memoizeAsync(
            { ttlMs: 60_000, key: (school: string, cls?: string) => `${school}|${cls ?? ""}`, enabled: true },
            async (school: string, cls?: string) => `${school}:${cls ?? "toutes"}`,
        );

        expect(await memo("a")).toBe("a:toutes");
        expect(await memo("a", "6e")).toBe("a:6e");
        expect(await memo("b")).toBe("b:toutes");
    });

    it("un échec n'est pas mis en cache et atteint tous les appelants en attente", async () => {
        const gate = deferred<string>();
        const compute = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValueOnce("ok");
        const memo = memoizeAsync({ ttlMs: 60_000, key: () => "k", enabled: true }, compute as () => Promise<string>);

        const first = memo();
        const second = memo();
        gate.reject(new Error("base indisponible"));

        await expect(first).rejects.toThrow("base indisponible");
        await expect(second).rejects.toThrow("base indisponible");
        expect(await memo()).toBe("ok");
        expect(compute).toHaveBeenCalledTimes(2);
    });

    it("reste borné en nombre d'entrées", async () => {
        const compute = vi.fn(async (k: string) => k);
        const memo = memoizeAsync({ ttlMs: 60_000, key: (k) => k, maxEntries: 2, enabled: true }, compute);

        await memo("a");
        await memo("b");
        await memo("c"); // évince « a »
        await memo("a");
        expect(compute).toHaveBeenCalledTimes(4);
    });

    it("désactivée sous Vitest par défaut : chaque appel recalcule", async () => {
        const compute = vi.fn(async () => 1);
        const memo = memoizeAsync({ ttlMs: 60_000, key: () => "k" }, compute);

        await memo();
        await memo();
        expect(compute).toHaveBeenCalledTimes(2);
    });
});
