import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

import {
  isValidCuid,
  validateCuid,
  validateCuids,
  getSearchParam,
  createSearchFilter,
  createErrorResponse,
  createPaginationMeta,
} from "@/lib/api/api-helpers";

const validCuid = "c" + "a".repeat(24);
const otherCuid = "c" + "b".repeat(24);

describe("api/api-helpers — pure helpers", () => {
  describe("isValidCuid", () => {
    it("accepts valid cuid", () => {
      expect(isValidCuid(validCuid)).toBe(true);
    });

    it("rejects non-cuid", () => {
      expect(isValidCuid("not-a-cuid")).toBe(false);
      expect(isValidCuid("")).toBe(false);
      expect(isValidCuid("A" + "a".repeat(24))).toBe(false);
    });
  });

  describe("validateCuid", () => {
    it("returns id when valid", () => {
      expect(validateCuid(validCuid, "userId")).toBe(validCuid);
    });

    it("throws when missing", () => {
      expect(() => validateCuid(null, "userId")).toThrow(/userId est requis/);
      expect(() => validateCuid("", "userId")).toThrow(/userId est requis/);
    });

    it("throws when format invalid", () => {
      expect(() => validateCuid("nope", "userId")).toThrow(/userId invalide/);
    });
  });

  describe("validateCuids", () => {
    it("accepts an array of valid cuids", () => {
      expect(validateCuids([validCuid, otherCuid])).toEqual([validCuid, otherCuid]);
    });

    it("throws on empty", () => {
      expect(() => validateCuids([], "ids")).toThrow(/ids sont requis/);
    });

    it("throws and lists invalid ids", () => {
      expect(() => validateCuids([validCuid, "bad"], "studentIds")).toThrow(/studentIds invalides/);
    });
  });

  function mockReq(url: string): NextRequest {
    return { url, nextUrl: new URL(url) } as any;
  }

  describe("getSearchParam", () => {
    it("returns trimmed search", () => {
      expect(getSearchParam(mockReq("http://x/api?search=%20hello%20"))).toBe("hello");
    });

    it("returns null when missing or empty", () => {
      expect(getSearchParam(mockReq("http://x/api"))).toBeNull();
      expect(getSearchParam(mockReq("http://x/api?search="))).toBeNull();
      expect(getSearchParam(mockReq("http://x/api?search=   "))).toBeNull();
    });
  });

  describe("createSearchFilter", () => {
    it("returns empty when no search", () => {
      expect(createSearchFilter(null, ["name", "email"])).toEqual({});
    });

    it("builds OR with insensitive contains", () => {
      const filter = createSearchFilter("Mar", ["firstName", "lastName"]);
      expect(filter.OR).toEqual([
        { firstName: { contains: "Mar", mode: "insensitive" } },
        { lastName: { contains: "Mar", mode: "insensitive" } },
      ]);
    });
  });

  describe("createErrorResponse", () => {
    it("returns shape with optional fields", () => {
      expect(createErrorResponse("oops")).toEqual({ error: "oops" });
      expect(createErrorResponse("oops", { x: 1 })).toEqual({
        error: "oops",
        details: { x: 1 },
      });
      expect(createErrorResponse("oops", undefined, "INTERNAL")).toEqual({
        error: "oops",
        code: "INTERNAL",
      });
    });
  });

  describe("createPaginationMeta", () => {
    it("computes totalPages and flags", () => {
      const m = createPaginationMeta(45, { page: 2, limit: 10, skip: 10 });
      expect(m.totalPages).toBe(5);
      expect(m.hasNextPage).toBe(true);
      expect(m.hasPreviousPage).toBe(true);
    });

    it("flags last page correctly", () => {
      const m = createPaginationMeta(25, { page: 3, limit: 10, skip: 20 });
      expect(m.hasNextPage).toBe(false);
      expect(m.hasPreviousPage).toBe(true);
    });
  });
});
