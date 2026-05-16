import { describe, it, expect } from "vitest";
import {
  primarySubjects,
  bepcSubjects,
  cepSubjects,
  collegeSubjects,
  gradeMentions,
  getMention,
  calculateWeightedAverage,
  bacSubjects,
  levelConfig,
} from "@/lib/benin/config";

describe("benin/config", () => {
  describe("subject catalogues", () => {
    it("all subjects have required fields", () => {
      const all = [
        ...primarySubjects,
        ...bepcSubjects,
        ...cepSubjects,
        ...collegeSubjects,
        ...bacSubjects,
      ];
      for (const s of all) {
        expect(s.code).toBeTruthy();
        expect(s.name).toBeTruthy();
        expect(typeof s.defaultCoefficient).toBe("number");
      }
    });

    it("primary subjects all have coefficient 1", () => {
      for (const s of primarySubjects) {
        expect(s.defaultCoefficient).toBe(1);
      }
    });

    it("BEPC subjects include FRA, MAT, ANG", () => {
      const codes = bepcSubjects.map((s) => s.code);
      expect(codes).toContain("FRA");
      expect(codes).toContain("MAT");
      expect(codes).toContain("ANG");
    });

    it("BAC série D has scientific weight (MAT >= 4, SVT >= 5)", () => {
      const mat = bacSubjects.find((s) => s.code === "MAT");
      const svt = bacSubjects.find((s) => s.code === "SVT");
      expect(mat?.defaultCoefficient).toBe(4);
      expect(svt?.defaultCoefficient).toBe(5);
    });
  });

  describe("gradeMentions and getMention", () => {
    it("returns ECHEC for below 10", () => {
      expect(getMention(0)?.code).toBe("ECHEC");
      expect(getMention(9.99)?.code).toBe("ECHEC");
    });

    it("returns PASSABLE for 10–11.99", () => {
      expect(getMention(10)?.code).toBe("PASSABLE");
      expect(getMention(11.99)?.code).toBe("PASSABLE");
    });

    it("returns ASSEZ_BIEN for 12–13.99", () => {
      expect(getMention(12)?.code).toBe("ASSEZ_BIEN");
      expect(getMention(13.5)?.code).toBe("ASSEZ_BIEN");
    });

    it("returns BIEN for 14–15.99", () => {
      expect(getMention(14)?.code).toBe("BIEN");
      expect(getMention(15.99)?.code).toBe("BIEN");
    });

    it("returns TRES_BIEN for 16–17.99", () => {
      expect(getMention(16)?.code).toBe("TRES_BIEN");
    });

    it("returns EXCELLENT for 18–20", () => {
      expect(getMention(18)?.code).toBe("EXCELLENT");
      expect(getMention(20)?.code).toBe("EXCELLENT");
    });

    it("returns null for out-of-range", () => {
      expect(getMention(-1)).toBeNull();
      expect(getMention(25)).toBeNull();
    });

    it("each mention has a 6-char hex color", () => {
      for (const m of gradeMentions) {
        expect(m.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe("calculateWeightedAverage", () => {
    it("returns 0 on empty array", () => {
      expect(calculateWeightedAverage([])).toBe(0);
    });

    it("returns 0 when total coefficients = 0", () => {
      expect(calculateWeightedAverage([{ value: 10, coefficient: 0 }])).toBe(0);
    });

    it("computes weighted average rounded to 2 decimals", () => {
      const r = calculateWeightedAverage([
        { value: 12, coefficient: 2 },
        { value: 16, coefficient: 1 },
      ]);
      // (12*2 + 16*1) / 3 = 40/3 = 13.33...
      expect(r).toBe(13.33);
    });
  });

  describe("levelConfig", () => {
    it("PRIMARY ends with CEP exam", () => {
      expect(levelConfig.PRIMARY.finalExam).toBe("CEP");
      expect(levelConfig.PRIMARY.levels).toContain("CM2");
    });

    it("COLLEGE ends with BEPC exam", () => {
      expect(levelConfig.COLLEGE.finalExam).toBe("BEPC");
      expect(levelConfig.COLLEGE.levels).toContain("3EME");
    });
  });
});
