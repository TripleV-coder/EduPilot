import { describe, it, expect } from "vitest";
import {
  evaluationTypeSchema,
  evaluationSchema,
  gradeSchema,
  bulkGradeSchema,
} from "@/lib/validations/evaluation";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/evaluation", () => {
  describe("evaluationTypeSchema", () => {
    it("defaults weight to 1", () => {
      const r = evaluationTypeSchema.safeParse({ name: "Contrôle", code: "CTRL" });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.weight).toBe(1);
    });

    it("rejects weight out of [0.1, 10]", () => {
      expect(
        evaluationTypeSchema.safeParse({ name: "X", code: "X", weight: 0 }).success
      ).toBe(false);
      expect(
        evaluationTypeSchema.safeParse({ name: "X", code: "X", weight: 11 }).success
      ).toBe(false);
    });

    it("rejects code longer than 10 chars", () => {
      const r = evaluationTypeSchema.safeParse({
        name: "Examen",
        code: "TOO_LONG_CODE",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("evaluationSchema", () => {
    it("defaults maxGrade=20 and coefficient=1", () => {
      const r = evaluationSchema.safeParse({
        classSubjectId: cuid(),
        periodId: cuid(),
        typeId: cuid(),
        date: "2026-05-16",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.maxGrade).toBe(20);
        expect(r.data.coefficient).toBe(1);
      }
    });

    it("rejects maxGrade < 1", () => {
      const r = evaluationSchema.safeParse({
        classSubjectId: cuid(),
        periodId: cuid(),
        typeId: cuid(),
        date: "2026-05-16",
        maxGrade: 0,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("gradeSchema", () => {
    it("accepts null value (absent students)", () => {
      const r = gradeSchema.safeParse({
        evaluationId: cuid(),
        studentId: cuid(),
        value: null,
        isAbsent: true,
      });
      expect(r.success).toBe(true);
    });

    it("rejects negative value", () => {
      const r = gradeSchema.safeParse({
        evaluationId: cuid(),
        studentId: cuid(),
        value: -1,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("bulkGradeSchema", () => {
    it("validates list of grades", () => {
      const r = bulkGradeSchema.safeParse({
        evaluationId: cuid(),
        grades: [
          { studentId: cuid(), value: 15 },
          { studentId: cuid(), value: 18 },
          { studentId: cuid(), value: null, isAbsent: true },
        ],
      });
      expect(r.success).toBe(true);
    });

    it("rejects when any cuid is wrong", () => {
      const r = bulkGradeSchema.safeParse({
        evaluationId: cuid(),
        grades: [{ studentId: "x", value: 10 }],
      });
      expect(r.success).toBe(false);
    });
  });
});
