import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/cache/redis", () => ({
  getCacheService: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    clear: vi.fn().mockResolvedValue(true),
  })),
}));

import {
  generateCacheKey,
  CACHE_PATHS,
  CACHE_TTL_SHORT,
  CACHE_TTL_MEDIUM,
  CACHE_TTL_LONG,
  invalidateByPath,
  invalidateCache,
} from "@/lib/api/cache-helpers";

describe("api/cache-helpers", () => {
  describe("generateCacheKey", () => {
    it("includes pathname and sorted query params", () => {
      const key = generateCacheKey(
        "/api/students",
        new URLSearchParams({ classId: "abc", page: "1" })
      );
      expect(key.startsWith("api:/api/students")).toBe(true);
      expect(key).toContain("classId");
      expect(key).toContain("page");
    });

    it("appends user namespace when userId provided", () => {
      const k = generateCacheKey("/api/me", undefined, "u123");
      expect(k).toContain(":user:u123");
    });

    it("omits paramsStr when no query", () => {
      const k = generateCacheKey("/api/static");
      expect(k).toBe("api:/api/static");
    });
  });

  describe("CACHE_PATHS and TTL", () => {
    it("exposes known endpoints", () => {
      expect(CACHE_PATHS.students).toBe("/api/students");
      expect(CACHE_PATHS.teachers).toBe("/api/teachers");
      expect(CACHE_PATHS.classes).toBe("/api/classes");
      expect(CACHE_PATHS.payments).toBe("/api/finance/payments");
    });

    it("TTL values are ordered", () => {
      expect(CACHE_TTL_SHORT).toBeLessThan(CACHE_TTL_MEDIUM);
      expect(CACHE_TTL_MEDIUM).toBeLessThan(CACHE_TTL_LONG);
    });
  });

  describe("invalidate helpers", () => {
    it("invalidateByPath normalises leading slash", async () => {
      await expect(invalidateByPath("api/students")).resolves.toBeUndefined();
      await expect(invalidateByPath("/api/grades")).resolves.toBeUndefined();
    });

    it("invalidateCache passes raw pattern", async () => {
      await expect(invalidateCache("api:*")).resolves.toBeUndefined();
    });
  });
});
