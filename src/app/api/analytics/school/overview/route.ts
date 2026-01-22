import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

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

    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
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
    });

    const avgGeneral = analytics.length > 0
      ? analytics.reduce((sum, a) => sum + Number(a.generalAverage || 0), 0) / analytics.length
      : 0;

    const performanceDistribution = {
      excellent: analytics.filter(a => a.performanceLevel === "EXCELLENT").length,
      veryGood: analytics.filter(a => a.performanceLevel === "VERY_GOOD").length,
      good: analytics.filter(a => a.performanceLevel === "GOOD").length,
      average: analytics.filter(a => a.performanceLevel === "AVERAGE").length,
      insufficient: analytics.filter(a => a.performanceLevel === "INSUFFICIENT").length,
      weak: analytics.filter(a => a.performanceLevel === "WEAK").length,
    };

    const riskDistribution = {
      low: analytics.filter(a => a.riskLevel === "LOW").length,
      medium: analytics.filter(a => a.riskLevel === "MEDIUM").length,
      high: analytics.filter(a => a.riskLevel === "HIGH").length,
      critical: analytics.filter(a => a.riskLevel === "CRITICAL").length,
    };

    // 3. Top performing students
    const topStudentsRaw = await prisma.studentAnalytics.findMany({
      where: {
        academicYearId: yearId,
        generalAverage: { gte: 15 },
        student: { schoolId },
      },
      orderBy: { generalAverage: "desc" },
      take: 10,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              where: { academicYearId: yearId, status: "ACTIVE" },
              include: { class: { select: { name: true } } },
            },
          },
        },
        period: { select: { name: true } },
      },
    });

    const topStudents = topStudentsRaw.map(a => ({
      student: {
        user: a.student.user,
        class: a.student.enrollments[0]?.class || { name: "N/A" },
      },
      generalAverage: Number(a.generalAverage),
      period: a.period,
    }));

    // 4. Students at risk
    const atRiskStudentsRaw = await prisma.studentAnalytics.findMany({
      where: {
        academicYearId: yearId,
        riskLevel: { in: ["HIGH", "CRITICAL"] },
        student: { schoolId },
      },
      orderBy: { generalAverage: "asc" },
      take: 10,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              where: { academicYearId: yearId, status: "ACTIVE" },
              include: { class: { select: { name: true } } },
            },
          },
        },
        period: { select: { name: true } },
      },
    });

    const atRiskStudents = atRiskStudentsRaw.map(a => ({
      student: {
        user: a.student.user,
        class: a.student.enrollments[0]?.class || { name: "N/A" },
      },
      generalAverage: Number(a.generalAverage),
      period: a.period,
    }));

    // 5. Subject performance summary
    const subjectPerformances = await prisma.subjectPerformance.findMany({
      where: {
        analytics: {
          academicYearId: yearId,
          student: { schoolId },
        },
      },
      include: {
        subject: { select: { name: true, code: true } },
      },
    });

    // Aggregate by subject
    const subjectStats: Record<string, { name: string; totalAverage: number; count: number }> = {};
    for (const perf of subjectPerformances) {
      const key = perf.subjectId;
      if (!subjectStats[key]) {
        subjectStats[key] = { name: perf.subject.name, totalAverage: 0, count: 0 };
      }
      subjectStats[key].totalAverage += Number(perf.average || 0);
      subjectStats[key].count += 1;
    }

    const subjectSummary = Object.values(subjectStats).map(s => ({
      name: s.name,
      average: s.count > 0 ? s.totalAverage / s.count : 0,
      studentsCount: s.count,
    })).sort((a, b) => b.average - a.average);

    // 6. Attendance overview
    const attendanceStats = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        student: { schoolId },
        date: {
          gte: new Date(new Date().getFullYear(), 0, 1),
          lte: new Date(),
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

        const prevAvg = previousAnalytics.length > 0
          ? previousAnalytics.reduce((sum, a) => sum + Number(a.generalAverage || 0), 0) / previousAnalytics.length
          : 0;

        periodComparison = {
          previousPeriod: previousPeriod.name,
          currentAverage: currentPeriodAnalytics.length > 0
            ? currentPeriodAnalytics.reduce((sum, a) => sum + Number(a.generalAverage || 0), 0) / currentPeriodAnalytics.length
            : 0,
          previousAverage: prevAvg,
          improvement: currentPeriodAnalytics.length > 0 && prevAvg > 0
            ? (currentPeriodAnalytics.reduce((sum, a) => sum + Number(a.generalAverage || 0), 0) / currentPeriodAnalytics.length) - prevAvg
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

    return NextResponse.json({
      overview: {
        totalStudents,
        activeStudents,
        averageGrade: avgGeneral.toFixed(2),
        totalAnalytics: analytics.length,
      },
      performanceDistribution,
      riskDistribution,
      topStudents,
      atRiskStudents,
      subjectSummary,
      attendanceDistribution,
      periodComparison,
    });
  } catch (error) {
    logger.error(" fetching school analytics overview:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des analytics" },
      { status: 500 }
    );
  }
}
