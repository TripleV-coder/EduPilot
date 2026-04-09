import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  dedupeLatestAnalyticsByStudent,
  roundTo,
} from "@/lib/analytics/helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

function averageGeneral(analytics: Array<{ generalAverage: unknown }>): number {
  const scoredAnalytics = analytics
    .map((item) => Number(item.generalAverage))
    .filter((value) => Number.isFinite(value));

  if (scoredAnalytics.length === 0) return 0;

  return scoredAnalytics.reduce((sum, item) => sum + item, 0) / scoredAnalytics.length;
}

/**
 * GET /api/analytics/school/overview
 * Obtenir une vue d'ensemble des analytics de l'établissement
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const schoolId = requestedSchoolId || getActiveSchoolId(session);

    if (!schoolId) {
      return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
    }
    const periodId = searchParams.get("periodId");
    const academicYearId = searchParams.get("academicYearId");

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
      return NextResponse.json({ error: "Année académique requise" }, { status: 400 });
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
    const analytics = await prisma.studentAnalytics.findMany({
      where: {
        academicYearId: yearId,
        student: { schoolId },
      },
      include: {
        period: {
          select: { id: true, name: true, sequence: true },
        },
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              where: { academicYearId: yearId, status: "ACTIVE" },
              include: { class: { select: { name: true } } },
            },
          },
        },
        subjectPerformances: {
          include: {
            subject: { select: { name: true, code: true } },
          },
        },
      },
    });
    const currentAnalytics = periodId
      ? analytics.filter((item) => item.periodId === periodId)
      : dedupeLatestAnalyticsByStudent(analytics);
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

    const topStudents = currentAnalytics
      .filter((item) => item.generalAverage !== null && Number(item.generalAverage) >= 15)
      .sort((left, right) => Number(right.generalAverage) - Number(left.generalAverage))
      .slice(0, 10)
      .map((a) => ({
      student: {
        user: a.student.user,
        class: a.student.enrollments[0]?.class || { name: "N/A" },
      },
      generalAverage: Number(a.generalAverage),
      period: a.period,
    }));

    const atRiskStudents = currentAnalytics
      .filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL")
      .sort((left, right) => Number(left.generalAverage || 0) - Number(right.generalAverage || 0))
      .slice(0, 10)
      .map((a) => ({
      student: {
        id: a.student.id,
        user: a.student.user,
        class: a.student.enrollments[0]?.class || { name: "N/A" },
      },
      generalAverage: Number(a.generalAverage),
      period: a.period,
    }));

    const subjectStats: Record<string, { name: string; totalAverage: number; count: number }> = {};
    for (const analyticsItem of currentAnalytics) {
      for (const perf of analyticsItem.subjectPerformances) {
        if (perf.average === null) continue;
        const key = perf.subjectId;
        if (!subjectStats[key]) {
          subjectStats[key] = { name: perf.subject.name, totalAverage: 0, count: 0 };
        }
        subjectStats[key].totalAverage += Number(perf.average || 0);
        subjectStats[key].count += 1;
      }
    }

    const subjectSummary = Object.entries(subjectStats).map(([id, s]) => ({
      subjectId: id,
      subject: s.name,
      name: s.name, // compatibility
      grade: s.count > 0 ? roundTo(s.totalAverage / s.count) : 0,
      average: s.count > 0 ? roundTo(s.totalAverage / s.count) : 0, // compatibility
      studentsCount: s.count,
    })).sort((a, b) => b.grade - a.grade);

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
        });

        const prevAvg = averageGeneral(previousAnalytics);
        const currentAvg = averageGeneral(currentPeriodAnalytics);

        periodComparison = {
          previousPeriod: previousPeriod.name,
          currentAverage: currentAvg,
          previousAverage: prevAvg,
          improvement: currentAvg > 0 && prevAvg > 0
            ? currentAvg - prevAvg
            : 0,
          studentsImproved: currentPeriodAnalytics.filter(a =>
            previousAnalytics.find(p => p.studentId === a.studentId && (Number(a.generalAverage || 0) > Number(p.generalAverage || 0)))
          ).length,
          studentsDeclined: currentPeriodAnalytics.filter(a =>
            previousAnalytics.find(p => p.studentId === a.studentId && (Number(a.generalAverage || 0) < Number(p.generalAverage || 0)))
          ).length,
        };
      }
    }

    const periods = await prisma.period.findMany({
      where: { academicYearId: yearId },
      select: { id: true, name: true, sequence: true },
      orderBy: { sequence: "asc" },
    });

    return NextResponse.json({
      overview: {
        totalStudents,
        activeStudents,
        averageGrade: roundTo(avgGeneral).toFixed(2),
        totalAnalytics: currentAnalytics.length,
        failureRate: currentAnalytics.length > 0 
          ? roundTo((currentAnalytics.filter(a => Number(a.generalAverage || 0) < 10).length / currentAnalytics.length) * 100)
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
    });
  } catch (error) {
    logger.error(" fetching school analytics overview:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des analytics" },
      { status: 500 }
    );
  }
}
