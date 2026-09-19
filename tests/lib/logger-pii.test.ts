import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "@/lib/utils/logger";

/**
 * N56 (Lot 6) — journaux sans données personnelles. Avant : le logger écrivait
 * tel quel ce qu'on lui passait ; des appels réels y mettaient l'email de la
 * personne (mot de passe oublié, vérification d'email), un numéro de téléphone
 * (envoi de SMS) ou le texte d'une erreur Prisma citant un email.
 */
describe("N56 — le logger masque les données personnelles", () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    for (const method of ["info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const output = () => lines.join("\n");

  it("un email dans le message (le domaine reste lisible)", () => {
    new Logger().warn("Failed to send password reset email to aicha.hounsou@ecole.bj");
    expect(output()).not.toContain("aicha.hounsou");
    expect(output()).toContain("@ecole.bj");
  });

  it("emails et téléphones dans le contexte, même imbriqués", () => {
    new Logger().info("Envoi", {
      email: "koffi@ecole.bj",
      to: ["parent@mail.bj"],
      sms: { phoneNumber: "+229 97 12 34 56" },
    });
    expect(output()).not.toMatch(/koffi@|parent@|97 12 34 56|97123456/);
  });

  it("un numéro de téléphone dans le message", () => {
    new Logger().info("[SMS] Sending OTP SMS to +22997123456");
    expect(output()).not.toContain("22997123456");
  });

  it("prénom, nom et adresse dans le contexte", () => {
    new Logger().info("Élève créé", { firstName: "Aïcha", lastName: "Hounsou", address: "Akpakpa, Cotonou" });
    expect(output()).not.toMatch(/Aïcha|Hounsou|Akpakpa/);
  });

  it("mots de passe, jetons et en-têtes d'autorisation, entièrement", () => {
    new Logger().error("Échec", undefined, {
      password: "Secret!2026",
      resetToken: "abc.def.ghi",
      authorization: "Bearer xyz-123",
    });
    expect(output()).not.toMatch(/Secret!2026|abc\.def\.ghi|xyz-123/);
  });

  it("le texte d'une erreur", () => {
    new Logger().error("Échec", new Error("Unique constraint failed on email aicha@ecole.bj"));
    expect(output()).not.toContain("aicha@ecole.bj");
  });

  it("sans altérer identifiants, compteurs ni dates", () => {
    new Logger().info("Import terminé 2026-09-14", { module: "api/import", created: 12, schoolId: "ckx9v2k3l00081234abcd" });
    expect(output()).toContain("ckx9v2k3l00081234abcd");
    expect(output()).toContain('"created": 12');
    expect(output()).toContain("2026-09-14");
  });
});
