import { describe, it, expect } from "vitest";
import {
  calculateWeightedAverage,
  calculateSubjectAverage,
  calculateGeneralAverage,
  getRank,
  getAppreciation,
  getPerformanceLevel,
} from "@/lib/utils/grades";

describe("utils/grades", () => {
  describe("calculateWeightedAverage", () => {
    it("returns null on empty array", () => {
      expect(calculateWeightedAverage([])).toBeNull();
    });

    it("ignores absences", () => {
      const result = calculateWeightedAverage([
        { value: 15, coefficient: 1, isAbsent: false, isExcused: false },
        { value: 10, coefficient: 1, isAbsent: true, isExcused: false },
      ]);
      expect(result).toBe(15);
    });

    it("ignores excused entries and null values", () => {
      const result = calculateWeightedAverage([
        { value: 10, coefficient: 1, isAbsent: false, isExcused: false },
        { value: null, coefficient: 1, isAbsent: false, isExcused: false },
        { value: 20, coefficient: 1, isAbsent: false, isExcused: true },
      ]);
      expect(result).toBe(10);
    });

    it("applies coefficients", () => {
      const result = calculateWeightedAverage([
        { value: 10, coefficient: 1, isAbsent: false, isExcused: false },
        { value: 20, coefficient: 3, isAbsent: false, isExcused: false },
      ]);
      // (10*1 + 20*3) / (1+3) = 70 / 4 = 17.5
      expect(result).toBe(17.5);
    });

    it("returns null when only excluded grades", () => {
      const result = calculateWeightedAverage([
        { value: null, coefficient: 2, isAbsent: false, isExcused: false },
        { value: 12, coefficient: 1, isAbsent: true, isExcused: false },
      ]);
      expect(result).toBeNull();
    });
  });

  describe("calculateSubjectAverage", () => {
    it("aggregates by studentId across evaluations", () => {
      const evaluations = [
        {
          coefficient: 2,
          grades: [
            { value: 10, coefficient: 1, isAbsent: false, isExcused: false, studentId: "s1" },
            { value: 20, coefficient: 1, isAbsent: false, isExcused: false, studentId: "s2" },
          ],
        },
        {
          coefficient: 1,
          grades: [
            { value: 15, coefficient: 1, isAbsent: false, isExcused: false, studentId: "s1" },
          ],
        },
      ];
      // s1: grades with coef from evaluation -> (10*2 + 15*1) / (2+1) = 35/3 ≈ 11.67
      const result = calculateSubjectAverage(evaluations, "s1");
      expect(result).toBeCloseTo(35 / 3, 5);
    });

    it("returns null when student has no grades", () => {
      const evaluations = [
        {
          coefficient: 1,
          grades: [
            { value: 12, coefficient: 1, isAbsent: false, isExcused: false, studentId: "other" },
          ],
        },
      ];
      expect(calculateSubjectAverage(evaluations, "ghost")).toBeNull();
    });
  });

  describe("calculateGeneralAverage", () => {
    it("ignores null subject averages", () => {
      const subjects = [
        { average: 12, coefficient: 2 },
        { average: null, coefficient: 3 },
        { average: 16, coefficient: 1 },
      ];
      // (12*2 + 16*1) / (2+1) = 40 / 3 ≈ 13.33
      expect(calculateGeneralAverage(subjects)).toBeCloseTo(40 / 3, 5);
    });

    it("returns null when nothing valid", () => {
      expect(calculateGeneralAverage([{ average: null, coefficient: 1 }])).toBeNull();
      expect(calculateGeneralAverage([])).toBeNull();
    });
  });

  describe("getRank", () => {
    it("ranks descending", () => {
      expect(getRank(15, [10, 15, 20])).toBe(2);
      expect(getRank(20, [10, 15, 20])).toBe(1);
      expect(getRank(10, [10, 15, 20])).toBe(3);
    });

    it("returns null for null input", () => {
      expect(getRank(null, [10, 20])).toBeNull();
    });

    it("filters out nulls in dataset", () => {
      expect(getRank(15, [null, 10, 15, null])).toBe(1);
    });
  });

  describe("getAppreciation", () => {
    it("returns expected labels at thresholds", () => {
      expect(getAppreciation(18)).toBe("Excellent");
      expect(getAppreciation(16)).toBe("Très bien");
      expect(getAppreciation(14)).toBe("Bien");
      expect(getAppreciation(12)).toBe("Assez bien");
      expect(getAppreciation(10)).toBe("Passable");
      expect(getAppreciation(8)).toBe("Insuffisant");
      expect(getAppreciation(4)).toBe("Très insuffisant");
    });

    it("returns Non évalué for null", () => {
      expect(getAppreciation(null)).toBe("Non évalué");
    });

    it("respects custom maxGrade", () => {
      expect(getAppreciation(90, 100)).toBe("Excellent");
      expect(getAppreciation(45, 100)).toBe("Insuffisant");
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
