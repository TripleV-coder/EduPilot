import { describe, it, expect } from "vitest";
import { startsWithVowel, translateEntity, formatAction } from "@/lib/utils/entity-translator";

describe("utils/entity-translator", () => {
  describe("startsWithVowel", () => {
    it("returns true for vowels and h", () => {
      expect(startsWithVowel("élève")).toBe(true);
      expect(startsWithVowel("école")).toBe(true);
      expect(startsWithVowel("Année")).toBe(true);
      expect(startsWithVowel("histoire")).toBe(true);
    });

    it("returns false for consonants", () => {
      expect(startsWithVowel("classe")).toBe(false);
      expect(startsWithVowel("notes")).toBe(false);
    });
  });

  describe("translateEntity", () => {
    it("translates known entities", () => {
      expect(translateEntity("user")).toBe("utilisateur");
      expect(translateEntity("school")).toBe("école");
      expect(translateEntity("class")).toBe("classe");
      expect(translateEntity("grade")).toBe("note");
      expect(translateEntity("evaluation")).toBe("évaluation");
      expect(translateEntity("payment")).toBe("paiement");
      expect(translateEntity("attendance")).toBe("présence");
    });

    it("is case-insensitive and trims", () => {
      expect(translateEntity("  STUDENT  ")).toBe("élève");
      expect(translateEntity("Teacher")).toBe("enseignant");
    });

    it("falls back to original on unknown entity", () => {
      expect(translateEntity("XyzWidget")).toBe("XyzWidget");
    });
  });

  describe("formatAction", () => {
    it("formats CREATE with vowel elision", () => {
      expect(formatAction("CREATE", "evaluation")).toBe("Création d'évaluation");
      expect(formatAction("CREATE", "class")).toBe("Création de classe");
    });

    it("formats UPDATE and DELETE with vowel elision", () => {
      expect(formatAction("UPDATE", "evaluation")).toBe("Modification d'évaluation");
      expect(formatAction("DELETE", "class")).toBe("Suppression de classe");
    });

    it("returns fixed labels for login flows", () => {
      expect(formatAction("LOGIN_SUCCESS", "user")).toBe("Connexion réussie");
      expect(formatAction("LOGIN_FAILED", "user")).toBe("Tentative de connexion échouée");
      expect(formatAction("LOGIN_FAILED_LOCKED", "user")).toBe("Tentative de connexion sur compte verrouillé");
      expect(formatAction("LOGOUT", "user")).toBe("Déconnexion");
    });

    it("falls back with action and entity", () => {
      expect(formatAction("CUSTOM_ACTION", "class")).toBe("CUSTOM_ACTION - classe");
    });

    it("ATTENDANCE returns generic label", () => {
      expect(formatAction("ATTENDANCE", "anything")).toBe("Prise de présence");
    });
  });
});
