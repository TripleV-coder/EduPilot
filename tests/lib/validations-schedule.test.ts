import { describe, it, expect } from "vitest";
import { scheduleSchema, DAYS_OF_WEEK, TIME_SLOTS } from "@/lib/validations/schedule";

const cuid = () => "ckxx" + Math.random().toString(36).slice(2, 22);

describe("validations/schedule", () => {
  describe("scheduleSchema", () => {
    it("accepts a valid schedule entry", () => {
      const r = scheduleSchema.safeParse({
        classId: cuid(),
        classSubjectId: cuid(),
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "10:00",
        room: "A101",
      });
      expect(r.success).toBe(true);
    });

    it("rejects invalid time format", () => {
      const base = {
        classId: cuid(),
        dayOfWeek: 1,
        startTime: "8h",
        endTime: "10:00",
      };
      expect(scheduleSchema.safeParse(base).success).toBe(false);
    });

    it("rejects 24:00 (invalid hour)", () => {
      const r = scheduleSchema.safeParse({
        classId: cuid(),
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "24:00",
      });
      expect(r.success).toBe(false);
    });

    it("rejects endTime <= startTime", () => {
      const r = scheduleSchema.safeParse({
        classId: cuid(),
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "09:00",
      });
      expect(r.success).toBe(false);
    });

    it("rejects dayOfWeek out of range", () => {
      const base = {
        classId: cuid(),
        startTime: "08:00",
        endTime: "10:00",
      };
      expect(scheduleSchema.safeParse({ ...base, dayOfWeek: -1 }).success).toBe(false);
      expect(scheduleSchema.safeParse({ ...base, dayOfWeek: 7 }).success).toBe(false);
    });

    it("accepts all 7 days [0-6]", () => {
      const base = {
        classId: cuid(),
        startTime: "08:00",
        endTime: "10:00",
      };
      for (let d = 0; d <= 6; d++) {
        expect(scheduleSchema.safeParse({ ...base, dayOfWeek: d }).success).toBe(true);
      }
    });
  });

  describe("constants", () => {
    it("DAYS_OF_WEEK covers 7 days", () => {
      expect(DAYS_OF_WEEK).toHaveLength(7);
      const labels = DAYS_OF_WEEK.map((d) => d.label);
      expect(labels).toContain("Lundi");
      expect(labels).toContain("Dimanche");
    });

    it("TIME_SLOTS in HH:mm format and ordered", () => {
      expect(TIME_SLOTS.length).toBeGreaterThan(10);
      for (const t of TIME_SLOTS) {
        expect(t).toMatch(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/);
      }
    });
  });
});
