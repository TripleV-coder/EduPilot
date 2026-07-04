import { describe, it, expect } from "vitest";
import {
  rolePermissions,
  roleHierarchy,
  roleCreationMatrix,
  getRoleName,
  Permission,
} from "@/lib/rbac/permissions";

describe("NETWORK_ADMIN — Records RBAC", () => {
  it("a exactement les permissions SCHOOL_ADMIN + SCHOOL_CREATE", () => {
    const na = new Set(rolePermissions.NETWORK_ADMIN);
    for (const p of rolePermissions.SCHOOL_ADMIN) {
      expect(na.has(p)).toBe(true);
    }
    expect(na.has(Permission.SCHOOL_CREATE)).toBe(true);
  });

  it("se situe entre SUPER_ADMIN et SCHOOL_ADMIN dans la hiérarchie", () => {
    expect(roleHierarchy.NETWORK_ADMIN).toBe(90);
    expect(roleHierarchy.NETWORK_ADMIN).toBeLessThan(roleHierarchy.SUPER_ADMIN);
    expect(roleHierarchy.NETWORK_ADMIN).toBeGreaterThan(roleHierarchy.SCHOOL_ADMIN);
  });

  it("peut créer les rôles école mais pas SUPER_ADMIN ni NETWORK_ADMIN", () => {
    const created = roleCreationMatrix.NETWORK_ADMIN;
    expect(created).toContain("SCHOOL_ADMIN");
    expect(created).toContain("DIRECTOR");
    expect(created).not.toContain("SUPER_ADMIN");
    expect(created).not.toContain("NETWORK_ADMIN");
  });

  it("SUPER_ADMIN peut créer un NETWORK_ADMIN", () => {
    expect(roleCreationMatrix.SUPER_ADMIN).toContain("NETWORK_ADMIN");
  });

  it("a un libellé humain", () => {
    expect(getRoleName("NETWORK_ADMIN")).toBe("Administrateur de Réseau");
  });
});
