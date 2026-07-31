// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

import { Prisma } from "@prisma/client";
import { roundTo } from "@/lib/analytics/helpers";
import type { AnalyticsWithDetails } from "./types";

export function buildPerformanceDistribution(analytics: { performanceLevel: string | null }[]) {
  return {
    excellent: analytics.filter(a => a.performanceLevel === "EXCELLENT").length,
    veryGood: analytics.filter(a => a.performanceLevel === "VERY_GOOD").length,
    good: analytics.filter(a => a.performanceLevel === "GOOD").length,
    average: analytics.filter(a => a.performanceLevel === "AVERAGE").length,
    insufficient: analytics.filter(a => a.performanceLevel === "INSUFFICIENT").length,
    weak: analytics.filter(a => a.performanceLevel === "WEAK").length,
  };
}

export function buildRiskDistribution(analytics: { riskLevel: string | null }[]) {
  return {
    low: analytics.filter(a => a.riskLevel === "LOW").length,
    medium: analytics.filter(a => a.riskLevel === "MEDIUM").length,
    high: analytics.filter(a => a.riskLevel === "HIGH").length,
    critical: analytics.filter(a => a.riskLevel === "CRITICAL").length,
  };
}

export function buildSubjectSummary(analytics: { subjectPerformances?: { subjectId: string; subject: { name: string }; average: number | Prisma.Decimal | null }[] }[], filterSubjectId?: string) {
  const subjectMap: Record<string, { name: string; total: number; count: number }> = {};

  for (const analyticsItem of analytics) {
    for (const perf of analyticsItem.subjectPerformances ?? []) {
      if (filterSubjectId && perf.subjectId !== filterSubjectId) continue;
      if (perf.average === null) continue;
      if (!subjectMap[perf.subjectId]) {
        subjectMap[perf.subjectId] = { name: perf.subject.name, total: 0, count: 0 };
      }
      subjectMap[perf.subjectId].total += Number(perf.average || 0);
      subjectMap[perf.subjectId].count += 1;
    }
  }

  return Object.values(subjectMap)
    .map((item) => ({
      name: item.name,
      average: item.count > 0 ? roundTo(item.total / item.count) : 0,
    }))
    .sort((left, right) => right.average - left.average);
}

export function buildAtRiskStudents(analytics: AnalyticsWithDetails[], yearId: string) {
  return analytics
    .filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL")
    .sort((left, right) => Number(left.generalAverage || 0) - Number(right.generalAverage || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.studentId,
      name: `${item.student.user.firstName} ${item.student.user.lastName}`,
      className: item.student.enrollments.find(
        (enrollment) =>
          enrollment.academicYearId === yearId && enrollment.status === "ACTIVE"
      )?.class?.name || "Indisponible",
      average: Number(item.generalAverage),
      riskLevel: (item.riskLevel || "").toLowerCase(),
    }));
}
