import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";
import { Permission } from "@/lib/rbac/permissions";

vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));

import {
  authorizeRoles,
  authorizePermissions,
} from "@/lib/api/api-helpers";

describe("API helpers", () => {
  /** Helper to build mock request with nextUrl for vitest */
  function mockReq(url: string) {
    const parsedUrl = new URL(url);
    return { url, nextUrl: parsedUrl } as unknown as NextRequest;
  }

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
