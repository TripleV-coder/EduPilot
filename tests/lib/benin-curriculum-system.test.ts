/**
 * Tests unitaires — validations de saisie (coefficients, notes).
 * Les moyennes sont testées avec le moteur unique (tests/lib/academic/average-engine.test.ts).
 */

import { describe, it, expect } from "vitest";
import {
  validateCoefficient,
  validateGrade,
} from "@/lib/benin-curriculum-system";

// ============================================
// TESTS: Validation des Coefficients
// ============================================

describe("validateCoefficient", () => {
  it("devrait accepter un coefficient entier", () => {
    const result = validateCoefficient(3);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("devrait accepter un coefficient décimal", () => {
    const result = validateCoefficient(2.5);
    expect(result.valid).toBe(true);
  });

  it("devrait accepter un coefficient minimal", () => {
    const result = validateCoefficient(0.01);
    expect(result.valid).toBe(true);
  });

  it("devrait rejeter un coefficient de zéro", () => {
    const result = validateCoefficient(0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("doit être > 0");
  });

  it("devrait rejeter un coefficient négatif", () => {
    const result = validateCoefficient(-1);
    expect(result.valid).toBe(false);
  });

  it("devrait rejeter un coefficient null", () => {
    const result = validateCoefficient(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("ne peut pas être vide");
  });

  it("devrait rejeter un coefficient non-numérique", () => {
    const result = validateCoefficient("abc");
    expect(result.valid).toBe(false);
  });

  it("devrait rejeter trop de décimales", () => {
    const result = validateCoefficient(3.256);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("2 décimales");
  });

  it("devrait accepter exactement 2 décimales", () => {
    const result = validateCoefficient(3.25);
    expect(result.valid).toBe(true);
  });

  it("devrait rejeter un coefficient trop élevé", () => {
    const result = validateCoefficient(1001);
    expect(result.valid).toBe(false);
  });
});

// ============================================
// TESTS: Validation des Notes
// ============================================

describe("validateGrade", () => {
  it("devrait accepter une note valide", () => {
    const result = validateGrade(15);
    expect(result.valid).toBe(true);
  });

  it("devrait accepter une note de 0", () => {
    const result = validateGrade(0);
    expect(result.valid).toBe(true);
  });

  it("devrait accepter une note null (absence)", () => {
    const result = validateGrade(null);
    expect(result.valid).toBe(true);
  });

  it("devrait rejeter une note négative", () => {
    const result = validateGrade(-1);
    expect(result.valid).toBe(false);
  });

  it("devrait rejeter une note supérieure au maximum", () => {
    const result = validateGrade(21, 20);
    expect(result.valid).toBe(false);
  });

  it("devrait accepter une note égale au maximum", () => {
    const result = validateGrade(20, 20);
    expect(result.valid).toBe(true);
  });

  it("devrait rejeter une note non-numérique", () => {
    const result = validateGrade("abc");
    expect(result.valid).toBe(false);
  });
});
