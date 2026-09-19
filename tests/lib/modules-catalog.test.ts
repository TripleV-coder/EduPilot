import { describe, expect, it } from "vitest";
import {
  ALL_MODULE_IDS,
  DEFAULT_ENABLED_MODULES,
  MODULES,
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
    for (const sensitive of ["health", "discipline", "ai", "access-control", "hr", "wellbeing", "benchmark", "voice-notifications"]) {
      expect(DEFAULT_ENABLED_MODULES).not.toContain(sensitive);
    }
    expect(DEFAULT_ENABLED_MODULES).toContain("grades");
  });

  it("tout ce qui n'est pas indispensable est réglable par l'école", () => {
    // Deux modules seulement sont imposés : sans élèves ni classes,
    // l'application ne fonctionne pas.
    const imposed = MODULES.filter((m) => m.required).map((m) => m.id);
    expect(imposed).toEqual(["students", "classes"]);

    // Et chaque zone fonctionnelle de l'application appartient bien à un
    // module : rien ne reste hors de portée du réglage.
    for (const [path, expected] of [
      ["/api/library/books", "library"],
      ["/api/gamification/leaderboard", "gamification"],
      ["/api/orientation/wishes", "orientation"],
      ["/api/events", "events"],
      ["/api/appointments", "appointments"],
      ["/api/certificates", "documents"],
      ["/api/wellbeing/reports", "wellbeing"],
      ["/api/benchmark", "benchmark"],
      ["/api/voice-notifs/campaigns", "voice-notifications"],
    ] as const) {
      expect(moduleForApiPath(path)?.id, path).toBe(expected);
    }
    expect(moduleForPagePath("/dashboard/clubs")?.id).toBe("events");
    expect(moduleForPagePath("/dashboard/whatsapp")?.id).toBe("voice-notifications");
    expect(moduleForPagePath("/dashboard/risks")?.id).toBe("orientation");
  });

  it("normalise : identifiants inconnus écartés, modules indispensables toujours là", () => {
    expect(normalizeEnabledModules(["grades", "inconnu"])).toEqual(
      ALL_MODULE_IDS.filter((id) => ["students", "classes", "grades"].includes(id)),
    );
    expect(normalizeEnabledModules(null)).toEqual(["students", "classes"]);
  });

  it("la navigation masque le lien d'un module éteint", () => {
    const withAi = visibleNavGroups("TEACHER", [], [...ALL_MODULE_IDS]);
    expect(withAi.flatMap((g) => g.links).some((l) => l.href === "/dashboard/ai")).toBe(true);

    const withoutAi = visibleNavGroups("TEACHER", [], ALL_MODULE_IDS.filter((m) => m !== "ai"));
    expect(withoutAi.flatMap((g) => g.links).some((l) => l.href === "/dashboard/ai")).toBe(false);
    // Les liens du socle restent.
    expect(withoutAi.flatMap((g) => g.links).some((l) => l.href === "/dashboard/attendance")).toBe(true);
  });

  it("sans liste de modules connue, rien n'est masqué (défaut sûr)", () => {
    expect(visibleNavGroups("TEACHER", [], undefined).flatMap((g) => g.links).some((l) => l.href === "/dashboard/ai")).toBe(true);
  });
});
