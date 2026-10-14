import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  dedupeLatestAnalyticsByStudent,
  roundTo,
} from "@/lib/analytics/helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { memoizeAsync } from "@/lib/cache/memo";
import { getPassingGrade } from "@/lib/academic/grading-settings";
import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import {
  DASHBOARD_ANALYTICS_SELECT,
  loadStudentIdentities,
  summarizeSubjectsWithPassRate,
} from "@/lib/services/analytics-dashboard/queries";

function emptySchoolOverview(yearId: string | null) {
  return {
    summary: {
      totalStudents: 0,
      activeStudents: 0,
      averageGeneral: 0,
      passRate: 0,
      failureRate: 0,
      dropoutRiskCount: 0,
      atRiskCount: 0,
    },
    performanceDistribution: {},
    riskDistribution: {},
    topStudents: [],
    atRiskStudents: [],
    subjectSummary: [],
    attendanceDistribution: {},
    periodComparison: [],
    academicYearId: yearId,
    periods: [],
  };
}

function averageGeneral(analytics: Array<{ generalAverage: unknown }>): number {
  const scoredAnalytics = analytics
    .map((item) => Number(item.generalAverage))
    .filter((value) => Number.isFinite(value));

  if (scoredAnalytics.length === 0) return 0;

  return scoredAnalytics.reduce((sum, item) => sum + item, 0) / scoredAnalytics.length;
}

/**
 * Vue d'ensemble d'un établissement : ~10 requêtes et ~50 000 lignes lues pour
 * une école de 1 000 élèves (analyse de capacité 2026-10-01). Agrégats
 * d'établissement, identiques pour toute personne autorisée (contrôle d'accès
 * fait avant l'appel) : calcul unique par minute et par processus, et un seul
 * calcul pour les demandes simultanées.
 */
const schoolOverview = memoizeAsync(
  {
    ttlMs: 60_000,
    key: (schoolId: string, academicYearId: string | null, periodId: string | null) =>
      ["school-overview", schoolId, academicYearId ?? "", periodId ?? ""].join("|"),
  },
  async (schoolId: string, academicYearId: string | null, periodId: string | null) => {
    // Get current academic year if not specified
    let yearId: string | null = academicYearId;
    if (!yearId) {
      const currentYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      yearId = currentYear?.id || null;
    }

    if (!yearId) {
      return emptySchoolOverview(null);
    }

    const academicYear = await prisma.academicYear.findUnique({
      where: { id: yearId },
      select: { startDate: true, endDate: true },
    });

    // 1. Student statistics
    const totalStudents = await prisma.studentProfile.count({
      where: { schoolId },
    });

    const activeStudents = await prisma.enrollment.count({
      where: {
        class: { schoolId },
        status: "ACTIVE",
        academicYearId: yearId,
      },
    });

    // 2. Academic performance overview
    // C3 : champs utiles aux indicateurs seulement, période filtrée par la base ;
    // noms, classes et matières par requêtes ciblées (analytics-dashboard/queries).
    const analytics = await prisma.studentAnalytics.findMany({
      where: {
        academicYearId: yearId,
        student: { schoolId },
        ...(periodId ? { periodId } : {}),
      },
      select: DASHBOARD_ANALYTICS_SELECT,
    });
    const currentAnalytics = periodId
      ? analytics
      : dedupeLatestAnalyticsByStudent(analytics);
    // Seuils réglés par l'école : moyenne de passage, « meilleurs élèves »
    const [passingGrade, schoolParams] = await Promise.all([getPassingGrade(schoolId), getSchoolParameters(schoolId)]);
    // Un élève sans moyenne (pas encore évalué) n'est ni en réussite ni en échec
    const scoredAnalytics = currentAnalytics.filter((a) => a.generalAverage !== null);
    const avgGeneral = averageGeneral(currentAnalytics);

    const performanceDistribution = {
      excellent: currentAnalytics.filter(a => a.performanceLevel === "EXCELLENT").length,
      veryGood: currentAnalytics.filter(a => a.performanceLevel === "VERY_GOOD").length,
      good: currentAnalytics.filter(a => a.performanceLevel === "GOOD").length,
      average: currentAnalytics.filter(a => a.performanceLevel === "AVERAGE").length,
      insufficient: currentAnalytics.filter(a => a.performanceLevel === "INSUFFICIENT").length,
      weak: currentAnalytics.filter(a => a.performanceLevel === "WEAK").length,
    };

    const riskDistribution = {
      low: currentAnalytics.filter(a => a.riskLevel === "LOW").length,
      medium: currentAnalytics.filter(a => a.riskLevel === "MEDIUM").length,
      high: currentAnalytics.filter(a => a.riskLevel === "HIGH").length,
      critical: currentAnalytics.filter(a => a.riskLevel === "CRITICAL").length,
    };

    const topAnalytics = currentAnalytics
      .filter((item) => item.generalAverage !== null && Number(item.generalAverage) >= schoolParams.performance.topStudentsFrom)
      .sort((left, right) => Number(right.generalAverage) - Number(left.generalAverage))
      .slice(0, 10);
    const atRiskAnalytics = currentAnalytics
      .filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL")
      .sort((left, right) => Number(left.generalAverage || 0) - Number(right.generalAverage || 0))
      .slice(0, 10);

    const [identities, subjectSummary] = await Promise.all([
      loadStudentIdentities([...topAnalytics, ...atRiskAnalytics].map((item) => item.studentId), yearId),
      summarizeSubjectsWithPassRate(currentAnalytics.map((item) => item.id), passingGrade),
    ]);
    const studentView = (studentId: string) => {
      const identity = identities.get(studentId);
      return {
        user: identity?.user ?? { firstName: "", lastName: "" },
        class: { name: identity?.className ?? "N/A" },
      };
    };

    const topStudents = topAnalytics.map((a) => ({
      student: studentView(a.studentId),
      generalAverage: Number(a.generalAverage),
      period: a.period,
    }));

    const atRiskStudents = atRiskAnalytics.map((a) => ({
      student: { id: a.studentId, ...studentView(a.studentId) },
      generalAverage: Number(a.generalAverage),
      period: a.period,
    }));

    // 6. Attendance overview
    const attendanceStats = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        student: { schoolId },
        date: {
          gte: academicYear?.startDate ?? new Date(new Date().getFullYear(), 0, 1),
          lte: academicYear?.endDate ?? new Date(),
        },
      },
      _count: true,
    });

    const attendanceDistribution = {
      present: attendanceStats.find(a => a.status === "PRESENT")?._count || 0,
      absent: attendanceStats.find(a => a.status === "ABSENT")?._count || 0,
      late: attendanceStats.find(a => a.status === "LATE")?._count || 0,
      excused: attendanceStats.find(a => a.status === "EXCUSED")?._count || 0,
    };

    // 7. Period comparison (if periodId provided)
    let periodComparison = null;
    if (periodId) {
      const currentPeriodAnalytics = analytics.filter(a => a.periodId === periodId);

      // Get previous period
      const currentPeriod = await prisma.period.findUnique({
        where: { id: periodId },
        select: { sequence: true },
      });
      const previousPeriod = await prisma.period.findFirst({
        where: {
          academicYearId: yearId,
          sequence: currentPeriod?.sequence ? currentPeriod.sequence - 1 : undefined,
        },
      });

      if (previousPeriod) {
        const previousAnalytics = await prisma.studentAnalytics.findMany({
          where: {
            academicYearId: yearId,
            periodId: previousPeriod.id,
            student: { schoolId },
          },
          select: { studentId: true, generalAverage: true },
        });

        const prevAvg = averageGeneral(previousAnalytics);
        const currentAvg = averageGeneral(currentPeriodAnalytics);
        // Index par élève (au lieu d'un find par élève : O(n²) sur une école entière).
        const previousByStudent = new Map<string, number[]>();
        for (const previous of previousAnalytics) {
          const averages = previousByStudent.get(previous.studentId) ?? [];
          averages.push(Number(previous.generalAverage || 0));
          previousByStudent.set(previous.studentId, averages);
        }
        const countAgainstPrevious = (predicate: (current: number, previous: number) => boolean) =>
          currentPeriodAnalytics.filter((a) =>
            (previousByStudent.get(a.studentId) ?? []).some((previous) => predicate(Number(a.generalAverage || 0), previous))
          ).length;

        periodComparison = {
          previousPeriod: previousPeriod.name,
          currentAverage: currentAvg,
          previousAverage: prevAvg,
          improvement: currentAvg > 0 && prevAvg > 0
            ? currentAvg - prevAvg
            : 0,
          studentsImproved: countAgainstPrevious((current, previous) => current > previous),
          studentsDeclined: countAgainstPrevious((current, previous) => current < previous),
        };
      }
    }

    const periods = await prisma.period.findMany({
      where: { academicYearId: yearId },
      select: { id: true, name: true, sequence: true },
      orderBy: { sequence: "asc" },
    });

    return {
      overview: {
        totalStudents,
        activeStudents,
        averageGrade: roundTo(avgGeneral).toFixed(2),
        totalAnalytics: currentAnalytics.length,
        failureRate: scoredAnalytics.length > 0
          ? roundTo((scoredAnalytics.filter(a => Number(a.generalAverage) < passingGrade).length / scoredAnalytics.length) * 100)
          : 0,
        dropoutRiskCount: riskDistribution.critical,
        atRiskCount: riskDistribution.high,
      },
      performanceDistribution,
      riskDistribution,
      topStudents,
      atRiskStudents,
      subjectSummary,
      attendanceDistribution,
      periodComparison,
      academicYearId: yearId,
      periods,
    };
  },
);

/**
 * GET /api/analytics/school/overview
 * Obtenir une vue d'ensemble des analytics de l'établissement
 */
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;


    const { searchParams } = new URL(request.url);
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const schoolId = requestedSchoolId || getActiveSchoolId(session);

    if (!schoolId) {
      if (session.user.role === "SUPER_ADMIN") {
        return NextResponse.json(emptySchoolOverview(null));
      }
      return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
    }
    const periodId = searchParams.get("periodId");
    const requestedYear = searchParams.get("academicYearId");
    const academicYearId = requestedYear === "ALL" ? null : requestedYear;

    return NextResponse.json(await schoolOverview(schoolId, academicYearId, periodId));
  
    } catch (error) {
    logger.error(" fetching school analytics overview:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des analytics" },
      { status: 500 }
    );
  }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] });
