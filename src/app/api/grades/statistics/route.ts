import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import {
  averageNumbers,
  normalizeGradeTo20,
  roundTo,
} from "@/lib/analytics/helpers";

type AggregateBucket = {
  average: number;
  count: number;
};

function mergeClassSubjectWhere(
  current: Record<string, unknown>,
  updates: Record<string, unknown>
): Record<string, unknown> {
  return { ...current, ...updates };
}

// GET /api/grades/statistics - Get grade statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Non authentifié", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId");
    const periodId = searchParams.get("periodId");
    const type = searchParams.get("type"); // "student" | "class" | "subject"

    const where: Record<string, unknown> = {
      deletedAt: null,
      value: { not: null },
      isAbsent: false,
      isExcused: false,
    };

    const classSubjectWhere: Record<string, unknown> = {};
    const evaluationWhere: Record<string, unknown> = {};

    if (session.user.role !== "SUPER_ADMIN") {
      if (!session.user.schoolId) {
        return NextResponse.json(
          {
            error: "Accès refusé : aucun établissement associé",
            code: "NO_SCHOOL",
          },
          { status: 403 }
        );
      }

      classSubjectWhere.class = {
        schoolId: session.user.schoolId,
      };
    }

    if (classId) {
      Object.assign(
        classSubjectWhere,
        mergeClassSubjectWhere(classSubjectWhere, { classId })
      );
    }

    if (subjectId) {
      Object.assign(
        classSubjectWhere,
        mergeClassSubjectWhere(classSubjectWhere, { subjectId })
      );
    }

    if (Object.keys(classSubjectWhere).length > 0) {
      evaluationWhere.classSubject = classSubjectWhere;
    }

    if (periodId) {
      evaluationWhere.periodId = periodId;
    }

    if (Object.keys(evaluationWhere).length > 0) {
      where.evaluation = evaluationWhere;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        evaluation: {
          include: {
            classSubject: {
              include: {
                subject: true,
                class: true,
              },
            },
            period: true,
            type: true,
          },
        },
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    const stats = {
      totalGrades: 0,
      average: 0,
      highest: 0,
      lowest: 0,
      passRate: 0,
      gradeDistribution: {
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0,
      },
      bySubject: {} as Record<string, AggregateBucket>,
      byType: {} as Record<string, AggregateBucket>,
    };

    const normalizedValues: number[] = [];

    for (const grade of grades) {
      const value = normalizeGradeTo20(
        Number(grade.value),
        Number(grade.evaluation.maxGrade)
      );

      if (value === null) continue;

      normalizedValues.push(value);

      const subjectName = grade.evaluation.classSubject.subject.name;
      if (!stats.bySubject[subjectName]) {
        stats.bySubject[subjectName] = { average: 0, count: 0 };
      }
      stats.bySubject[subjectName].average += value;
      stats.bySubject[subjectName].count += 1;

      const typeName = grade.evaluation.type.name;
      if (!stats.byType[typeName]) {
        stats.byType[typeName] = { average: 0, count: 0 };
      }
      stats.byType[typeName].average += value;
      stats.byType[typeName].count += 1;

      if (value >= 16) stats.gradeDistribution.excellent++;
      else if (value >= 14) stats.gradeDistribution.good++;
      else if (value >= 10) stats.gradeDistribution.average++;
      else stats.gradeDistribution.poor++;
    }

    stats.totalGrades = normalizedValues.length;

    if (normalizedValues.length > 0) {
      stats.average = averageNumbers(normalizedValues) ?? 0;
      stats.highest = Math.max(...normalizedValues);
      stats.lowest = Math.min(...normalizedValues);
      stats.passRate =
        (normalizedValues.filter((value) => value >= 10).length /
          normalizedValues.length) *
        100;

      for (const [subject, bucket] of Object.entries(stats.bySubject)) {
        stats.bySubject[subject].average = bucket.average / bucket.count;
      }

      for (const [gradeType, bucket] of Object.entries(stats.byType)) {
        stats.byType[gradeType].average = bucket.average / bucket.count;
      }
    }

    let trend: "up" | "down" | "stable" | null = null;

    if (periodId) {
      const currentPeriod = await prisma.period.findUnique({
        where: { id: periodId },
        select: { academicYearId: true, sequence: true },
      });

      if (currentPeriod) {
        const previousPeriod = await prisma.period.findFirst({
          where: {
            academicYearId: currentPeriod.academicYearId,
            sequence: { lt: currentPeriod.sequence },
          },
          orderBy: { sequence: "desc" },
          select: { id: true },
        });

        if (previousPeriod) {
          const previousGrades = await prisma.grade.findMany({
            where: {
              ...where,
              evaluation: {
                ...evaluationWhere,
                periodId: previousPeriod.id,
              },
            },
            include: {
              evaluation: {
                select: { maxGrade: true },
              },
            },
          });

          const previousAverage = averageNumbers(
            previousGrades.map((grade) =>
              normalizeGradeTo20(Number(grade.value), Number(grade.evaluation.maxGrade))
            )
          );

          if (previousAverage !== null && stats.totalGrades > 0) {
            if (stats.average > previousAverage + 0.5) trend = "up";
            else if (stats.average < previousAverage - 0.5) trend = "down";
            else trend = "stable";
          }
        }
      }
    }

    let ranking: {
      totalStudents: number;
      rank: number | null;
      topStudent: {
        studentId: string;
        studentName: string;
        average: number;
        gradeCount: number;
      } | null;
      bottomStudent: {
        studentId: string;
        studentName: string;
        average: number;
        gradeCount: number;
      } | null;
      students?: Array<{
        studentId: string;
        studentName: string;
        average: number;
        gradeCount: number;
      }>;
    } | null = null;

    if (type === "class" && classId) {
      const rankingClassSubjectWhere: Record<string, unknown> = {
        ...classSubjectWhere,
        classId,
      };

      const rankingGrades = await prisma.grade.findMany({
        where: {
          deletedAt: null,
          value: { not: null },
          isAbsent: false,
          isExcused: false,
          evaluation: {
            ...(periodId ? { periodId } : {}),
            classSubject: rankingClassSubjectWhere,
          },
        },
        include: {
          evaluation: {
            select: { maxGrade: true },
          },
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      });

      const studentMap = new Map<
        string,
        {
          studentId: string;
          studentName: string;
          total: number;
          count: number;
        }
      >();

      for (const grade of rankingGrades) {
        const value = normalizeGradeTo20(
          Number(grade.value),
          Number(grade.evaluation.maxGrade)
        );
        if (value === null) continue;

        const existing = studentMap.get(grade.studentId) ?? {
          studentId: grade.studentId,
          studentName: `${grade.student.user.firstName} ${grade.student.user.lastName}`,
          total: 0,
          count: 0,
        };

        existing.total += value;
        existing.count += 1;
        studentMap.set(grade.studentId, existing);
      }

      const validStats = Array.from(studentMap.values())
        .filter((student) => student.count > 0)
        .map((student) => ({
          studentId: student.studentId,
          studentName: student.studentName,
          average: student.total / student.count,
          gradeCount: student.count,
        }))
        .sort((left, right) => right.average - left.average);

      const rankIndex = studentId
        ? validStats.findIndex((student) => student.studentId === studentId)
        : -1;

      ranking = {
        totalStudents: validStats.length,
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
        topStudent: validStats[0] ?? null,
        bottomStudent: validStats[validStats.length - 1] ?? null,
        students: validStats,
      };
    }

    return NextResponse.json({
      statistics: {
        ...stats,
        average: roundTo(stats.average),
        highest: roundTo(stats.highest),
        lowest: roundTo(stats.lowest),
        passRate: roundTo(stats.passRate),
        gradeDistribution: stats.gradeDistribution,
        bySubject: Object.fromEntries(
          Object.entries(stats.bySubject).map(([key, value]) => [
            key,
            { ...value, average: roundTo(value.average) },
          ])
        ),
        byType: Object.fromEntries(
          Object.entries(stats.byType).map(([key, value]) => [
            key,
            { ...value, average: roundTo(value.average) },
          ])
        ),
      },
      trend,
      ranking,
    });
  } catch (error) {
    logger.error("Error fetching grade statistics", error as Error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des statistiques",
        code: "STATISTICS_ERROR",
      },
      { status: 500 }
    );
  }
}
