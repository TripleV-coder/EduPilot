/**
 * Construction du contexte gabarit à partir de données analytiques réelles.
 */

import type { StudentTemplateContext } from "./types";

type AnalyticsLike = {
  generalAverage?: unknown;
  progressionRate?: unknown;
  performanceLevel?: string | null;
  riskLevel?: string | null;
  riskFactors?: string[] | null;
  classRank?: number | null;
  classSize?: number | null;
  period?: { name?: string | null } | null;
  subjectPerformances?: Array<{
    average?: unknown;
    trend?: string | null;
    isStrength?: boolean;
    isWeakness?: boolean;
    subject?: { name?: string | null } | null;
  }>;
};

export function buildStudentTemplateContext(
  student: {
    firstName?: string | null;
    lastName?: string | null;
    className?: string | null;
  },
  analytics?: AnalyticsLike | null,
  extras?: {
    attendanceRate?: number | null;
    incidentCount?: number;
    failureProbability?: number;
    failureLevel?: string;
    failureRecommendations?: string[];
  }
): StudentTemplateContext {
  const strengths =
    analytics?.subjectPerformances
      ?.filter((s) => s.isStrength)
      .map((s) => s.subject?.name ?? "")
      .filter(Boolean) ?? [];

  const weaknesses =
    analytics?.subjectPerformances
      ?.filter((s) => s.isWeakness)
      .map((s) => s.subject?.name ?? "")
      .filter(Boolean) ?? [];

  return {
    firstName: student.firstName,
    lastName: student.lastName,
    className: student.className,
    periodName: analytics?.period?.name ?? null,
    generalAverage:
      analytics?.generalAverage !== null && analytics?.generalAverage !== undefined
        ? Number(analytics.generalAverage)
        : null,
    progressionRate:
      analytics?.progressionRate !== null && analytics?.progressionRate !== undefined
        ? Number(analytics.progressionRate)
        : null,
    performanceLevel: analytics?.performanceLevel ?? null,
    riskLevel: analytics?.riskLevel ?? null,
    riskFactors: analytics?.riskFactors ?? [],
    classRank: analytics?.classRank ?? null,
    classSize: analytics?.classSize ?? null,
    strengths,
    weaknesses,
    subjectPerformances:
      analytics?.subjectPerformances?.map((sp) => ({
        subjectName: sp.subject?.name ?? "Matière",
        average:
          sp.average !== null && sp.average !== undefined ? Number(sp.average) : null,
        trend: sp.trend,
        isStrength: sp.isStrength,
        isWeakness: sp.isWeakness,
      })) ?? [],
    attendanceRate: extras?.attendanceRate ?? null,
    incidentCount: extras?.incidentCount,
    failureProbability: extras?.failureProbability,
    failureLevel: extras?.failureLevel,
    failureRecommendations: extras?.failureRecommendations,
  };
}
