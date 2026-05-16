import { describe, it, expect } from "vitest";
import { formatUserRoleLabel } from "@/lib/utils/role-label";

describe("formatUserRoleLabel", () => {
  it("returns french label for known roles", () => {
    expect(formatUserRoleLabel("SUPER_ADMIN")).toBe("Super administrateur");
    expect(formatUserRoleLabel("SCHOOL_ADMIN")).toBe("Administrateur établissement");
    expect(formatUserRoleLabel("DIRECTOR")).toBe("Direction");
    expect(formatUserRoleLabel("TEACHER")).toBe("Enseignant");
    expect(formatUserRoleLabel("STUDENT")).toBe("Élève");
    expect(formatUserRoleLabel("PARENT")).toBe("Parent");
    expect(formatUserRoleLabel("ACCOUNTANT")).toBe("Comptable");
  });

  it("handles SECRETAIRE and SECRETARY synonyms", () => {
    expect(formatUserRoleLabel("SECRETARY")).toBe("Secrétaire");
    expect(formatUserRoleLabel("SECRETAIRE")).toBe("Secrétaire");
  });

  it("falls back to capitalised string for unknown role", () => {
    expect(formatUserRoleLabel("LIBRARIAN")).toBe("Librarian");
  });

  it("replaces underscores in unknown roles", () => {
    expect(formatUserRoleLabel("MEDIA_MANAGER")).toBe("Media manager");
  });

  it("defaults to Utilisateur on empty or null", () => {
    expect(formatUserRoleLabel(null)).toBe("Utilisateur");
    expect(formatUserRoleLabel(undefined)).toBe("Utilisateur");
    expect(formatUserRoleLabel("")).toBe("Utilisateur");
    expect(formatUserRoleLabel("   ")).toBe("Utilisateur");
  });
});
