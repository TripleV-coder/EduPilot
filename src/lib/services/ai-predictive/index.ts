/**
 * AI Predictive Service — Barrel Export
 *
 * This module re-exports all prediction functions and types
 * for backward compatibility with existing imports.
 *
 * Module structure:
 * ├── types.ts                    — Interfaces + CONFIG
 * ├── algorithms/
 * │   ├── regression.ts           — Linear, polynomial, R², cross-validation
 * │   └── statistics.ts           — EMA, anomalies, K-means, bootstrap, normalization
 * ├── predict-failure.ts          — predictFailureRisk
 * ├── predict-grade.ts            — predictNextPeriodGrade
 * ├── predict-behavior.ts         — predictBehaviorRisk
 * └── predict-student.ts          — generateStudentPredictions, generateClassPredictions
 */

// Types
export type { StudentPrediction, ClassPrediction, CausalFactor } from "./types";
export { CONFIG } from "./types";

// Algorithms
export {
    linearRegression,
    calculateR2,
    polynomialRegression,
    crossValidate,
} from "./algorithms/regression";

export {
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
} from "./algorithms/statistics";

// Predictions
export { predictFailureRisk } from "./predict-failure";
export { predictNextPeriodGrade } from "./predict-grade";
export { predictBehaviorRisk } from "./predict-behavior";
export { generateStudentPredictions, generateClassPredictions } from "./predict-student";
