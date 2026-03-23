/**
 * AI Predictive Service — Statistical Algorithms
 * EMA, anomaly detection, bootstrap, K-Means.
 */

import { CONFIG } from "../types";

/**
 * Moyenne mobile pondérée exponentielle (pour lisser les tendances)
 */
export function exponentialMovingAverage(values: number[], alpha: number = 0.3): number[] {
    if (values.length === 0) return [];

    const ema: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
        ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
    }
    return ema;
}

/**
 * Détection d'anomalies par Z-score
 */
export function detectAnomalies(values: number[], threshold: number = 2): boolean[] {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return values.map(v => {
        const zScore = Math.abs((v - mean) / stdDev);
        return zScore > threshold;
    });
}

/**
 * Algorithme de clustering K-means simplifié pour grouper les élèves
 */
export function simpleKMeans(data: number[], k: number = 3): {
    clusters: number[][];
    centroids: number[];
} {
    if (data.length < k) {
        return {
            clusters: [data],
            centroids: [data.reduce((sum, v) => sum + v, 0) / data.length],
        };
    }

    // Initialisation des centroïdes (méthode k-means++)
    const centroids: number[] = [];
    centroids.push(data[Math.floor(Math.random() * data.length)]);

    while (centroids.length < k) {
        const distances = data.map(point => {
            return Math.min(...centroids.map(c => Math.pow(point - c, 2)));
        });
        const sumDistances = distances.reduce((sum, d) => sum + d, 0);
        const probabilities = distances.map(d => d / sumDistances);

        const rand = Math.random();
        let cumulativeProb = 0;
        for (let i = 0; i < data.length; i++) {
            cumulativeProb += probabilities[i];
            if (rand <= cumulativeProb) {
                centroids.push(data[i]);
                break;
            }
        }
    }

    // Itérations
    let iterations = 0;
    const maxIterations = 100;
    let converged = false;

    while (!converged && iterations < maxIterations) {
        // Assignation aux clusters
        const clusters: number[][] = Array.from({ length: k }, () => []);
        for (const point of data) {
            const distances = centroids.map(c => Math.abs(point - c));
            const closestCluster = distances.indexOf(Math.min(...distances));
            clusters[closestCluster].push(point);
        }

        // Mise à jour des centroïdes
        const newCentroids = clusters.map(cluster => {
            if (cluster.length === 0) return centroids[clusters.indexOf(cluster)];
            return cluster.reduce((sum, v) => sum + v, 0) / cluster.length;
        });

        // Vérifier la convergence
        converged = centroids.every((c, i) => Math.abs(c - newCentroids[i]) < 0.01);
        centroids.splice(0, centroids.length, ...newCentroids);
        iterations++;
    }

    // Assignation finale
    const finalClusters: number[][] = Array.from({ length: k }, () => []);
    for (const point of data) {
        const distances = centroids.map(c => Math.abs(point - c));
        const closestCluster = distances.indexOf(Math.min(...distances));
        finalClusters[closestCluster].push(point);
    }

    return { clusters: finalClusters, centroids };
}

/**
 * Calcul d'intervalle de confiance avec bootstrap (AMÉLIORÉ)
 */
export function bootstrapConfidenceInterval(
    values: number[],
    confidence: number = 0.95,
    iterations: number = 1000
): { lower: number; upper: number; standardError: number } {
    if (values.length === 0) {
        return { lower: 0, upper: 20, standardError: 10 };
    }

    const means: number[] = [];

    for (let i = 0; i < iterations; i++) {
        // Échantillonnage avec remise
        const sample: number[] = [];
        for (let j = 0; j < values.length; j++) {
            sample.push(values[Math.floor(Math.random() * values.length)]);
        }
        const mean = sample.reduce((sum, v) => sum + v, 0) / sample.length;
        means.push(mean);
    }

    means.sort((a, b) => a - b);
    const lowerIndex = Math.floor(((1 - confidence) / 2) * iterations);
    const upperIndex = Math.floor((confidence + (1 - confidence) / 2) * iterations) - 1;

    // Calcul de l'erreur standard
    const meanOfMeans = means.reduce((sum, m) => sum + m, 0) / means.length;
    const variance = means.reduce((sum, m) => sum + Math.pow(m - meanOfMeans, 2), 0) / means.length;
    const standardError = Math.sqrt(variance);

    return {
        lower: means[Math.max(0, lowerIndex)] ?? 0,
        upper: means[Math.min(means.length - 1, upperIndex)] ?? 20,
        standardError,
    };
}

// ============================================
// NORMALIZATION FUNCTIONS
// ============================================

/**
 * Normalisation Z-score
 */
export function normalizeZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
}

/**
 * Calcule moyenne et écart-type d'un tableau
 */
export function calculateStats(values: number[]): { mean: number; stdDev: number } {
    if (values.length === 0) return { mean: 0, stdDev: 0 };

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
}

/**
 * Pondération temporelle exponentielle (données récentes = plus de poids)
 */
export function applyTemporalWeights(values: number[], alpha: number = CONFIG.TEMPORAL_DECAY_ALPHA): number[] {
    const n = values.length;
    return values.map((v, i) => {
        const weight = Math.exp(-alpha * (n - 1 - i));
        return v * weight;
    });
}

/**
 * Moyenne pondérée temporellement
 */
export function temporalWeightedAverage(values: number[], alpha: number = CONFIG.TEMPORAL_DECAY_ALPHA): number {
    if (values.length === 0) return 0;

    const n = values.length;
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < n; i++) {
        const weight = Math.exp(-alpha * (n - 1 - i));
        weightedSum += values[i] * weight;
        totalWeight += weight;
    }

    return weightedSum / totalWeight;
}

/**
 * Fonction sigmoïde pour normaliser les probabilités
 */
export function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

/**
 * Évalue la qualité des données
 */
export function assessDataQuality(dataPoints: number): "LOW" | "MEDIUM" | "HIGH" {
    if (dataPoints < CONFIG.MIN_DATA_POINTS) return "LOW";
    if (dataPoints < 6) return "MEDIUM";
    return "HIGH";
}
