import { describe, it, expect } from "vitest";
import {
  LEVEL_CYCLES,
  orderedCycles,
  getCycle,
  examForLevel,
  levelForGrade,
  examsForOfferedLevels,
  normalizeOfferedLevels,
  isRealCycle,
} from "@/lib/benin/levels";

describe("référentiel des cycles (benin/levels)", () => {
  it("mappe chaque cycle à ses classes + examen national", () => {
    expect(LEVEL_CYCLES.PRIMARY.grades).toContain("CM2");
    expect(LEVEL_CYCLES.PRIMARY.finalExam).toBe("CEP");
    expect(LEVEL_CYCLES.SECONDARY_COLLEGE.grades).toContain("3EME");
    expect(LEVEL_CYCLES.SECONDARY_COLLEGE.finalExam).toBe("BEPC");
    expect(LEVEL_CYCLES.SECONDARY_LYCEE.grades).toContain("TLE");
    expect(LEVEL_CYCLES.SECONDARY_LYCEE.finalExam).toBe("BAC");
  });

  it("expose les séries uniquement au lycée", () => {
    expect(LEVEL_CYCLES.SECONDARY_LYCEE.series?.length).toBeGreaterThan(5);
    expect(LEVEL_CYCLES.PRIMARY.series).toBeUndefined();
    expect(LEVEL_CYCLES.SECONDARY_LYCEE.series?.map((s) => s.code)).toContain("SERIE_D");
  });

  it("ordonne primaire → collège → lycée", () => {
    expect(orderedCycles().map((c) => c.level)).toEqual([
      "PRIMARY",
      "SECONDARY_COLLEGE",
      "SECONDARY_LYCEE",
    ]);
  });

  it("isRealCycle exclut MIXED", () => {
    expect(isRealCycle("PRIMARY")).toBe(true);
    expect(isRealCycle("MIXED")).toBe(false);
    expect(getCycle("MIXED")).toBeNull();
    expect(examForLevel("MIXED")).toBeNull();
  });

  it("retrouve le cycle d'une classe (reverse lookup)", () => {
    expect(levelForGrade("CM2")).toBe("PRIMARY");
    expect(levelForGrade("3eme")).toBe("SECONDARY_COLLEGE");
    expect(levelForGrade("TLE")).toBe("SECONDARY_LYCEE");
    expect(levelForGrade("INCONNU")).toBeNull();
  });

  it("déduit les examens et normalise les cycles offerts", () => {
    expect(examsForOfferedLevels(["SECONDARY_LYCEE", "PRIMARY"])).toEqual(["CEP", "BAC"]);
    expect(normalizeOfferedLevels(["SECONDARY_LYCEE", "MIXED", "PRIMARY"])).toEqual([
      "PRIMARY",
      "SECONDARY_LYCEE",
    ]);
  });
});
