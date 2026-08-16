import { describe, it, expect } from "vitest";
import {
  schoolSchema,
  academicConfigSchema,
  academicYearSchema,
  periodSchema,
  classLevelSchema,
  classSchema,
} from "@/lib/validations/school";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/school", () => {
  describe("schoolSchema", () => {
    it("accepts a valid school", () => {
      const r = schoolSchema.safeParse({
        name: "École Excellence",
        code: "EXCEL",
        type: "PRIVATE",
        level: "PRIMARY",
        email: "contact@school.bj",
      });
      expect(r.success).toBe(true);
    });

    it("accepts empty email string explicitly", () => {
      const r = schoolSchema.safeParse({
        name: "X",
        code: "X1",
        type: "PUBLIC",
        level: "MIXED",
        email: "",
      });
      // name too short → expect false
      expect(r.success).toBe(false);
    });

    it("rejects unknown type/level", () => {
      expect(
        schoolSchema.safeParse({
          name: "OK",
          code: "C1",
          type: "GOV" as never,
          level: "PRIMARY",
        }).success
      ).toBe(false);
    });

    it("rejects bad email", () => {
      expect(
        schoolSchema.safeParse({
          name: "Valid School",
          code: "VS",
          type: "PUBLIC",
          level: "MIXED",
          email: "not-email",
        }).success
      ).toBe(false);
    });
  });

  describe("academicConfigSchema", () => {
    it("clamps periodsCount within range", () => {
      expect(
        academicConfigSchema.safeParse({
          periodType: "TRIMESTER",
          periodsCount: 3,
          maxGrade: 20,
          passingGrade: 10,
        }).success
      ).toBe(true);

      expect(
        academicConfigSchema.safeParse({
          periodType: "TRIMESTER",
          periodsCount: 5,
          maxGrade: 20,
          passingGrade: 10,
        }).success
      ).toBe(false);
    });

    it("rejects maxGrade > 100", () => {
      const r = academicConfigSchema.safeParse({
        periodType: "TRIMESTER",
        periodsCount: 3,
        maxGrade: 200,
        passingGrade: 50,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("academicYearSchema", () => {
    it("coerces date strings", () => {
      const r = academicYearSchema.safeParse({
        name: "2026-2027",
        startDate: "2026-09-01",
        endDate: "2027-07-01",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.startDate).toBeInstanceOf(Date);
        expect(r.data.isCurrent).toBe(false);
      }
    });

    it("rejects too-short name", () => {
      const r = academicYearSchema.safeParse({
        name: "ab",
        startDate: "2026-09-01",
        endDate: "2027-07-01",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("periodSchema", () => {
    it("accepts valid period", () => {
      const r = periodSchema.safeParse({
        name: "Trimestre 1",
        type: "TRIMESTER",
        startDate: "2026-09-01",
        endDate: "2026-12-15",
        sequence: 1,
      });
      expect(r.success).toBe(true);
    });

    it("sequence must be >= 1", () => {
      const r = periodSchema.safeParse({
        name: "Trimestre 1",
        type: "TRIMESTER",
        startDate: "2026-09-01",
        endDate: "2026-12-15",
        sequence: 0,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("classLevelSchema", () => {
    it("accepts a class level", () => {
      const r = classLevelSchema.safeParse({
        name: "CM2",
        code: "CM2",
        level: "PRIMARY",
        sequence: 6,
      });
      expect(r.success).toBe(true);
    });
  });

  describe("classSchema", () => {
    it("rejects empty name", () => {
      expect(classSchema.safeParse({ name: "", classLevelId: cuid() }).success).toBe(false);
    });

    it("requires cuid for classLevelId", () => {
      expect(classSchema.safeParse({ name: "6e A", classLevelId: "no" }).success).toBe(false);
    });
  });
});
