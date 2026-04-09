import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  dedupeLatestAnalyticsByStudent,
  roundTo,
} from "@/lib/analytics/helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/analytics/class-comparison
 * Compare performance across multiple classes
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const classIds = searchParams.getAll("classIds"); // Multiple classIds

    if (!academicYearId || classIds.length === 0) {
      return NextResponse.json(
        { error: "Paramètres manquants" },
        { status: 400 }
      );
    }

    const classRecords = await prisma.class.findMany({
      where: {
        id: { in: classIds },
      },
      select: {
        id: true,
        name: true,
        schoolId: true,
        school: {
          select: {
            name: true,
          },
        },
      },
    });

    if (classRecords.length !== classIds.length) {
      return NextResponse.json({ error: "Une ou plusieurs classes sont introuvables" }, { status: 404 });
    }

    const outOfScopeClass = classRecords.find((classRecord) => !canAccessSchool(session, classRecord.schoolId));
    if (outOfScopeClass) {
      return NextResponse.json({ error: "Accès refusé à une ou plusieurs classes demandées" }, { status: 403 });
    }

    const comparisons = await Promise.all(
      classRecords.map(async (classRecord) => {
        const enrollmentCount = await prisma.enrollment.count({
          where: { classId: classRecord.id, academicYearId, status: "ACTIVE" },
        });

        const analytics = await prisma.studentAnalytics.findMany({
          where: {
            academicYearId,
            student: {
              schoolId: classRecord.schoolId,
              enrollments: {
                some: { classId: classRecord.id, academicYearId },
              },
            },
          },
          include: {
            period: {
              select: { sequence: true },
            },
          },
        });

        const latestAnalytics = dedupeLatestAnalyticsByStudent(analytics);
        const scoredLatestAnalytics = latestAnalytics.filter(
          (item) => item.generalAverage !== null
        );

        const avgGrade =
          scoredLatestAnalytics.length > 0
            ? scoredLatestAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) /
              scoredLatestAnalytics.length
            : 0;

        const passRate =
          scoredLatestAnalytics.length > 0
            ? (scoredLatestAnalytics.filter((a) => Number(a.generalAverage) >= 10).length /
              scoredLatestAnalytics.length) *
              100
            : 0;

        const riskDistribution = {
          low: latestAnalytics.filter((a) => a.riskLevel === "LOW").length,
          medium: latestAnalytics.filter((a) => a.riskLevel === "MEDIUM").length,
          high: latestAnalytics.filter((a) => a.riskLevel === "HIGH").length,
          critical: latestAnalytics.filter((a) => a.riskLevel === "CRITICAL").length,
        };

        return {
          classId: classRecord.id,
          className: classRecord.name,
          schoolId: classRecord.schoolId,
          schoolName: classRecord.school.name,
          studentCount: enrollmentCount,
          averageGrade: roundTo(avgGrade),
          passRate: roundTo(passRate),
          riskDistribution,
        };
      })
    );

    return NextResponse.json(comparisons);
  } catch (error) {
    logger.error("Error fetching class comparison:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la comparaison" },
      { status: 500 }
    );
  }
}
