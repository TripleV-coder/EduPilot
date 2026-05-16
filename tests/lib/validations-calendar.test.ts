import { describe, it, expect } from "vitest";
import {
  schoolHolidaySchema,
  publicHolidaySchema,
  calendarEventSchema,
} from "@/lib/validations/calendar";

describe("validations/calendar", () => {
  describe("schoolHolidaySchema", () => {
    it("accepts a valid school holiday", () => {
      const r = schoolHolidaySchema.safeParse({
        name: "Toussaint",
        type: "TOUSSAINT",
        academicYearId: "year-id",
        startDate: "2026-10-26",
        endDate: "2026-11-08",
      });
      expect(r.success).toBe(true);
    });

    it("rejects unknown holiday type", () => {
      const r = schoolHolidaySchema.safeParse({
        name: "Custom",
        type: "RANDOM",
        academicYearId: "year-id",
        startDate: "2026-10-01",
        endDate: "2026-10-15",
      });
      expect(r.success).toBe(false);
    });

    it("requires academicYearId", () => {
      const r = schoolHolidaySchema.safeParse({
        name: "Noël",
        type: "CHRISTMAS",
        academicYearId: "",
        startDate: "2026-12-20",
        endDate: "2027-01-05",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("publicHolidaySchema", () => {
    it("defaults isRecurring to true", () => {
      const r = publicHolidaySchema.safeParse({
        name: "1er janvier",
        type: "NATIONAL",
        date: "2027-01-01",
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.isRecurring).toBe(true);
    });

    it("accepts all 4 types", () => {
      for (const type of ["NATIONAL", "RELIGIOUS", "INTERNATIONAL", "LOCAL"]) {
        const r = publicHolidaySchema.safeParse({
          name: "Test",
          type,
          date: "2026-01-01",
        });
        expect(r.success).toBe(true);
      }
    });
  });

  describe("calendarEventSchema", () => {
    it("accepts a CONSEIL_CLASSE event with defaults", () => {
      const r = calendarEventSchema.safeParse({
        name: "Conseil de classe 6e A",
        type: "CONSEIL_CLASSE",
        academicYearId: "year-id",
        startDate: "2026-12-15",
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.isAllDay).toBe(true);
        expect(r.data.isPublic).toBe(true);
        expect(r.data.targetRoles).toEqual([]);
      }
    });

    it("rejects unknown event type", () => {
      const r = calendarEventSchema.safeParse({
        name: "Truc",
        type: "FOO",
        academicYearId: "year-id",
        startDate: "2026-01-01",
      });
      expect(r.success).toBe(false);
    });
  });
});
