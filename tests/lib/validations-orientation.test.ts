import { describe, it, expect } from "vitest";
import {
  studentOrientationSchema,
  recommendationSchema,
} from "@/lib/validations/orientation";

describe("validations/orientation", () => {
  describe("studentOrientationSchema", () => {
    it("accepts a valid orientation", () => {
      const r = studentOrientationSchema.safeParse({
        studentId: "s1",
        academicYearId: "y1",
        classLevelId: "l1",
      });
      expect(r.success).toBe(true);
    });

    it("rejects empty fields", () => {
      const r = studentOrientationSchema.safeParse({
        studentId: "",
        academicYearId: "y1",
        classLevelId: "l1",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("recommendationSchema", () => {
    const base = {
      orientationId: "o1",
      recommendedSeries: "SERIE_D",
      score: 75,
      justification: "Performances solides en sciences",
    } as const;

    it("accepts a valid recommendation with defaults", () => {
      const r = recommendationSchema.safeParse(base);
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.rank).toBe(1);
        expect(r.data.strengths).toEqual([]);
        expect(r.data.warnings).toEqual([]);
      }
    });

    it("rejects unknown series", () => {
      const r = recommendationSchema.safeParse({ ...base, recommendedSeries: "SERIE_X" as any });
      expect(r.success).toBe(false);
    });

    it("clamps score between 0 and 100", () => {
      expect(recommendationSchema.safeParse({ ...base, score: -1 }).success).toBe(false);
      expect(recommendationSchema.safeParse({ ...base, score: 101 }).success).toBe(false);
      expect(recommendationSchema.safeParse({ ...base, score: 0 }).success).toBe(true);
      expect(recommendationSchema.safeParse({ ...base, score: 100 }).success).toBe(true);
    });

    it("rejects empty justification", () => {
      const r = recommendationSchema.safeParse({ ...base, justification: "" });
      expect(r.success).toBe(false);
    });

    it("rank must be integer >= 1", () => {
      const r = recommendationSchema.safeParse({ ...base, rank: 0 });
      expect(r.success).toBe(false);
    });
  });
});
