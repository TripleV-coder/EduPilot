import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import { templateEngine } from "@/lib/communication/templates";

describe("templateEngine.render — interpolation de variables", () => {
  it("substitue les placeholders {{clé}}", () => {
    expect(templateEngine.render("Bonjour {{name}}", { name: "Jean" })).toBe("Bonjour Jean");
  });

  it("substitue plusieurs occurrences de la même clé", () => {
    expect(templateEngine.render("{{x}}-{{x}}", { x: "A" })).toBe("A-A");
  });

  it("substitue plusieurs clés", () => {
    expect(
      templateEngine.render("{{a}} et {{b}}", { a: "1", b: "2" })
    ).toBe("1 et 2");
  });

  it("laisse les placeholders inconnus intacts", () => {
    expect(templateEngine.render("Salut {{missing}}", { name: "X" })).toBe("Salut {{missing}}");
  });

  it("retourne le contenu inchangé sans variables", () => {
    expect(templateEngine.render("Texte simple")).toBe("Texte simple");
  });
});
