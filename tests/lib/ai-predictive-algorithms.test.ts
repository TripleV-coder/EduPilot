import { describe, it, expect } from "vitest";
import {
  exponentialMovingAverage,
  detectAnomalies,
  simpleKMeans,
  bootstrapConfidenceInterval,
  normalizeZScore,
  calculateStats,
  applyTemporalWeights,
  temporalWeightedAverage,
  sigmoid,
  assessDataQuality,
} from "@/lib/services/ai-predictive/algorithms/statistics";
import {
  linearRegression,
  calculateR2,
  polynomialRegression,
  crossValidate,
} from "@/lib/services/ai-predictive/algorithms/regression";

describe("exponentialMovingAverage", () => {
  it("retourne un tableau vide pour une entrée vide", () => {
    expect(exponentialMovingAverage([])).toEqual([]);
  });

  it("démarre sur la première valeur et lisse les suivantes", () => {
    const ema = exponentialMovingAverage([10, 20, 30], 0.5);
    expect(ema[0]).toBe(10);
    expect(ema[1]).toBe(15); // 0.5*20 + 0.5*10
    expect(ema[2]).toBe(22.5); // 0.5*30 + 0.5*15
  });

  it("une série constante reste constante", () => {
    for (const value of exponentialMovingAverage([12, 12, 12])) {
      expect(value).toBeCloseTo(12, 10);
    }
  });
});

describe("detectAnomalies", () => {
  it("détecte un point aberrant au-delà du seuil de Z-score", () => {
    const flags = detectAnomalies([10, 10, 10, 10, 10, 10, 10, 10, 10, 100], 2);
    expect(flags[9]).toBe(true);
    expect(flags.slice(0, 9).every((f) => !f)).toBe(true);
  });

  it("ne signale rien sur une série homogène", () => {
    expect(detectAnomalies([10, 11, 10, 11, 10])).not.toContain(true);
  });
});

describe("simpleKMeans", () => {
  it("retombe sur un cluster unique si moins de points que k", () => {
    const { clusters, centroids } = simpleKMeans([4, 8], 3);
    expect(clusters).toEqual([[4, 8]]);
    expect(centroids).toEqual([6]);
  });

  it("sépare des groupes bien distincts", () => {
    const data = [1, 1.2, 0.8, 10, 10.5, 9.5, 20, 19.5, 20.5];
    const { clusters, centroids } = simpleKMeans(data, 3);

    expect(centroids).toHaveLength(3);
    // Tous les points sont assignés à exactement un cluster
    expect(clusters.flat().sort((a, b) => a - b)).toEqual([...data].sort((a, b) => a - b));
    // Les points d'un même groupe finissent ensemble
    const clusterOfOne = clusters.find((c) => c.includes(1));
    expect(clusterOfOne).toEqual(expect.arrayContaining([1.2, 0.8]));
    expect(clusterOfOne).not.toEqual(expect.arrayContaining([10]));
  });
});

describe("bootstrapConfidenceInterval", () => {
  it("retourne l'intervalle par défaut [0,20] sans données", () => {
    expect(bootstrapConfidenceInterval([])).toEqual({
      lower: 0,
      upper: 20,
      standardError: 10,
    });
  });

  it("encadre la moyenne réelle et resserre avec des données homogènes", () => {
    const values = [12, 13, 12.5, 12.8, 13.2, 12.4, 12.9, 13.1];
    const { lower, upper, standardError } = bootstrapConfidenceInterval(values, 0.95, 500);

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(lower).toBeLessThanOrEqual(mean);
    expect(upper).toBeGreaterThanOrEqual(mean);
    expect(upper - lower).toBeLessThan(2);
    expect(standardError).toBeGreaterThan(0);
    expect(standardError).toBeLessThan(1);
  });

  it("un échantillon constant donne un intervalle nul", () => {
    const { lower, upper, standardError } = bootstrapConfidenceInterval([15, 15, 15], 0.95, 100);
    expect(lower).toBe(15);
    expect(upper).toBe(15);
    expect(standardError).toBe(0);
  });
});

describe("normalizeZScore / calculateStats", () => {
  it("calcule moyenne et écart-type", () => {
    const { mean, stdDev } = calculateStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(mean).toBe(5);
    expect(stdDev).toBe(2);
  });

  it("retourne 0/0 sans données", () => {
    expect(calculateStats([])).toEqual({ mean: 0, stdDev: 0 });
  });

  it("normalise en Z-score et gère stdDev nul", () => {
    expect(normalizeZScore(9, 5, 2)).toBe(2);
    expect(normalizeZScore(9, 5, 0)).toBe(0);
  });
});

describe("pondération temporelle", () => {
  it("donne plus de poids aux valeurs récentes", () => {
    const weighted = applyTemporalWeights([10, 10, 10], 0.5);
    // La dernière valeur garde son poids plein (e^0 = 1)
    expect(weighted[2]).toBe(10);
    expect(weighted[0]).toBeLessThan(weighted[1]);
    expect(weighted[1]).toBeLessThan(weighted[2]);
  });

  it("temporalWeightedAverage tire la moyenne vers les valeurs récentes", () => {
    // Série en progression : la moyenne pondérée dépasse la moyenne simple
    const avg = temporalWeightedAverage([8, 10, 16], 0.5);
    expect(avg).toBeGreaterThan((8 + 10 + 16) / 3);
    expect(avg).toBeLessThan(16);
    expect(temporalWeightedAverage([])).toBe(0);
  });
});

describe("sigmoid / assessDataQuality", () => {
  it("sigmoid est centrée en 0 et bornée", () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(10)).toBeGreaterThan(0.99);
    expect(sigmoid(-10)).toBeLessThan(0.01);
  });

  it("évalue la qualité des données selon les seuils CONFIG", () => {
    expect(assessDataQuality(2)).toBe("LOW"); // < MIN_DATA_POINTS (3)
    expect(assessDataQuality(4)).toBe("MEDIUM");
    expect(assessDataQuality(6)).toBe("HIGH");
  });
});

describe("linearRegression", () => {
  it("retombe sur une constante avec moins de 2 points", () => {
    const model = linearRegression([{ x: 1, y: 14 }]);
    expect(model.slope).toBe(0);
    expect(model.predict(99)).toBe(14);
    expect(linearRegression([]).predict(5)).toBe(0);
  });

  it("retrouve exactement une droite parfaite", () => {
    // y = 2x + 1
    const model = linearRegression([
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ]);
    expect(model.slope).toBeCloseTo(2);
    expect(model.intercept).toBeCloseTo(1);
    expect(model.predict(4)).toBeCloseTo(9);
  });
});

describe("calculateR2", () => {
  const points = [
    { x: 1, y: 3 },
    { x: 2, y: 5 },
    { x: 3, y: 7 },
  ];

  it("vaut 1 pour des prédictions parfaites", () => {
    expect(calculateR2(points, [3, 5, 7])).toBe(1);
  });

  it("diminue avec l'erreur de prédiction", () => {
    const r2 = calculateR2(points, [3.5, 4.5, 7.5]);
    expect(r2).toBeLessThan(1);
    expect(r2).toBeGreaterThan(0);
  });

  it("gère les entrées invalides et la variance nulle", () => {
    expect(calculateR2([], [])).toBe(0);
    expect(calculateR2(points, [1, 2])).toBe(0); // tailles incohérentes
    const flat = [
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ];
    expect(calculateR2(flat, [5, 5])).toBe(1); // ssTotal=0, ssRes=0
    expect(calculateR2(flat, [4, 6])).toBe(0); // ssTotal=0, ssRes>0
  });
});

describe("polynomialRegression", () => {
  it("retombe sur la régression linéaire avec moins de 3 points", () => {
    const model = polynomialRegression([
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ]);
    expect(model.coefficients[2]).toBe(0);
    expect(model.predict(3)).toBeCloseTo(7);
  });

  it("retrouve une parabole parfaite y = x²", () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: x * x }));
    const model = polynomialRegression(points);
    expect(model.coefficients[0]).toBeCloseTo(0, 6);
    expect(model.coefficients[1]).toBeCloseTo(0, 6);
    expect(model.coefficients[2]).toBeCloseTo(1, 6);
    expect(model.predict(5)).toBeCloseTo(25, 4);
  });

  it("retombe en linéaire si la matrice est singulière (x identiques)", () => {
    const model = polynomialRegression([
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ]);
    expect(model.coefficients[2]).toBe(0);
  });
});

describe("crossValidate", () => {
  it("retourne 0 si moins de points que de folds", () => {
    expect(crossValidate([{ x: 1, y: 1 }], 5)).toBe(0);
  });

  it("score élevé sur une relation parfaitement linéaire", () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 2 * i + 1 }));
    expect(crossValidate(points, 5)).toBeGreaterThan(0.95);
  });

  it("score faible sur du bruit sans structure", () => {
    const noise = [5, -3, 8, -7, 2, 9, -4, 1, -8, 6, 0, 7, -2, 4, -6, 3, -1, 8, -5, 2];
    const points = noise.map((y, i) => ({ x: i, y }));
    expect(crossValidate(points, 5)).toBeLessThan(0.5);
  });
});
