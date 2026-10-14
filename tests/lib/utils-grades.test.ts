import { describe, it, expect } from "vitest";
import {
  getAppreciation,
  getPerformanceLevel,
} from "@/lib/utils/grades";

describe("utils/grades", () => {
  describe("getAppreciation", () => {
    it("returns expected labels at thresholds", () => {
      expect(getAppreciation(18)).toBe("Excellent");
      expect(getAppreciation(16)).toBe("Très bien");
      expect(getAppreciation(14)).toBe("Bien");
      expect(getAppreciation(12)).toBe("Assez bien");
      expect(getAppreciation(10)).toBe("Passable");
      expect(getAppreciation(8)).toBe("Échec");
      expect(getAppreciation(4)).toBe("Échec");
    });

    it("returns Non évalué for null", () => {
      expect(getAppreciation(null)).toBe("Non évalué");
    });

    it("respects custom maxGrade", () => {
      expect(getAppreciation(90, 100)).toBe("Excellent");
      expect(getAppreciation(45, 100)).toBe("Échec");
    });
  });

  describe("getPerformanceLevel", () => {
    it("classifies excellent / good / average", () => {
      expect(getPerformanceLevel(17)).toBe("excellent");
      expect(getPerformanceLevel(14)).toBe("good");
      expect(getPerformanceLevel(11)).toBe("average");
    });

    it("identifies at_risk and failing", () => {
      expect(getPerformanceLevel(9)).toBe("at_risk");
      expect(getPerformanceLevel(5)).toBe("failing");
    });

    it("returns null for null input", () => {
      expect(getPerformanceLevel(null)).toBeNull();
    });
  });
});
