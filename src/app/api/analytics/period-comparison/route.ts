import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPassingGrade } from "@/lib/academic/grading-settings";
import { roundTo } from "@/lib/analytics/helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * GET /api/analytics/period-comparison
 * Compare performance across multiple periods for same class
 */
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const { searchParams } = new URL(request.url);
    const requestedYear = searchParams.get("academicYearId");
    const classId = searchParams.get("classId");
    const periodIds = searchParams.getAll("periodIds"); // Multiple periodIds
    let academicYearId = requestedYear === "ALL" ? null : requestedYear;
    if (!academicYearId && classId) {
      const klass = await prisma.class.findFirst({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (klass) {
        const current = await prisma.academicYear.findFirst({
          where: { schoolId: klass.schoolId, isCurrent: true },
          select: { id: true },
        });
        academicYearId = current?.id ?? null;
      }
    }

    if (!academicYearId || !classId || periodIds.length === 0) {
      if (requestedYear === "ALL") return NextResponse.json([]);
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

    // Année et périodes viennent du navigateur : elles doivent appartenir à
    // l'école de la classe. Une période d'une autre école renvoyait son nom
    // (audit du 2026-10-16). Même réponse qu'un identifiant inexistant.
    if (requestedYear && requestedYear !== "ALL") {
      const year = await prisma.academicYear.findFirst({
        where: { id: academicYearId, schoolId: classRecord.schoolId },
        select: { id: true },
      });
      if (!year) {
        return NextResponse.json({ error: "Année scolaire introuvable" }, { status: 404 });
      }
    }
    const requestedPeriodIds = [...new Set(periodIds)];
    const periods = await prisma.period.findMany({
      where: {
        id: { in: requestedPeriodIds },
        academicYearId,
        academicYear: { schoolId: classRecord.schoolId },
      },
      select: { id: true, name: true },
    });
    if (periods.length !== requestedPeriodIds.length) {
      return NextResponse.json({ error: "Période introuvable" }, { status: 404 });
    }
    const periodNames = new Map(periods.map((period) => [period.id, period.name]));

    // Taux de réussite au seuil de passage réglé par l'école
    const passingGrade = await getPassingGrade(classRecord.schoolId);

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
            ? (scoredAnalytics.filter((a) => Number(a.generalAverage) >= passingGrade).length /
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

        return {
          periodId,
          periodName: periodNames.get(periodId) ?? "",
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

});
