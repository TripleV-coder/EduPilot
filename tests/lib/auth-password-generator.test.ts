import { describe, it, expect } from "vitest";
import {
  generateTempPassword,
  generateShortTempPassword,
  generateStrongPassword,
  isValidTempPasswordFormat,
  normalizeTempPassword,
  generateMatricule,
  generateEmployeeNumber,
} from "@/lib/auth/password-generator";

describe("auth/password-generator", () => {
  describe("generateTempPassword", () => {
    it("matches XXXX-9999 format and excludes confusing chars", () => {
      for (let i = 0; i < 100; i++) {
        const p = generateTempPassword();
        expect(p).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789]{4}$/);
        expect(p).not.toMatch(/[OIL01]/);
      }
    });
  });

  describe("generateShortTempPassword", () => {
    it("matches XXX999 format", () => {
      for (let i = 0; i < 50; i++) {
        const p = generateShortTempPassword();
        expect(p).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{3}[23456789]{3}$/);
      }
    });
  });

  describe("generateStrongPassword", () => {
    it("contains at least one lowercase, uppercase, number, special", () => {
      const p = generateStrongPassword(12);
      expect(p.length).toBe(12);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[!@#$%&*+=\-]/);
    });

    it("respects custom length", () => {
      expect(generateStrongPassword(16).length).toBe(16);
      expect(generateStrongPassword(20).length).toBe(20);
    });
  });

  describe("isValidTempPasswordFormat", () => {
    it("accepts with and without dash", () => {
      expect(isValidTempPasswordFormat("HKMP-4728")).toBe(true);
      expect(isValidTempPasswordFormat("HKMP4728")).toBe(true);
    });

    it("rejects malformed", () => {
      expect(isValidTempPasswordFormat("hkmp-4728")).toBe(false);
      expect(isValidTempPasswordFormat("HK-4728")).toBe(false);
      expect(isValidTempPasswordFormat("HKMPABCD")).toBe(false);
      expect(isValidTempPasswordFormat("")).toBe(false);
    });
  });

  describe("normalizeTempPassword", () => {
    it("removes dash and uppercases", () => {
      expect(normalizeTempPassword("hkmp-4728")).toBe("HKMP4728");
      expect(normalizeTempPassword("HKMP4728")).toBe("HKMP4728");
    });
  });

  describe("generateMatricule", () => {
    it("returns 9-digit string starting with current year", () => {
      const m = generateMatricule();
      expect(m).toMatch(/^\d{9}$/);
      expect(m.startsWith(String(new Date().getFullYear()))).toBe(true);
    });
  });

  describe("generateEmployeeNumber", () => {
    it("uses prefix + year + 4 digits", () => {
      const t = generateEmployeeNumber("T");
      expect(t).toMatch(/^T\d{4}\d{4}$/);
      expect(t.startsWith("T" + new Date().getFullYear())).toBe(true);
    });

    it("defaults prefix to E", () => {
      expect(generateEmployeeNumber()[0]).toBe("E");
    });
  });
});
