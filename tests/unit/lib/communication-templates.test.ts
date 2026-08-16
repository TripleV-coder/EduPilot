import { describe, it, expect } from "vitest";
import {
  DEFAULT_COMMUNICATION_TEMPLATES,
  decodeTemplateSubject,
  embedSlug,
  encodeTemplateSubject,
  extractSlug,
  stripSlugMarker,
} from "@/lib/communication/default-templates";

describe("communication default-templates", () => {
  it("expose 12 modèles de démarrage couvrant 4 catégories", () => {
    expect(DEFAULT_COMMUNICATION_TEMPLATES).toHaveLength(12);
    const cats = new Set(DEFAULT_COMMUNICATION_TEMPLATES.map((t) => t.category));
    expect(cats).toEqual(new Set(["Pédagogie", "Vie scolaire", "Finance", "Administration"]));
  });

  it("encode / décode catégorie et déclencheur dans subject", () => {
    expect(encodeTemplateSubject("Finance")).toBe("Finance");
    expect(encodeTemplateSubject("Finance", "Auto 7j")).toBe("Finance||Auto 7j");
    expect(decodeTemplateSubject("Finance||Auto 7j")).toEqual({
      category: "Finance",
      autoTrigger: "Auto 7j",
    });
    expect(decodeTemplateSubject(null).category).toBe("Administration");
  });

  it("embarque et extrait le slug sans polluer le corps affiché", () => {
    const body = "Bonjour {parent.prenom}";
    const withSlug = embedSlug(body, "fee-confirm");
    expect(extractSlug(withSlug)).toBe("fee-confirm");
    expect(stripSlugMarker(withSlug)).toBe(body);
    expect(embedSlug(withSlug, "fee-confirm")).toBe(withSlug);
  });
});
