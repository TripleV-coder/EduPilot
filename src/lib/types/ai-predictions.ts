/**
 * Types TypeScript pour le module IA Prédictive
 * Synchronisés avec le backend (src/lib/services/ai-predictive.ts)
 */

export type RiskLevel = "TRÈS FAIBLE" | "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" | "TRÈS ÉLEVÉ";

export type PerformanceTrend =
  | "STRONG_INCREASE"
  | "INCREASE"
  | "STABLE"
  | "DECREASE"
  | "STRONG_DECREASE";

export interface FailureRisk {
  probability: number; // 0-100%
  level: RiskLevel;
  factors: string[];
  recommendations: string[];
}

export interface NextPeriodGrade {
  predicted: number;
  confidence: number; // 0-100%
  range: {
    min: number;
    max: number;
  };
}

export interface OrientationFit {
  series: string[];
  scores: number[];
  reasoning: string;
}

export interface BehaviorRisk {
  probability: number;
  nextIncidentPrediction: string;
}

export interface StudentPrediction {
  studentId: string;
  predictions: {
    failureRisk: FailureRisk;
    nextPeriodGrade: NextPeriodGrade;
    orientationFit: OrientationFit;
    behaviorRisk: BehaviorRisk;
  };
  confidence: number; // Confiance globale du modèle
  generatedAt: string; // ISO datetime
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

// Helper type guards
export function isHighRisk(level: RiskLevel): boolean {
  return level === "ÉLEVÉ" || level === "TRÈS ÉLEVÉ";
}

export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    "TRÈS FAIBLE": "text-green-600 bg-green-50 border-green-200",
    "FAIBLE": "text-blue-600 bg-blue-50 border-blue-200",
    "MODÉRÉ": "text-yellow-600 bg-yellow-50 border-yellow-200",
    "ÉLEVÉ": "text-orange-600 bg-orange-50 border-orange-200",
    "TRÈS ÉLEVÉ": "text-red-600 bg-red-50 border-red-200",
  };
  return colors[level];
}

export function getRiskIcon(level: RiskLevel): string {
  const icons: Record<RiskLevel, string> = {
    "TRÈS FAIBLE": "✓",
    "FAIBLE": "◐",
    "MODÉRÉ": "◑",
    "ÉLEVÉ": "⚠",
    "TRÈS ÉLEVÉ": "⚠",
  };
  return icons[level];
}

export function getTrendColor(trend: PerformanceTrend): string {
  const colors: Record<PerformanceTrend, string> = {
    STRONG_INCREASE: "text-green-600",
    INCREASE: "text-green-500",
    STABLE: "text-gray-500",
    DECREASE: "text-orange-500",
    STRONG_DECREASE: "text-red-600",
  };
  return colors[trend];
}

export function getTrendLabel(trend: PerformanceTrend): string {
  const labels: Record<PerformanceTrend, string> = {
    STRONG_INCREASE: "Forte progression",
    INCREASE: "Progression",
    STABLE: "Stable",
    DECREASE: "Régression",
    STRONG_DECREASE: "Forte régression",
  };
  return labels[trend];
}
