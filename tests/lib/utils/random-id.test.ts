import { describe, expect, it } from "vitest";
import { randomId } from "@/lib/utils/random-id";

/** Remplaçant de `nanoid` : même alphabet, même entropie (6 bits par caractère). */
describe("randomId", () => {
    it("respecte la longueur demandée (21 par défaut, comme nanoid)", () => {
        expect(randomId()).toHaveLength(21);
        for (const size of [1, 2, 3, 4, 5, 6, 7, 16, 32, 64]) expect(randomId(size)).toHaveLength(size);
    });

    it("n'utilise que l'alphabet sûr pour les URL et les noms de fichiers", () => {
        for (let i = 0; i < 2_000; i++) expect(randomId(16)).toMatch(/^[A-Za-z0-9_-]{16}$/);
    });

    it("aucun doublon sur 100 000 identifiants de 16 caractères", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 100_000; i++) seen.add(randomId(16));
        expect(seen.size).toBe(100_000);
    });

    it("répartition uniforme des 64 caractères, y compris le dernier (aucun bit de remplissage)", () => {
        const counts = new Map<string, number>();
        const lastCounts = new Map<string, number>();
        const draws = 40_000;
        for (let i = 0; i < draws; i++) {
            const id = randomId(6);
            for (const ch of id) counts.set(ch, (counts.get(ch) ?? 0) + 1);
            lastCounts.set(id[5], (lastCounts.get(id[5]) ?? 0) + 1);
        }
        expect(counts.size).toBe(64);
        expect(lastCounts.size).toBe(64);
        const expected = (draws * 6) / 64;
        for (const n of counts.values()) expect(Math.abs(n - expected) / expected).toBeLessThan(0.1);
        const expectedLast = draws / 64;
        for (const n of lastCounts.values()) expect(Math.abs(n - expectedLast) / expectedLast).toBeLessThan(0.25);
    });

    it("refuse une taille invalide", () => {
        expect(() => randomId(0)).toThrow(RangeError);
        expect(() => randomId(2.5)).toThrow(RangeError);
    });
});
