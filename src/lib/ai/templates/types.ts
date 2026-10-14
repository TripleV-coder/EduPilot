/**
 * Contexte élève alimentant les générateurs par gabarits (couche 2).
 * Aucune PII sensible requise — prénom optionnel pour personnalisation légère.
 */

export interface SubjectPerformanceContext {
  subjectName: string;
  average: number | null;
  trend?: string | null;
  isStrength?: boolean;
  isWeakness?: boolean;
}

/**
 * Seuils de lecture des gabarits, réglés par l'école (règles + paramètres de
 * l'établissement). Absents : valeurs par défaut (comportement d'origine).
 */
export interface TemplateThresholds {
  passingGrade: number;
  excellentFrom: number;
  veryGoodFrom: number;
  goodFrom: number;
  attendanceWarning: number;
  attendanceWindowDays: number;
  incidentsWarning: number;
  weakSubjectsAlert: number;
  levelVeryHigh: number;
  levelHigh: number;
  levelModerate: number;
}

export const DEFAULT_TEMPLATE_THRESHOLDS: TemplateThresholds = {
  passingGrade: 10,
  excellentFrom: 16,
  veryGoodFrom: 14,
  goodFrom: 12,
  attendanceWarning: 85,
  attendanceWindowDays: 90,
  incidentsWarning: 3,
  weakSubjectsAlert: 3,
  levelVeryHigh: 75,
  levelHigh: 55,
  levelModerate: 35,
};

export interface StudentTemplateContext {
  thresholds?: TemplateThresholds;
  firstName?: string | null;
  lastName?: string | null;
  className?: string | null;
  periodName?: string | null;
  generalAverage?: number | null;
  progressionRate?: number | null;
  performanceLevel?: string | null;
  riskLevel?: string | null;
  riskFactors?: string[];
  attendanceRate?: number | null;
  classRank?: number | null;
  classSize?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  subjectPerformances?: SubjectPerformanceContext[];
  failureProbability?: number;
  failureLevel?: string;
  failureRecommendations?: string[];
  incidentCount?: number;
}

export interface OrientationTemplateResult {
  series: string;
  /** Adéquation 0-100 de la série recommandée (référentiel des séries). */
  score: number;
  justification: string;
  alternatives: string[];
  synthesis: string;
}

export interface RiskSummaryResult {
  summary: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
  suggestedActions: Array<{
    title: string;
    description: string;
    type: "Pédagogique" | "Suivi" | "Orientation";
  }>;
}

export interface ActionPlanTemplate {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  steps: string[];
  suggestedBy: string;
}

export interface TemplateAlert {
  id: string;
  type: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  targetRoles: string[];
  actionRequired: boolean;
}
