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

export interface StudentTemplateContext {
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
