/**
 * AI Predictive Service — Types
 * Shared interfaces for all prediction modules.
 */

export interface StudentPrediction {
    studentId: string;
    predictions: {
        failureRisk: {
            probability: number; // 0-100%
            level: "TRÈS FAIBLE" | "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" | "TRÈS ÉLEVÉ";
            factors: string[];
            recommendations: string[];
            causalFactors: CausalFactor[];
        };
        nextPeriodGrade: {
            predicted: number;
            confidence: number; // 0-100%
            range: { min: number; max: number };
            warning?: string;
            modelUsed: string;
        };
        orientationFit: {
            series: string[];
            scores: number[];
            reasoning: string;
        };
        behaviorRisk: {
            probability: number;
            nextIncidentPrediction: string;
        };
    };
    confidence: number; // Confiance globale du modèle
    dataQuality: "LOW" | "MEDIUM" | "HIGH";
    generatedAt: Date;
}

export interface CausalFactor {
    factor: string;
    weight: number;
    contribution: number;
    description: string;
}

export interface ClassPrediction {
    classId: string;
    predictions: {
        averageNextPeriod: number;
        studentsAtRisk: number;
        studentsAtRiskIds: string[];
        dropoutRisk: number;
        recommendations: string[];
    };
}

export const CONFIG = {
    MIN_DATA_POINTS: 3,
    MIN_CONFIDENCE_THRESHOLD: 40,
    TEMPORAL_DECAY_ALPHA: 0.5,
    BOOTSTRAP_ITERATIONS: 1000,
    CONFIDENCE_LEVEL: 0.95,
    RISK_WEIGHTS: {
        academicPerformance: 0.35,
        attendance: 0.25,
        behavior: 0.20,
        homework: 0.15,
        weakSubjects: 0.05,
    },
} as const;
