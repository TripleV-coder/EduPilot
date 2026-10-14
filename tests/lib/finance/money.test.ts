import { describe, it, expect } from "vitest";
import { addMonthsClamped, fcfaAmountSchema, roundFcfa, splitInstallments } from "@/lib/finance/money";

describe("montants FCFA", () => {
  it("répartit un total en échéances entières dont la somme tombe juste", () => {
    expect(splitInstallments(100_000, 3)).toEqual([33_334, 33_333, 33_333]);
    expect(splitInstallments(85_000, 4)).toEqual([21_250, 21_250, 21_250, 21_250]);
    for (const [total, n] of [[100_001, 7], [99_999, 12], [1, 3], [0, 2]] as const) {
      const parts = splitInstallments(total, n);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts.every(Number.isInteger)).toBe(true);
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    }
    expect(() => splitInstallments(1000, 0)).toThrow(RangeError);
  });

  it("arrondit au franc, demi vers le haut", () => {
    expect(roundFcfa(33_333.5)).toBe(33_334);
    expect(roundFcfa(18_750.49)).toBe(18_750);
    expect(roundFcfa(1.005 * 1000)).toBe(1005);
  });

  it("refuse centimes, zéro, négatif et NaN", () => {
    expect(fcfaAmountSchema.safeParse(15_000).success).toBe(true);
    expect(fcfaAmountSchema.safeParse("15000").success).toBe(true);
    for (const bad of [15_000.5, 0, -100, "abc", Number.NaN]) {
      expect(fcfaAmountSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("ajoute des mois sans déborder sur le mois suivant", () => {
    const d = (s: string) => new Date(`${s}T12:00:00`);
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    expect(iso(addMonthsClamped(d("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(addMonthsClamped(d("2028-01-31"), 1))).toBe("2028-02-29");
    expect(iso(addMonthsClamped(d("2026-01-31"), 2))).toBe("2026-03-31");
    expect(iso(addMonthsClamped(d("2026-10-15"), 3))).toBe("2027-01-15");
  });
});
