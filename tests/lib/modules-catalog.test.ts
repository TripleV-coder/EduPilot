import { describe, expect, it } from "vitest";
import {
  ALL_MODULE_IDS,
  DEFAULT_ENABLED_MODULES,
  moduleForApiPath,
  moduleForPagePath,
  normalizeEnabledModules,
} from "@/lib/modules/catalog";
import { visibleNavGroups } from "@/components/edu-shell/role-nav";

describe("catalogue des modules (Lot 6)", () => {
  it("associe une route d'API à son module", () => {
    expect(moduleForApiPath("/api/health/medical-records")?.id).toBe("health");
    expect(moduleForApiPath("/api/incidents")?.id).toBe("discipline");
    expect(moduleForApiPath("/api/classes")?.id).toBe("classes");
    // Routes transverses : jamais rattachées à un module.
    expect(moduleForApiPath("/api/auth/session")).toBeNull();
    expect(moduleForApiPath("/api/schools/abc/modules")).toBeNull();
    expect(moduleForApiPath("/api/compliance/retention")).toBeNull();
    expect(moduleForApiPath("/api/health")).toBeNull();
  });

  it("associe une page à son module", () => {
    expect(moduleForPagePath("/dashboard/health/vaccinations")?.id).toBe("health");
    expect(moduleForPagePath("/dashboard/ai-assistant")?.id).toBe("ai");
    expect(moduleForPagePath("/dashboard")).toBeNull();
    expect(moduleForPagePath("/dashboard/settings/modules")).toBeNull();
  });

  it("le socle par défaut ne contient aucun module sensible", () => {
    for (const sensitive of ["health", "discipline", "ai", "access-control", "hr"]) {
      expect(DEFAULT_ENABLED_MODULES).not.toContain(sensitive);
    }
    expect(DEFAULT_ENABLED_MODULES).toContain("grades");
  });

  it("normalise : identifiants inconnus écartés, modules indispensables toujours là", () => {
    expect(normalizeEnabledModules(["grades", "inconnu"])).toEqual(
      ALL_MODULE_IDS.filter((id) => ["students", "classes", "grades"].includes(id)),
    );
    expect(normalizeEnabledModules(null)).toEqual(["students", "classes"]);
  });

  it("la navigation masque le lien d'un module éteint", () => {
    const withAi = visibleNavGroups("TEACHER", [], [...ALL_MODULE_IDS]);
    expect(withAi.flatMap((g) => g.links).some((l) => l.href === "/dashboard/ai-assistant")).toBe(true);

    const withoutAi = visibleNavGroups("TEACHER", [], ALL_MODULE_IDS.filter((m) => m !== "ai"));
    expect(withoutAi.flatMap((g) => g.links).some((l) => l.href === "/dashboard/ai-assistant")).toBe(false);
    // Les liens du socle restent.
    expect(withoutAi.flatMap((g) => g.links).some((l) => l.href === "/dashboard/attendance")).toBe(true);
  });

  it("sans liste de modules connue, rien n'est masqué (défaut sûr)", () => {
    expect(visibleNavGroups("TEACHER", [], undefined).flatMap((g) => g.links).some((l) => l.href === "/dashboard/ai-assistant")).toBe(true);
  });
});
