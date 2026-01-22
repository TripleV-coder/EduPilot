import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";


// GET /api/grades/statistics - Get grade statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId");
    const periodId = searchParams.get("periodId");
    const type = searchParams.get("type"); // "student" | "class" | "subject"

    // Build base filter
    const where: any = {};

    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      where.evaluation = {
        classSubject: {
          class: {
            schoolId: session.user.schoolId,
          },
        },
      };
    }

    if (studentId) where.studentId = studentId;
    if (subjectId) where.evaluation = { ...where.evaluation, classSubject: { subjectId } };

    // Get all grades matching filters
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

    // Calculate statistics
    const stats = {
      totalGrades: grades.length,
      average: 0,
      highest: 0,
      lowest: 20,
      passRate: 0,
      gradeDistribution: {
        excellent: 0, // 16-20
        good: 0, // 14-16
        average: 0, // 10-14
        poor: 0, // <10
      },
      bySubject: {} as Record<string, { average: number; count: number }>,
      byType: {} as Record<string, { average: number; count: number }>,
    };

    let totalValue = 0;
    let passedCount = 0;

    grades.forEach((grade) => {
      const maxGrade = Number(grade.evaluation.maxGrade);
      const value = (Number(grade.value) / maxGrade) * 20;

      totalValue += value;

      // Track by subject
      const subjectName = grade.evaluation.classSubject.subject.name;
      if (!stats.bySubject[subjectName]) {
        stats.bySubject[subjectName] = { average: 0, count: 0 };
      }
      stats.bySubject[subjectName].average += value;
      stats.bySubject[subjectName].count += 1;

      // Track by type
      const typeName = grade.evaluation.type.name;
      if (!stats.byType[typeName]) {
        stats.byType[typeName] = { average: 0, count: 0 };
      }
      stats.byType[typeName].average += value;
      stats.byType[typeName].count += 1;

      // Grade distribution
      if (value >= 16) stats.gradeDistribution.excellent++;
      else if (value >= 14) stats.gradeDistribution.good++;
      else if (value >= 10) stats.gradeDistribution.average++;
      else stats.gradeDistribution.poor++;

      // Pass rate (>= 10/20)
      if (value >= 10) passedCount++;

      // Highest/lowest
      if (value > stats.highest) stats.highest = value;
      if (value < stats.lowest) stats.lowest = value;
    });

    if (grades.length > 0) {
      stats.average = totalValue / grades.length;
      stats.passRate = (passedCount / grades.length) * 100;

      // Calculate subject averages
      Object.keys(stats.bySubject).forEach((subject) => {
        stats.bySubject[subject].average =
          stats.bySubject[subject].average / stats.bySubject[subject].count;
      });

      // Calculate type averages
      Object.keys(stats.byType).forEach((type) => {
        stats.byType[type].average =
          stats.byType[type].average / stats.byType[type].count;
      });
    }

    // Calculate trend (compare with previous period if periodId provided)
    let trend: "up" | "down" | "stable" | null = null;
    if (periodId) {
      const currentPeriodGrades = grades.filter(
        (g) => g.evaluation.periodId === periodId
      );

      // Get previous period grades
      const previousPeriod = await prisma.period.findFirst({
        where: {
          academicYear: { schoolId: session.user.schoolId! },
          endDate: {
            lt: new Date(
              currentPeriodGrades[0]?.evaluation.period.startDate || new Date()
            ),
          },
        },
        orderBy: { endDate: "desc" },
        take: 1,
      });

      if (previousPeriod) {
        const previousGrades = await prisma.grade.findMany({
          where: {
            ...where,
            evaluation: {
              ...where.evaluation,
              periodId: previousPeriod.id,
            },
          },
          include: { evaluation: true }, // Include evaluation to access maxGrade
        });

        if (previousGrades.length > 0) {
          const previousTotal = previousGrades.reduce(
            (sum, g) =>
              sum + (Number(g.value) / Number(g.evaluation.maxGrade)) * 20,
            0
          );
          const previousAverage = previousTotal / previousGrades.length;

          if (stats.average > previousAverage + 0.5) trend = "up";
          else if (stats.average < previousAverage - 0.5) trend = "down";
          else trend = "stable";
        }
      }
    }

    // For class-level stats, get ranking
    let ranking: any = null;
    if (type === "class" && classId) {
      const classStudents = await prisma.enrollment.findMany({
        where: {
          classId,
          status: "ACTIVE",
        },
        include: {
          student: {
            include: {
              user: {
                select: { firstName: true, lastName: true, id: true },
              },
            },
          },
        },
      });

      const studentStats = await Promise.all(
        classStudents.map(async (enrollment) => {
          const studentGrades = await prisma.grade.findMany({
            where: {
              studentId: enrollment.studentId,
              evaluation: {
                classSubject: {
                  classId,
                },
              },
            },
            include: { evaluation: true },
          });

          if (studentGrades.length === 0) return null;

          const avg =
            studentGrades.reduce(
              (sum, g) =>
                sum + (Number(g.value) / Number(g.evaluation.maxGrade)) * 20,
              0
            ) / studentGrades.length;

          return {
            studentId: enrollment.studentId,
            studentName: `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`,
            average: avg,
            gradeCount: studentGrades.length,
          };
        })
      );

      const validStats = studentStats
        .filter((s) => s !== null)
        .sort((a, b) => (b?.average || 0) - (a?.average || 0)) as any[];

      const studentRank = validStats.findIndex(
        (s) => s.studentId === studentId
      );

      ranking = {
        totalStudents: validStats.length,
        rank: studentRank + 1,
        topStudent: validStats[0],
        bottomStudent: validStats[validStats.length - 1],
      };
    }

    return NextResponse.json({
      statistics: {
        ...stats,
        average: Math.round(stats.average * 100) / 100,
        highest: Math.round(stats.highest * 100) / 100,
        lowest: Math.round(stats.lowest * 100) / 100,
        passRate: Math.round(stats.passRate * 100) / 100,
        gradeDistribution: stats.gradeDistribution,
        bySubject: Object.fromEntries(
          Object.entries(stats.bySubject).map(([k, v]) => [
            k,
            { ...v, average: Math.round(v.average * 100) / 100 },
          ])
        ),
        byType: Object.fromEntries(
          Object.entries(stats.byType).map(([k, v]) => [
            k,
            { ...v, average: Math.round(v.average * 100) / 100 },
          ])
        ),
      },
      trend,
      ranking,
    });
  } catch (error) {
    logger.error("Error fetching grade statistics", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques", code: "STATISTICS_ERROR" },
      { status: 500 }
    );
  }
}
