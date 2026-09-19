import { describe, it, expect } from "vitest";
import { forEachWithConcurrency } from "@/lib/utils/concurrency";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("forEachWithConcurrency", () => {
  it("traite chaque élément une fois sans dépasser la limite de tâches simultanées", async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];

    await forEachWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async (item) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      seen.push(item);
      inFlight--;
    });

    expect(peak).toBe(4);
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("n'interrompt pas les autres éléments quand l'un échoue et renvoie les échecs", async () => {
    const seen: number[] = [];
    const failures = await forEachWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      await tick();
      if (item === 2) throw new Error("échec 2");
      seen.push(item);
    });

    expect(seen.sort()).toEqual([1, 3, 4]);
    expect(failures).toEqual([{ item: 2, error: expect.objectContaining({ message: "échec 2" }) }]);
  });

  it("accepte une liste vide", async () => {
    expect(await forEachWithConcurrency([], 4, async () => undefined)).toEqual([]);
  });
});
