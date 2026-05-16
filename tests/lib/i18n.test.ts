import { describe, it, expect } from "vitest";
import { t } from "@/lib/i18n";

describe("i18n.t", () => {
  it("resolves nested key", () => {
    expect(t("api.issues.unauthorized")).toBe("Non authentifié");
    expect(t("api.issues.forbidden")).toBe("Accès refusé");
  });

  it("returns the key when path not found", () => {
    expect(t("does.not.exist")).toBe("does.not.exist");
    expect(t("api.issues.xyz")).toBe("api.issues.xyz");
  });

  it("interpolates {variables}", () => {
    expect(t("api.issues.not_found", { entity: "Élève" })).toBe("Élève non trouvé(e).");
    expect(t("api.issues.already_exists", { entity: "Classe" })).toBe(
      "Classe existe déjà dans le système."
    );
  });

  it("interpolates multiple variables", () => {
    const msg = t("api.issues.quota_exceeded", { resource: "élèves", limit: 100 });
    expect(msg).toContain("élèves");
    expect(msg).toContain("100");
  });

  it("returns nested object when path stops at object", () => {
    const node = t("api.issues");
    expect(typeof node).toBe("object");
    expect(node.unauthorized).toBe("Non authentifié");
  });
});
