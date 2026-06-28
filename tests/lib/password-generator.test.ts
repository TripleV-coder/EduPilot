import { describe, it, expect } from "vitest";
import {
  generateTempPassword,
  generateShortTempPassword,
  generateStrongPassword,
  isValidTempPasswordFormat,
  normalizeTempPassword,
  generateMatricule,
  generateEmployeeNumber,
} from "@/lib/auth/password-generator";

const CONFUSING = /[OIL01]/; // exclus pour éviter la confusion visuelle

describe("generateTempPassword", () => {
  it("respecte le format XXXX-9999", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTempPassword()).toMatch(/^[A-Z]{4}-[0-9]{4}$/);
    }
  });
  it("n'utilise jamais de caractères ambigus (O, I, L, 0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTempPassword().replace("-", "")).not.toMatch(CONFUSING);
    }
  });
  it("produit des valeurs variées", () => {
    const set = new Set(Array.from({ length: 40 }, () => generateTempPassword()));
    expect(set.size).toBeGreaterThan(35);
  });
});

describe("generateShortTempPassword", () => {
  it("respecte le format XXX999", () => {
    for (let i = 0; i < 30; i++) {
      expect(generateShortTempPassword()).toMatch(/^[A-Z]{3}[0-9]{3}$/);
    }
  });
});

describe("generateStrongPassword", () => {
  it("respecte la longueur par défaut (12) et personnalisée", () => {
    expect(generateStrongPassword()).toHaveLength(12);
    expect(generateStrongPassword(20)).toHaveLength(20);
  });
  it("contient au moins une minuscule, majuscule, chiffre et caractère spécial", () => {
    for (let i = 0; i < 30; i++) {
      const p = generateStrongPassword(12);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[!@#$%&*+=-]/);
    }
  });
});

describe("isValidTempPasswordFormat", () => {
  it("accepte XXXX-9999 et XXXX9999", () => {
    expect(isValidTempPasswordFormat("HKMP-4728")).toBe(true);
    expect(isValidTempPasswordFormat("HKMP4728")).toBe(true);
  });
  it("rejette les formats invalides", () => {
    expect(isValidTempPasswordFormat("hkmp-4728")).toBe(false); // minuscules
    expect(isValidTempPasswordFormat("HKM-4728")).toBe(false); // 3 lettres
    expect(isValidTempPasswordFormat("HKMP-472")).toBe(false); // 3 chiffres
    expect(isValidTempPasswordFormat("")).toBe(false);
  });
});

describe("normalizeTempPassword", () => {
  it("retire le tiret et met en majuscules", () => {
    expect(normalizeTempPassword("hkmp-4728")).toBe("HKMP4728");
    expect(normalizeTempPassword("HKMP4728")).toBe("HKMP4728");
  });
});

describe("generateMatricule", () => {
  it("commence par l'année courante suivie de 5 chiffres", () => {
    const year = new Date().getFullYear();
    const m = generateMatricule();
    expect(m).toMatch(new RegExp(`^${year}[0-9]{5}$`));
  });
});

describe("generateEmployeeNumber", () => {
  it("préfixe + année + 4 chiffres, préfixe par défaut E", () => {
    const year = new Date().getFullYear();
    expect(generateEmployeeNumber()).toMatch(new RegExp(`^E${year}[0-9]{4}$`));
    expect(generateEmployeeNumber("T")).toMatch(new RegExp(`^T${year}[0-9]{4}$`));
  });
});
