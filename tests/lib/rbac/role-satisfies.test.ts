import { describe, it, expect } from "vitest";
import { roleSatisfies } from "@/lib/rbac/permissions";

describe("roleSatisfies", () => {
  it("match direct : le rôle est dans la liste", () => {
    expect(roleSatisfies("SCHOOL_ADMIN", ["SCHOOL_ADMIN", "DIRECTOR"])).toBe(true);
  });

  it("NETWORK_ADMIN hérite des autorisations SCHOOL_ADMIN", () => {
    expect(roleSatisfies("NETWORK_ADMIN", ["SCHOOL_ADMIN", "DIRECTOR"])).toBe(true);
  });

  it("NETWORK_ADMIN passe aussi s'il est listé explicitement", () => {
    expect(roleSatisfies("NETWORK_ADMIN", ["NETWORK_ADMIN"])).toBe(true);
  });

  it("NETWORK_ADMIN n'escalade JAMAIS vers un écran SUPER_ADMIN seul", () => {
    expect(roleSatisfies("NETWORK_ADMIN", ["SUPER_ADMIN"])).toBe(false);
  });

  it("un rôle non listé est refusé", () => {
    expect(roleSatisfies("TEACHER", ["SCHOOL_ADMIN"])).toBe(false);
  });

  it("role absent (undefined/null) est refusé", () => {
    expect(roleSatisfies(undefined, ["SCHOOL_ADMIN"])).toBe(false);
    expect(roleSatisfies(null, ["SCHOOL_ADMIN"])).toBe(false);
  });

  it("SCHOOL_ADMIN ne gagne PAS les droits NETWORK_ADMIN (pas de sens inverse)", () => {
    expect(roleSatisfies("SCHOOL_ADMIN", ["NETWORK_ADMIN"])).toBe(false);
  });
});
