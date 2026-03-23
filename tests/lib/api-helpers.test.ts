import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { Permission } from "@/lib/rbac/permissions";

vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));

import {
  getPaginationParams,
  createPaginatedResponse,
  authorizeRoles,
  authorizePermissions,
} from "@/lib/api/api-helpers";

describe("API helpers", () => {
  /** Helper to build mock request with nextUrl for vitest */
  function mockReq(url: string) {
    const parsedUrl = new URL(url);
    return { url, nextUrl: parsedUrl } as any;
  }

  describe("getPaginationParams", () => {
    it("defaults to page 1 and limit 20", () => {
      const req = mockReq("http://localhost/api/foo");
      const { page, limit, skip } = getPaginationParams(req);
      expect(page).toBe(1);
      expect(limit).toBe(20);
      expect(skip).toBe(0);
    });

    it("reads page and limit from query", () => {
      const req = mockReq("http://localhost/api/foo?page=3&limit=10");
      const { page, limit, skip } = getPaginationParams(req);
      expect(page).toBe(3);
      expect(limit).toBe(10);
      expect(skip).toBe(20);
    });

    it("respects maxLimit", () => {
      const req = mockReq("http://localhost/api/foo?limit=500");
      const { limit } = getPaginationParams(req, { maxLimit: 100 });
      expect(limit).toBe(100);
    });

    it("uses defaultLimit option", () => {
      const req = mockReq("http://localhost/api/foo");
      const { limit } = getPaginationParams(req, { defaultLimit: 50 });
      expect(limit).toBe(50);
    });
  });

  describe("createPaginatedResponse", () => {
    it("returns data and pagination object", async () => {
      const res = createPaginatedResponse([{ id: "1" }, { id: "2" }], 1, 10, 25);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it("hasNextPage false on last page", async () => {
      const res = createPaginatedResponse([], 3, 10, 25);
      const body = await res.json();
      expect(body.pagination.hasNextPage).toBe(false);
      expect(body.pagination.hasPreviousPage).toBe(true);
    });
  });

  describe("authorizeRoles", () => {
    it("authorized when role in allowedRoles", () => {
      const result = authorizeRoles("TEACHER", ["TEACHER", "SCHOOL_ADMIN"]);
      expect(result.authorized).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it("unauthorized when role not in allowedRoles", () => {
      const result = authorizeRoles("STUDENT", ["TEACHER", "SCHOOL_ADMIN"]);
      expect(result.authorized).toBe(false);
      expect(result.response).toBeDefined();
      expect(result.response!.status).toBe(403);
    });
  });

  describe("authorizePermissions", () => {
    it("authorized when user has all required permissions", () => {
      const result = authorizePermissions("TEACHER", [
        Permission.GRADE_READ,
        Permission.GRADE_UPDATE,
      ]);
      expect(result.authorized).toBe(true);
    });

    it("unauthorized when missing one permission", () => {
      const result = authorizePermissions("TEACHER", [
        Permission.GRADE_READ,
        Permission.SCHOOL_DELETE,
      ]);
      expect(result.authorized).toBe(false);
      expect(result.response!.status).toBe(403);
    });
  });
});
