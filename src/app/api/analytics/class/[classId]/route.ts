import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  dedupeLatestAnalyticsByStudent,
  roundTo,
} from "@/lib/analytics/helpers";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/analytics/class/[classId]
 * Statistiques détaillées d'une classe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { classId } = await params;

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: { classLevel: { select: { name: true } } },
    });

    if (!classData) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }

    let schoolId = session.user.schoolId;
    if (!schoolId && session.user.role === "SUPER_ADMIN") {
      schoolId = classData.schoolId;
    }

    if (session.user.role !== "SUPER_ADMIN" && classData.schoolId !== schoolId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Get current academic year
    const currentYear = await prisma.academicYear.findFirst({
      where: { schoolId: classData.schoolId, isCurrent: true },
      select: { id: true },
    });

    if (!currentYear) {
      return NextResponse.json({ error: "Année académique requise" }, { status: 400 });
    }

    const yearId = currentYear.id;

    // Enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: { classId, academicYearId: yearId, status: "ACTIVE" },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);
    const studentCount = studentIds.length;

    // Analytics for enrolled students
    const analytics = await prisma.studentAnalytics.findMany({
      where: { academicYearId: yearId, studentId: { in: studentIds } },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        period: { select: { name: true, sequence: true } },
        subjectPerformances: {
          include: {
            subject: {
              select: { name: true },
            },
          },
        },
      },
    });

    const latestAnalytics = dedupeLatestAnalyticsByStudent(analytics);
    const scoredLatestAnalytics = latestAnalytics.filter(
      (item) => item.generalAverage !== null
    );

    const averageGrade = scoredLatestAnalytics.length > 0
      ? scoredLatestAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / scoredLatestAnalytics.length
      : 0;

    const performanceDistribution = {
      excellent: latestAnalytics.filter(a => a.performanceLevel === "EXCELLENT").length,
      veryGood: latestAnalytics.filter(a => a.performanceLevel === "VERY_GOOD").length,
      good: latestAnalytics.filter(a => a.performanceLevel === "GOOD").length,
      average: latestAnalytics.filter(a => a.performanceLevel === "AVERAGE").length,
      insufficient: latestAnalytics.filter(a => a.performanceLevel === "INSUFFICIENT").length,
      weak: latestAnalytics.filter(a => a.performanceLevel === "WEAK").length,
    };

    const riskDistribution = {
      low: latestAnalytics.filter(a => a.riskLevel === "LOW").length,
      medium: latestAnalytics.filter(a => a.riskLevel === "MEDIUM").length,
      high: latestAnalytics.filter(a => a.riskLevel === "HIGH").length,
      critical: latestAnalytics.filter(a => a.riskLevel === "CRITICAL").length,
    };

    const subjectMap: Record<string, { name: string; total: number; count: number }> = {};
    for (const analyticsItem of latestAnalytics) {
      for (const perf of analyticsItem.subjectPerformances) {
        if (perf.average === null) continue;
        if (!subjectMap[perf.subjectId]) {
          subjectMap[perf.subjectId] = { name: perf.subject.name, total: 0, count: 0 };
        }
        subjectMap[perf.subjectId].total += Number(perf.average || 0);
        subjectMap[perf.subjectId].count += 1;
      }
    }

    const subjectSummary = Object.entries(subjectMap)
      .map(([subjectId, s]) => ({ subjectId, name: s.name, average: s.count > 0 ? roundTo(s.total / s.count) : 0 }))
      .sort((a, b) => b.average - a.average);

    const studentRanking = latestAnalytics
      .filter((analyticsItem) => analyticsItem.generalAverage !== null)
      .map((analyticsItem) => ({
        studentId: analyticsItem.studentId,
        name: `${analyticsItem.student.user.firstName} ${analyticsItem.student.user.lastName}`,
        average: Number(analyticsItem.generalAverage),
      }))
      .sort((a, b) => b.average - a.average)
      .map((s, i) => ({ ...s, average: roundTo(s.average), rank: i + 1 }));

    // Monthly trend - avg per period
    const periods = await prisma.period.findMany({
      where: { academicYearId: yearId },
      orderBy: { sequence: "asc" },
    });

    const monthlyTrend = periods.map(period => {
      const periodAnalytics = analytics.filter(
        (a) => a.periodId === period.id && a.generalAverage !== null
      );
      const avg = periodAnalytics.length > 0
        ? periodAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / periodAnalytics.length
        : 0;
      return { name: period.name, value: roundTo(avg) };
    });

    return NextResponse.json({
      className: classData.name,
      classLevel: classData.classLevel.name,
      studentCount,
      averageGrade: roundTo(averageGrade),
      performanceDistribution,
      riskDistribution,
      subjectSummary,
      studentRanking,
      monthlyTrend,
    });
  } catch (error) {
    logger.error("fetching class analytics:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des analytics de classe" },
      { status: 500 }
    );
  }
}
