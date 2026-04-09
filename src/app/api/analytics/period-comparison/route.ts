import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { roundTo } from "@/lib/analytics/helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/analytics/period-comparison
 * Compare performance across multiple periods for same class
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const classId = searchParams.get("classId");
    const periodIds = searchParams.getAll("periodIds"); // Multiple periodIds

    if (!academicYearId || !classId || periodIds.length === 0) {
      return NextResponse.json(
        { error: "Paramètres manquants" },
        { status: 400 }
      );
    }

    const classRecord = await prisma.class.findFirst({
      where: { id: classId },
      select: { id: true, schoolId: true, name: true },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }

    if (!canAccessSchool(session, classRecord.schoolId)) {
      return NextResponse.json({ error: "Accès refusé à cette classe" }, { status: 403 });
    }

    const comparisons = await Promise.all(
      periodIds.map(async (periodId) => {
        const analytics = await prisma.studentAnalytics.findMany({
          where: {
            academicYearId,
            periodId,
            student: {
              schoolId: classRecord.schoolId,
              enrollments: {
                some: { classId, academicYearId },
              },
            },
          },
        });
        const scoredAnalytics = analytics.filter(
          (item) => item.generalAverage !== null
        );

        const avgGrade =
          scoredAnalytics.length > 0
            ? scoredAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) /
              scoredAnalytics.length
            : 0;

        const passRate =
          scoredAnalytics.length > 0
            ? (scoredAnalytics.filter((a) => Number(a.generalAverage) >= 10).length /
              scoredAnalytics.length) *
              100
            : 0;

        const performanceDistribution = {
          excellent: analytics.filter((a) => a.performanceLevel === "EXCELLENT").length,
          veryGood: analytics.filter((a) => a.performanceLevel === "VERY_GOOD").length,
          good: analytics.filter((a) => a.performanceLevel === "GOOD").length,
          average: analytics.filter((a) => a.performanceLevel === "AVERAGE").length,
          insufficient: analytics.filter((a) => a.performanceLevel === "INSUFFICIENT").length,
          weak: analytics.filter((a) => a.performanceLevel === "WEAK").length,
        };

        const period = await prisma.period.findUnique({
          where: { id: periodId },
          select: { name: true },
        });

        return {
          periodId,
          periodName: period?.name || "Unknown",
          classId: classRecord.id,
          className: classRecord.name,
          schoolId: classRecord.schoolId,
          studentCount: analytics.length,
          averageGrade: roundTo(avgGrade),
          passRate: roundTo(passRate),
          performanceDistribution,
        };
      })
    );

    return NextResponse.json(comparisons);
  } catch (error) {
    logger.error("Error fetching period comparison:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la comparaison" },
      { status: 500 }
    );
  }
}
