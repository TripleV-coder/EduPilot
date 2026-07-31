import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { computePerformanceTrend } from "@/lib/services/orientation";

function g(dayOffset: number, value: number) {
  const date = new Date("2026-01-01T00:00:00Z");
  date.setDate(date.getDate() + dayOffset);
  return { date, value };
}

describe("computePerformanceTrend", () => {
  it("STABLE si moins de 4 notes", () => {
    expect(computePerformanceTrend([g(0, 8), g(1, 18)])).toBe("STABLE");
  });

  it("INCREASE quand la 2nde moitié progresse d'au moins 0,5 pt", () => {
    expect(computePerformanceTrend([g(0, 10), g(1, 10), g(2, 11), g(3, 11)])).toBe("INCREASE");
  });

  it("STRONG_INCREASE pour une forte progression (≥ 2 pts)", () => {
    expect(computePerformanceTrend([g(0, 8), g(1, 8), g(2, 14), g(3, 14)])).toBe("STRONG_INCREASE");
  });

  it("DECREASE / STRONG_DECREASE pour une baisse", () => {
    expect(computePerformanceTrend([g(0, 12), g(1, 12), g(2, 11), g(3, 11)])).toBe("DECREASE");
    expect(computePerformanceTrend([g(0, 15), g(1, 15), g(2, 9), g(3, 9)])).toBe("STRONG_DECREASE");
  });

  it("réordonne chronologiquement avant de comparer", () => {
    // Notes fournies dans le désordre : haut récent, bas ancien → progression.
    const trend = computePerformanceTrend([g(3, 15), g(0, 9), g(2, 14), g(1, 9)]);
    expect(trend).toBe("STRONG_INCREASE");
  });

  it("STABLE quand la variation reste sous le seuil", () => {
    expect(computePerformanceTrend([g(0, 12), g(1, 12), g(2, 12.2), g(3, 12.1)])).toBe("STABLE");
  });
});
