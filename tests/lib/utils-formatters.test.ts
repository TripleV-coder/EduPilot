import { describe, it, expect } from "vitest";
import {
  formatDateShort,
  formatDateNumeric,
  formatDateLong,
  formatDateTimeShort,
  formatDateTimeLong,
  formatTime,
  formatFileSize,
} from "@/lib/utils/formatters";

describe("utils/formatters", () => {
  describe("formatDateShort", () => {
    it("formats ISO date to short French", () => {
      expect(formatDateShort("2026-01-12T00:00:00.000Z")).toMatch(/12 janv\.? 2026/);
    });

    it("returns dash for null/undefined", () => {
      expect(formatDateShort(null)).toBe("-");
      expect(formatDateShort(undefined)).toBe("-");
      expect(formatDateShort("")).toBe("-");
    });
  });

  describe("formatDateNumeric", () => {
    it("formats as DD/MM/YYYY", () => {
      const result = formatDateNumeric("2026-05-16T12:00:00Z");
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it("handles null", () => {
      expect(formatDateNumeric(null)).toBe("-");
    });
  });

  describe("formatDateLong", () => {
    it("includes weekday and month name", () => {
      const result = formatDateLong("2026-01-12T12:00:00Z");
      expect(result.toLowerCase()).toContain("janvier");
    });
  });

  describe("formatDateTimeShort and Long", () => {
    it("includes hour/minute", () => {
      const short = formatDateTimeShort("2026-01-12T14:30:00Z");
      const long = formatDateTimeLong("2026-01-12T14:30:00Z");
      expect(short).toMatch(/\d{2}:\d{2}/);
      expect(long).toMatch(/\d{2}:\d{2}/);
    });

    it("dashes on missing", () => {
      expect(formatDateTimeShort(null)).toBe("-");
      expect(formatDateTimeLong(null)).toBe("-");
    });
  });

  describe("formatTime", () => {
    it("returns HH:mm:ss", () => {
      const result = formatTime("2026-01-12T09:05:07Z");
      expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it("dash on null", () => {
      expect(formatTime(null)).toBe("-");
    });
  });

  describe("formatFileSize", () => {
    it("returns 0 B for null, undefined, 0", () => {
      expect(formatFileSize(null)).toBe("0 B");
      expect(formatFileSize(undefined)).toBe("0 B");
      expect(formatFileSize(0)).toBe("0 B");
    });

    it("formats bytes without decimals", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("formats KB with 1 decimal", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("formats MB", () => {
      expect(formatFileSize(1024 * 1024 * 2)).toBe("2.0 MB");
    });

    it("formats GB", () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 3)).toBe("3.0 GB");
    });
  });
});
