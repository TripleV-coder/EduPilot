/**
 * Types TypeScript pour Analytics Avancés
 */

export type PerformanceLevel =
  | "EXCELLENT"
  | "VERY_GOOD"
  | "GOOD"
  | "AVERAGE"
  | "INSUFFICIENT"
  | "WEAK";

export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PerformanceTrend =
  | "STRONG_INCREASE"
  | "INCREASE"
  | "STABLE"
  | "DECREASE"
  | "STRONG_DECREASE";

export interface SubjectPerformance {
  id: string;
  subjectId: string;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  average: number | null;
  gradesCount: number;
  minGrade: number | null;
  maxGrade: number | null;
  standardDev: number | null;
  isStrength: boolean;
  isWeakness: boolean;
  trend: PerformanceTrend | null;
  progressionRate: number | null;
}

export interface StudentAnalytics {
  id: string;
  studentId: string;
  periodId: string;
  academicYearId: string;
  generalAverage: number | null;
  classRank: number | null;
  classSize: number | null;
  performanceLevel: PerformanceLevel | null;
  progressionRate: number | null;
  consistencyRate: number | null;
  riskLevel: RiskLevel;
  riskFactors: string[];
  analyzedAt: string;
  subjectPerformances: SubjectPerformance[];
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export interface AttendanceSummary {
  summary: AttendanceStats;
  trend: {
    current: number;
    previous: number;
    change: number;
  };
  atRiskStudents: Array<{
    studentId: string;
    studentName: string;
    userId: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  }>;
  atRiskCount: number;
}

// Helper functions
export function getPerformanceLevelColor(level: PerformanceLevel): string {
  const colors: Record<PerformanceLevel, string> = {
    EXCELLENT: "text-green-600 bg-green-50",
    VERY_GOOD: "text-blue-600 bg-blue-50",
    GOOD: "text-cyan-600 bg-cyan-50",
    AVERAGE: "text-yellow-600 bg-yellow-50",
    INSUFFICIENT: "text-orange-600 bg-orange-50",
    WEAK: "text-red-600 bg-red-50",
  };
  return colors[level];
}

export function getPerformanceLevelLabel(level: PerformanceLevel): string {
  const labels: Record<PerformanceLevel, string> = {
    EXCELLENT: "Excellent",
    VERY_GOOD: "Très Bien",
    GOOD: "Bien",
    AVERAGE: "Moyen",
    INSUFFICIENT: "Insuffisant",
    WEAK: "Faible",
  };
  return labels[level];
}

export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    NONE: "text-green-600 bg-green-50",
    LOW: "text-blue-600 bg-blue-50",
    MEDIUM: "text-yellow-600 bg-yellow-50",
    HIGH: "text-orange-600 bg-orange-50",
    CRITICAL: "text-red-600 bg-red-50",
  };
  return colors[level];
}

export function getRiskLevelLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    NONE: "Aucun",
    LOW: "Faible",
    MEDIUM: "Modéré",
    HIGH: "Élevé",
    CRITICAL: "Critique",
  };
  return labels[level];
}
