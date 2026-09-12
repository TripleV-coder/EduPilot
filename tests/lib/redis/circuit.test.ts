import { describe, expect, it, vi } from "vitest";
import { RedisCircuit } from "@/lib/redis/circuit";

/**
 * H6 — Upstash injoignable coûtait ~4,3 s à CHAQUE requête (5 tentatives avec
 * attente exponentielle). Le coupe-circuit borne l'attente à un délai court,
 * bascule sur le repli mémoire et ne réessaie Redis qu'après une période.
 */
const never = () => new Promise<never>(() => {});
const failing = () => Promise.reject(new Error("fetch failed"));

describe("RedisCircuit", () => {
    it("renvoie le repli si Redis ne répond pas dans le délai", async () => {
        const circuit = new RedisCircuit({ timeoutMs: 50, openMs: 30_000 });

        const started = Date.now();
        const result = await circuit.run(never, () => "repli");

        expect(result).toBe("repli");
        expect(Date.now() - started).toBeLessThan(150);
    });

    it("après un échec, n'attend plus Redis pendant la période d'ouverture", async () => {
        const circuit = new RedisCircuit({ timeoutMs: 50, openMs: 30_000 });
        await circuit.run(failing, () => "repli");

        const op = vi.fn(async () => "redis");
        const result = await circuit.run(op, () => "repli");

        expect(result).toBe("repli");
        expect(op).not.toHaveBeenCalled();
        expect(circuit.isOpen()).toBe(true);
    });

    it("signale la dégradation une seule fois pour une série d'échecs", async () => {
        let now = 0;
        const onDegraded = vi.fn();
        const circuit = new RedisCircuit({ timeoutMs: 50, openMs: 1_000, now: () => now, onDegraded });

        for (let i = 0; i < 5; i++) {
            await circuit.run(failing, () => null);
            now += 2_000; // période écoulée : nouvel essai, nouvel échec
        }

        expect(onDegraded).toHaveBeenCalledTimes(1);
    });

    it("referme le circuit et signale le rétablissement quand Redis répond à nouveau", async () => {
        let now = 0;
        const onRecovered = vi.fn();
        const circuit = new RedisCircuit({ timeoutMs: 50, openMs: 1_000, now: () => now, onRecovered });
        await circuit.run(failing, () => null);

        now += 1_001;
        const result = await circuit.run(async () => "redis", () => "repli");

        expect(result).toBe("redis");
        expect(circuit.isOpen()).toBe(false);
        expect(onRecovered).toHaveBeenCalledTimes(1);
    });

    it("sans incident, exécute l'opération Redis et ne signale rien", async () => {
        const onDegraded = vi.fn();
        const circuit = new RedisCircuit({ timeoutMs: 50, openMs: 1_000, onDegraded });

        expect(await circuit.run(async () => 42, () => 0)).toBe(42);
        expect(onDegraded).not.toHaveBeenCalled();
    });
});
