import { describe, it, expect } from "vitest";
import { subjectSchema, classSubjectSchema } from "@/lib/validations/subject";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/subject", () => {
  describe("subjectSchema", () => {
    it("accepts a basic subject", () => {
      const r = subjectSchema.safeParse({ name: "Mathématiques", code: "MAT" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.isActive).toBe(true);
    });

    it("rejects coefficient < 0.5 or > 10", () => {
      expect(subjectSchema.safeParse({ name: "X", code: "X", coefficient: 0 }).success).toBe(false);
      expect(subjectSchema.safeParse({ name: "X", code: "X", coefficient: 11 }).success).toBe(false);
    });

    it("rejects code longer than 10", () => {
      const r = subjectSchema.safeParse({
        name: "Mathématiques",
        code: "THIS_IS_WAY_TOO_LONG",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("classSubjectSchema", () => {
    it("accepts assignment without teacher", () => {
      const r = classSubjectSchema.safeParse({
        classId: cuid(),
        subjectId: cuid(),
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.coefficient).toBe(1);
    });

    it("validates weeklyHours range", () => {
      expect(
        classSubjectSchema.safeParse({
          classId: cuid(),
          subjectId: cuid(),
          weeklyHours: 0,
        }).success
      ).toBe(false);
      expect(
        classSubjectSchema.safeParse({
          classId: cuid(),
          subjectId: cuid(),
          weeklyHours: 21,
        }).success
      ).toBe(false);
    });
  });
});
