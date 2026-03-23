import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canManageRole,
  isHigherRole,
  getRolePermissions,
  roleHierarchy,
  Permission,
  rolePermissions,
} from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";

describe("RBAC permissions", () => {
  describe("hasPermission", () => {
    it("SUPER_ADMIN has SCHOOL_CREATE", () => {
      expect(hasPermission("SUPER_ADMIN", Permission.SCHOOL_CREATE)).toBe(true);
    });

    it("TEACHER does not have SCHOOL_CREATE", () => {
      expect(hasPermission("TEACHER", Permission.SCHOOL_CREATE)).toBe(false);
    });

    it("TEACHER has GRADE_CREATE", () => {
      expect(hasPermission("TEACHER", Permission.GRADE_CREATE)).toBe(true);
    });

    it("STUDENT has GRADE_READ_OWN", () => {
      expect(hasPermission("STUDENT", Permission.GRADE_READ_OWN)).toBe(true);
    });

    it("STUDENT does not have GRADE_DELETE", () => {
      expect(hasPermission("STUDENT", Permission.GRADE_DELETE)).toBe(false);
    });

    it("unknown role returns false", () => {
      expect(hasPermission("UNKNOWN" as UserRole, Permission.SCHOOL_READ)).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("returns true if user has at least one permission", () => {
      expect(
        hasAnyPermission("TEACHER", [Permission.SCHOOL_CREATE, Permission.GRADE_READ])
      ).toBe(true);
    });

    it("returns false if user has none", () => {
      expect(
        hasAnyPermission("STUDENT", [Permission.SCHOOL_CREATE, Permission.USER_DELETE])
      ).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("returns true only when user has all permissions", () => {
      expect(
        hasAllPermissions("SCHOOL_ADMIN", [
          Permission.STUDENT_READ,
          Permission.CLASS_READ,
        ])
      ).toBe(true);
    });

    it("returns false if missing one", () => {
      expect(
        hasAllPermissions("TEACHER", [
          Permission.GRADE_READ,
          Permission.SCHOOL_CREATE,
        ])
      ).toBe(false);
    });
  });

  describe("canManageRole", () => {
    it("SUPER_ADMIN can manage any role", () => {
      expect(canManageRole("SUPER_ADMIN", "SCHOOL_ADMIN")).toBe(true);
      expect(canManageRole("SUPER_ADMIN", "TEACHER")).toBe(true);
    });

    it("SCHOOL_ADMIN cannot manage SUPER_ADMIN", () => {
      expect(canManageRole("SCHOOL_ADMIN", "SUPER_ADMIN")).toBe(false);
    });

    it("SCHOOL_ADMIN can manage TEACHER", () => {
      expect(canManageRole("SCHOOL_ADMIN", "TEACHER")).toBe(true);
    });

    it("TEACHER cannot manage anyone", () => {
      expect(canManageRole("TEACHER", "STUDENT")).toBe(false);
    });
  });

  describe("isHigherRole", () => {
    it("SUPER_ADMIN is higher than all", () => {
      expect(isHigherRole("SUPER_ADMIN", "SCHOOL_ADMIN")).toBe(true);
      expect(isHigherRole("SUPER_ADMIN", "TEACHER")).toBe(true);
    });

    it("TEACHER is higher than STUDENT", () => {
      expect(isHigherRole("TEACHER", "STUDENT")).toBe(true);
    });

    it("STUDENT is not higher than TEACHER", () => {
      expect(isHigherRole("STUDENT", "TEACHER")).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("returns non-empty array for known roles", () => {
      const perms = getRolePermissions("SUPER_ADMIN");
      expect(Array.isArray(perms)).toBe(true);
      expect(perms.length).toBeGreaterThan(0);
      expect(perms).toContain(Permission.SCHOOL_CREATE);
    });

    it("returns empty array for unknown role", () => {
      expect(getRolePermissions("UNKNOWN" as UserRole)).toEqual([]);
    });
  });

  describe("roleHierarchy", () => {
    it("SUPER_ADMIN has highest value", () => {
      const values = Object.values(roleHierarchy);
      expect(roleHierarchy.SUPER_ADMIN).toBe(Math.max(...values));
    });

    it("STUDENT has lowest value", () => {
      const values = Object.values(roleHierarchy);
      expect(roleHierarchy.STUDENT).toBe(Math.min(...values));
    });
  });

  describe("rolePermissions coverage", () => {
    it("all 7 roles have permissions defined", () => {
      const roles: UserRole[] = [
        "SUPER_ADMIN",
        "SCHOOL_ADMIN",
        "DIRECTOR",
        "TEACHER",
        "STUDENT",
        "PARENT",
        "ACCOUNTANT",
      ];
      roles.forEach((role) => {
        expect(rolePermissions[role]).toBeDefined();
        expect(Array.isArray(rolePermissions[role])).toBe(true);
      });
    });
  });
});
