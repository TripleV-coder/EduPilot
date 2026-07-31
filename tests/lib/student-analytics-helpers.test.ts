import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import {
  calculateStatistics,
  analyzeSubjectStrength,
  calculateTrend,
  getPerformanceLevel,
  calculateConsistencyRate,
  assessRiskLevel,
  calculateProgressionRate,
} from "@/lib/services/student-analytics";

describe("calculateStatistics", () => {
  it("retourne des nulls sans notes", () => {
    expect(calculateStatistics([])).toEqual({
      min: null,
      max: null,
      average: null,
      standardDev: null,
    });
  });

  it("calcule min/max/moyenne/écart-type", () => {
    const stats = calculateStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(9);
    expect(stats.average).toBe(5);
    expect(stats.standardDev).toBe(2);
  });
});

describe("analyzeSubjectStrength", () => {
  it("classe la matière selon ±0.5 écart-type autour de la moyenne générale", () => {
    expect(analyzeSubjectStrength(15, 12, 2)).toEqual({ isStrength: true, isWeakness: false });
    expect(analyzeSubjectStrength(9, 12, 2)).toEqual({ isStrength: false, isWeakness: true });
    expect(analyzeSubjectStrength(12.5, 12, 2)).toEqual({ isStrength: false, isWeakness: false });
  });
});

describe("calculateTrend", () => {
  it("retourne null sans période précédente exploitable", () => {
    expect(calculateTrend(12, null)).toBeNull();
    expect(calculateTrend(12, 0)).toBeNull();
  });

  it("gradue la tendance par variation en pourcentage", () => {
    expect(calculateTrend(12, 10)).toBe("STRONG_INCREASE"); // +20%
    expect(calculateTrend(11, 10)).toBe("INCREASE"); // +10%
    expect(calculateTrend(10.2, 10)).toBe("STABLE"); // +2%
    expect(calculateTrend(9.4, 10)).toBe("DECREASE"); // -6%
    expect(calculateTrend(8, 10)).toBe("STRONG_DECREASE"); // -20%
  });
});

describe("getPerformanceLevel", () => {
  it("mappe les paliers de moyenne", () => {
    expect(getPerformanceLevel(null)).toBeNull();
    expect(getPerformanceLevel(17)).toBe("EXCELLENT");
    expect(getPerformanceLevel(15)).toBe("VERY_GOOD");
    expect(getPerformanceLevel(13)).toBe("GOOD");
    expect(getPerformanceLevel(11)).toBe("AVERAGE");
    expect(getPerformanceLevel(9)).toBe("INSUFFICIENT");
    expect(getPerformanceLevel(5)).toBe("WEAK");
  });
});

describe("calculateConsistencyRate", () => {
  it("100 pour une moyenne nulle, décroît avec la variabilité", () => {
    expect(calculateConsistencyRate(2, 0)).toBe(100);
    expect(calculateConsistencyRate(0, 12)).toBe(100);
    expect(calculateConsistencyRate(3, 12)).toBe(75);
    expect(calculateConsistencyRate(15, 12)).toBe(0); // cv > 1 → borné à 0
  });
});

describe("assessRiskLevel", () => {
  it("NONE pour un élève sans signal", () => {
    expect(assessRiskLevel(14, 95, 0)).toEqual({ level: "NONE", factors: [] });
  });

  it("cumule notes + assiduité + comportement jusqu'à CRITICAL", () => {
    const result = assessRiskLevel(5, 60, 6);
    expect(result.level).toBe("CRITICAL"); // 40 + 30 + 20 = 90
    expect(result.factors).toHaveLength(3);
    expect(result.factors[0]).toContain("très faible");
  });

  it("gradue LOW/MEDIUM/HIGH", () => {
    expect(assessRiskLevel(9.5, 95, 0).level).toBe("LOW"); // 15
    expect(assessRiskLevel(9.5, 80, 0).level).toBe("MEDIUM"); // 15+15
    expect(assessRiskLevel(7, 80, 0).level).toBe("HIGH"); // 30+15
    expect(assessRiskLevel(null, 95, 0).level).toBe("NONE"); // moyenne inconnue ignorée
  });
});

describe("calculateProgressionRate", () => {
  it("retourne null sans référence, sinon la variation en %", () => {
    expect(calculateProgressionRate(12, null)).toBeNull();
    expect(calculateProgressionRate(12, 0)).toBeNull();
    expect(calculateProgressionRate(12, 10)).toBe(20);
    expect(calculateProgressionRate(9, 12)).toBe(-25);
  });
});
