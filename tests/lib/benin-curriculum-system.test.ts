/**
 * Tests Unitaires - Système de Calcul des Moyennes
 * 
 * Valide:
 * - Validation des coefficients
 * - Calcul des moyennes pondérées
 * - Gestion des absences
 * - Précision décimale
 * - Gestion d'erreurs
 */

import { describe, it, expect } from "vitest";
import {
  validateCoefficient,
  validateGrade,
  calculateWeightedAverage,
  calculateGeneralAverage,
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

// ============================================
// TESTS: Calcul de Moyenne Pondérée
// ============================================

describe("calculateWeightedAverage", () => {
  it("devrait calculer une moyenne simple", () => {
    const grades = [
      { value: 14, coefficient: 1 },
      { value: 16, coefficient: 1 },
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(15);
    expect(result.totalCoefficients).toBe(2);
  });

  it("devrait calculer une moyenne pondérée", () => {
    const grades = [
      { value: 14, coefficient: 2 },
      { value: 16, coefficient: 1 },
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(14.67); // (14*2 + 16*1) / 3 = 44/3 = 14.67
    expect(result.totalCoefficients).toBe(3);
  });

  it("devrait ignorer les notes nulles (absences)", () => {
    const grades = [
      { value: 14, coefficient: 1 },
      { value: null, coefficient: 1 }, // Absent
      { value: 16, coefficient: 1 },
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(15); // (14 + 16) / 2 = 15
    expect(result.totalCoefficients).toBe(2);
  });

  it("devrait arrondir à 2 décimales", () => {
    const grades = [
      { value: 10, coefficient: 1 },
      { value: 11, coefficient: 1 },
      { value: 13, coefficient: 1 },
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(11.33); // (10 + 11 + 13) / 3 = 11.333... -> 11.33
  });

  it("devrait accepter des coefficients décimaux", () => {
    const grades = [
      { value: 14, coefficient: 1 },
      { value: 16, coefficient: 1.5 },
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(15.2); // (14*1 + 16*1.5) / 2.5 = 38/2.5 = 15.2
  });

  it("devrait retourner erreur si pas de notes évaluées", () => {
    const grades = [{ value: null, coefficient: 1 }];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(true);
    expect(result.error).toContain("Aucune note");
    expect(result.average).toBeNull();
  });

  it("devrait retourner erreur si tableau vide", () => {
    const result = calculateWeightedAverage([]);

    expect(result.hasError).toBe(true);
    expect(result.average).toBeNull();
  });

  it("devrait retourner erreur si coefficient invalide", () => {
    const grades = [
      { value: 14, coefficient: 0 }, // Invalide
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(true);
    expect(result.error).toContain("doit être > 0");
  });

  it("devrait gérer les décimales correctement", () => {
    const grades = [
      { value: 14.5, coefficient: 2 },
      { value: 15.25, coefficient: 2 },
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(14.88); // (14.5*2 + 15.25*2) / 4 = 119.5/4 = 29.875 -> 14.875 (arrondi à 14.88)
    expect(result.totalCoefficients).toBe(4);
  });

  it("devrait valider les coefficients individuels", () => {
    const grades = [
      { value: 14, coefficient: -1 }, // Invalide
    ];
    const result = calculateWeightedAverage(grades);

    expect(result.hasError).toBe(true);
  });
});

// ============================================
// TESTS: Calcul de Moyenne Générale
// ============================================

describe("calculateGeneralAverage", () => {
  it("devrait calculer une moyenne générale simple", () => {
    const subjects = [
      { subjectId: "1", subjectName: "Français", average: 15, coefficient: 1, isEvaluated: true },
      { subjectId: "2", subjectName: "Math", average: 14, coefficient: 1, isEvaluated: true },
    ];
    const result = calculateGeneralAverage(subjects);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(14.5);
  });

  it("devrait ignorer les sujets non évalués", () => {
    const subjects = [
      { subjectId: "1", subjectName: "Français", average: 15, coefficient: 3, isEvaluated: true },
      { subjectId: "2", subjectName: "Math", average: 14, coefficient: 3, isEvaluated: true },
      { subjectId: "3", subjectName: "Géo", average: null, coefficient: 2, isEvaluated: false },
    ];
    const result = calculateGeneralAverage(subjects);

    expect(result.hasError).toBe(false);
    expect(result.average).toBe(14.5); // (15*3 + 14*3) / 6 = 87/6 = 14.5
    expect(result.totalCoefficients).toBe(6);
  });

  it("devrait calculer avec coefficients variables", () => {
    const subjects = [
      { subjectId: "1", subjectName: "Français", average: 14, coefficient: 4, isEvaluated: true },
      { subjectId: "2", subjectName: "Math", average: 16, coefficient: 4, isEvaluated: true },
      { subjectId: "3", subjectName: "Histoire", average: 12, coefficient: 2, isEvaluated: true },
    ];
    const result = calculateGeneralAverage(subjects);

    expect(result.hasError).toBe(false);
    // (14*4 + 16*4 + 12*2) / 10 = 144 / 10 = 14.4
    expect(result.average).toBe(14.4);
  });

  it("devrait retourner erreur si aucun sujet évalué", () => {
    const subjects = [
      { subjectId: "1", subjectName: "Français", average: null, coefficient: 3, isEvaluated: false },
    ];
    const result = calculateGeneralAverage(subjects);

    expect(result.hasError).toBe(true);
    expect(result.average).toBeNull();
  });

  it("devrait retourner erreur si tableau vide", () => {
    const result = calculateGeneralAverage([]);

    expect(result.hasError).toBe(true);
  });

  it("devrait arrondir à 2 décimales", () => {
    const subjects = [
      { subjectId: "1", subjectName: "Français", average: 14.5, coefficient: 1, isEvaluated: true },
      { subjectId: "2", subjectName: "Math", average: 15.25, coefficient: 1, isEvaluated: true },
      { subjectId: "3", subjectName: "Histoire", average: 13, coefficient: 1, isEvaluated: true },
    ];
    const result = calculateGeneralAverage(subjects);

    expect(result.hasError).toBe(false);
    // (14.5 + 15.25 + 13) / 3 = 42.75 / 3 = 14.25
    expect(result.average).toBe(14.25);
  });
});

// ============================================
// TESTS: Cas Réels
// ============================================

describe("Cas Réels - Scénario d'Évaluation", () => {
  it("scénario: 3 évaluations pour Français avec absences", () => {
    const frenchGrades = [
      { value: 14, coefficient: 1 },    // Composition 1
      { value: 15, coefficient: 1 },    // Composition 2
      { value: null, coefficient: 0.5 }, // Interrogation (absent)
      { value: 13, coefficient: 0.5 },   // Présentation
    ];

    const result = calculateWeightedAverage(frenchGrades);

    expect(result.hasError).toBe(false);
    // (14*1 + 15*1 + 13*0.5) / (1 + 1 + 0.5) = 35.5 / 2.5 = 14.2
    expect(result.average).toBe(14.2);
  });

  it("scénario: bulletin complet d'élève", () => {
    const subjects = [
      { subjectId: "1", subjectName: "Français", average: 14.5, coefficient: 3, isEvaluated: true },
      { subjectId: "2", subjectName: "Mathématiques", average: 13.2, coefficient: 3, isEvaluated: true },
      { subjectId: "3", subjectName: "Histoire", average: 15, coefficient: 2, isEvaluated: true },
      { subjectId: "4", subjectName: "Géographie", average: 12.8, coefficient: 2, isEvaluated: true },
      { subjectId: "5", subjectName: "Sciences", average: 14, coefficient: 2, isEvaluated: true },
      { subjectId: "6", subjectName: "EPS", average: 16, coefficient: 1, isEvaluated: true },
    ];

    const result = calculateGeneralAverage(subjects);

    expect(result.hasError).toBe(false);
    // (14.5*3 + 13.2*3 + 15*2 + 12.8*2 + 14*2 + 16*1) / 13
    // = (43.5 + 39.6 + 30 + 25.6 + 28 + 16) / 13
    // = 182.7 / 13 = 14.05
    expect(result.average).toBe(14.05);
    expect(result.totalCoefficients).toBe(13);
  });

  it("scénario: élève avec un sujet non évalué", () => {
    const subjects = [
      { subjectId: "1", subjectName: "Français", average: 16, coefficient: 4, isEvaluated: true },
      { subjectId: "2", subjectName: "Mathématiques", average: 14, coefficient: 4, isEvaluated: true },
      { subjectId: "3", subjectName: "Anglais", average: null, coefficient: 2, isEvaluated: false }, // Non évalué
    ];

    const result = calculateGeneralAverage(subjects);

    expect(result.hasError).toBe(false);
    // (16*4 + 14*4) / 8 = 120 / 8 = 15
    expect(result.average).toBe(15);
    expect(result.totalCoefficients).toBe(8);
  });
});
