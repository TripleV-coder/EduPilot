import { describe, it, expect } from "vitest";
import {
  canCreateRole,
  isHigherRole,
  canManageRole,
  isAllowedRole,
  getRoleName,
  getRoleDescription,
  AUTHENTICATED_DASHBOARD_ROLES,
  ADMIN_ROLES,
  SCHOOL_ADMIN_ROLES,
  GRADE_MANAGER_ROLES,
  FINANCE_MANAGER_ROLES,
  REPORT_VIEWER_ROLES,
} from "@/lib/rbac/permissions";

describe("rbac/permissions — role management", () => {
  describe("canCreateRole", () => {
    it("SUPER_ADMIN can create any role", () => {
      for (const target of [
        "SCHOOL_ADMIN",
        "DIRECTOR",
        "TEACHER",
        "STUDENT",
        "PARENT",
        "ACCOUNTANT",
        "STAFF",
      ] as const) {
        expect(canCreateRole("SUPER_ADMIN", target)).toBe(true);
      }
    });

    it("DIRECTOR cannot create SCHOOL_ADMIN", () => {
      expect(canCreateRole("DIRECTOR", "SCHOOL_ADMIN")).toBe(false);
    });

    it("STUDENT cannot create anyone", () => {
      expect(canCreateRole("STUDENT", "PARENT")).toBe(false);
      expect(canCreateRole("STUDENT", "STUDENT")).toBe(false);
    });

    it("TEACHER cannot create users", () => {
      expect(canCreateRole("TEACHER", "STUDENT")).toBe(false);
    });
  });

  describe("isHigherRole and canManageRole", () => {
    it("isHigherRole respects hierarchy", () => {
      expect(isHigherRole("SUPER_ADMIN", "SCHOOL_ADMIN")).toBe(true);
      expect(isHigherRole("DIRECTOR", "TEACHER")).toBe(true);
      expect(isHigherRole("STUDENT", "TEACHER")).toBe(false);
      expect(isHigherRole("TEACHER", "TEACHER")).toBe(false);
    });

    it("SCHOOL_ADMIN cannot manage another SCHOOL_ADMIN", () => {
      expect(canManageRole("SCHOOL_ADMIN", "SCHOOL_ADMIN")).toBe(false);
    });

    it("DIRECTOR cannot manage SUPER_ADMIN", () => {
      expect(canManageRole("DIRECTOR", "SUPER_ADMIN")).toBe(false);
    });

    it("SUPER_ADMIN can manage anyone", () => {
      expect(canManageRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
      expect(canManageRole("SUPER_ADMIN", "TEACHER")).toBe(true);
    });

    it("TEACHER cannot manage anyone", () => {
      expect(canManageRole("TEACHER", "STUDENT")).toBe(false);
    });
  });

  describe("role groups", () => {
    it("AUTHENTICATED_DASHBOARD_ROLES contains 8 roles", () => {
      expect(AUTHENTICATED_DASHBOARD_ROLES.length).toBe(8);
    });

    it("ADMIN_ROLES is SUPER_ADMIN only", () => {
      expect(ADMIN_ROLES).toEqual(["SUPER_ADMIN"]);
    });

    it("SCHOOL_ADMIN_ROLES does not include TEACHER", () => {
      expect(SCHOOL_ADMIN_ROLES).not.toContain("TEACHER");
    });

    it("GRADE_MANAGER_ROLES includes TEACHER", () => {
      expect(GRADE_MANAGER_ROLES).toContain("TEACHER");
    });

    it("FINANCE_MANAGER_ROLES includes ACCOUNTANT", () => {
      expect(FINANCE_MANAGER_ROLES).toContain("ACCOUNTANT");
    });

    it("REPORT_VIEWER_ROLES does not include TEACHER", () => {
      expect(REPORT_VIEWER_ROLES).not.toContain("TEACHER");
    });
  });

  describe("isAllowedRole", () => {
    it("returns true when role is in list", () => {
      expect(isAllowedRole("TEACHER", GRADE_MANAGER_ROLES)).toBe(true);
    });

    it("returns false otherwise", () => {
      expect(isAllowedRole("STUDENT", GRADE_MANAGER_ROLES)).toBe(false);
    });
  });

  describe("getRoleName and getRoleDescription", () => {
    it("returns French label", () => {
      expect(getRoleName("TEACHER")).toBe("Enseignant");
      expect(getRoleName("STUDENT")).toBe("Élève");
      expect(getRoleName("SUPER_ADMIN")).toBe("Super Administrateur");
    });

    it("returns description", () => {
      expect(getRoleDescription("SUPER_ADMIN")).toMatch(/Accès complet/);
      expect(getRoleDescription("TEACHER")).toMatch(/notes|cours/i);
    });
  });
});
