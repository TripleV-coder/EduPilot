/**
 * AI Predictive Service — Types
 * Shared interfaces for all prediction modules.
 */

export interface ActionPlan {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    steps: string[];
    suggestedBy: string;
}

export type RiskLevel = "TRÈS FAIBLE" | "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" | "TRÈS ÉLEVÉ";
export type DataQuality = "LOW" | "MEDIUM" | "HIGH";

/**
 * Risque de décrochage — trajectoire de désengagement (distincte du niveau de notes).
 */
export interface DropoutSignal {
    factor: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    contribution: number; // 0-100, part du signal dans le score
    description: string;
}

export interface DropoutRisk {
    probability: number; // 0-100%
    level: RiskLevel;
    signals: DropoutSignal[];
    recommendations: string[];
    confidence: number; // 0-100%
    dataQuality: DataQuality;
}

/**
 * Alerte précoce — signal aigu ponctuel (déclencheur), pas une tendance lente.
 */
export type EarlyWarningType =
    | "GRADE_DROP"
    | "ATTENDANCE_CLIFF"
    | "HOMEWORK_STOP"
    | "BEHAVIOR_SPIKE";

export interface EarlyWarning {
    type: EarlyWarningType;
    severity: "WARNING" | "CRITICAL";
    value: number; // valeur mesurée déclenchant l'alerte (chute en pts, nb absences…)
    message: string;
    since: Date | null; // date approximative du début du signal
}

/**
 * Risque comportemental — enrichi (aligné sur le modèle d'échec).
 */
export interface BehaviorRisk {
    probability: number;
    nextIncidentPrediction: string;
    causalFactors: CausalFactor[];
    recommendations: string[];
    confidence: number;
    dataQuality: DataQuality;
}

export interface StudentPrediction {
    studentId: string;
    predictions: {
        failureRisk: {
            probability: number; // 0-100%
            level: RiskLevel;
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
        behaviorRisk: BehaviorRisk;
        dropoutRisk: DropoutRisk;
        earlyWarnings: EarlyWarning[];
    };
    recommendedActions?: ActionPlan[];
    confidence: number; // Confiance globale du modèle
    dataQuality: DataQuality;
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
        dropoutRisk: number; // moyenne du vrai modèle de décrochage (0-100)
        studentsWithWarnings: number; // élèves avec ≥1 alerte précoce active
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
