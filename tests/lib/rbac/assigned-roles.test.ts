import { describe, expect, it } from "vitest";
import { Permission } from "@/lib/rbac/permissions";
import {
  assignedRoles,
  hasPermission,
  roleAppliesAtSchool,
  rolesSatisfy,
} from "@/lib/rbac/permissions";

describe("assignedRoles", () => {
  it("reprend le rôle principal si roles[] est vide", () => {
    expect(assignedRoles({ role: "TEACHER", roles: [] })).toEqual(["TEACHER"]);
  });

  it("conserve le rôle principal s'il manque dans roles[]", () => {
    expect(assignedRoles({ role: "TEACHER", roles: ["ACCOUNTANT"] })).toEqual([
      "TEACHER",
      "ACCOUNTANT",
    ]);
  });

  it("ne duplique pas le rôle principal déjà listé", () => {
    expect(assignedRoles({ role: "TEACHER", roles: ["TEACHER", "ACCOUNTANT"] })).toEqual([
      "TEACHER",
      "ACCOUNTANT",
    ]);
  });
});

describe("rolesSatisfy — cumul des fonctions accordées", () => {
  it("TEACHER seul n'ouvre pas la finance", () => {
    expect(rolesSatisfy(["TEACHER"], ["ACCOUNTANT", "DIRECTOR"])).toBe(false);
    expect(hasPermission("TEACHER", Permission.FINANCE_READ)).toBe(false);
  });

  it("ACCOUNTANT seul ouvre la finance, pas la saisie de notes", () => {
    expect(rolesSatisfy(["ACCOUNTANT"], ["ACCOUNTANT", "DIRECTOR"])).toBe(true);
    expect(hasPermission(["ACCOUNTANT"], Permission.GRADE_CREATE)).toBe(false);
  });

  it("TEACHER + ACCOUNTANT ouvre les deux fonctions", () => {
    const roles = ["TEACHER", "ACCOUNTANT"];
    expect(rolesSatisfy(roles, ["ACCOUNTANT"])).toBe(true);
    expect(rolesSatisfy(roles, ["TEACHER"])).toBe(true);
    expect(hasPermission(roles, Permission.FINANCE_READ)).toBe(true);
    expect(hasPermission(roles, Permission.GRADE_CREATE)).toBe(true);
  });

  it("NETWORK_ADMIN hérite de SCHOOL_ADMIN sans devenir SUPER_ADMIN", () => {
    expect(rolesSatisfy(["NETWORK_ADMIN"], ["SCHOOL_ADMIN", "DIRECTOR"])).toBe(true);
    expect(rolesSatisfy(["NETWORK_ADMIN"], ["SUPER_ADMIN"])).toBe(false);
  });
});

describe("roleAppliesAtSchool", () => {
  const map = {
    TEACHER: ["school-a", "school-b"],
    ACCOUNTANT: ["school-a"],
  };

  it("sans carte, ne restreint pas (sessions anciennes)", () => {
    expect(roleAppliesAtSchool("ACCOUNTANT", "school-b", undefined)).toBe(true);
  });

  it("comptable : finance à l'école principale, pas au rattachement d'enseignement", () => {
    expect(roleAppliesAtSchool("ACCOUNTANT", "school-a", map)).toBe(true);
    expect(roleAppliesAtSchool("ACCOUNTANT", "school-b", map)).toBe(false);
    expect(roleAppliesAtSchool("TEACHER", "school-b", map)).toBe(true);
  });
});
