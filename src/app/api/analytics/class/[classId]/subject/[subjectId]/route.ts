import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { roundTo } from "@/lib/analytics/helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/analytics/class/[classId]/subject/[subjectId]
 * Statistiques d'une matière dans une classe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; subjectId: string }> }
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

    const { classId, subjectId } = await params;

    // Find the classSubject
    const classSubject = await prisma.classSubject.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
      include: {
        class: { select: { name: true, schoolId: true } },
        subject: { select: { name: true } },
        teacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!classSubject) {
      return NextResponse.json({ error: "Matière de classe introuvable" }, { status: 404 });
    }

    const schoolId = classSubject.class.schoolId;

    if (!canAccessSchool(session, schoolId)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Get current academic year
    const currentYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });

    if (!currentYear) {
      return NextResponse.json({ error: "Année académique requise" }, { status: 400 });
    }

    const yearId = currentYear.id;

    // Get enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: { classId, academicYearId: yearId, status: "ACTIVE" },
      select: { studentId: true },
    });

    const studentIds = enrollments.map(e => e.studentId);

    // Get subject performances for these students
    const subjectPerformances = await prisma.subjectPerformance.findMany({
      where: {
        subjectId,
        analytics: {
          academicYearId: yearId,
          studentId: { in: studentIds },
        },
      },
      include: {
        analytics: {
          include: {
            period: {
              select: { sequence: true },
            },
            student: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    // Aggregate per student using the latest analytics snapshot
    const studentMap: Record<
      string,
      { name: string; average: number; sequence: number }
    > = {};
    for (const sp of subjectPerformances) {
      if (sp.average === null) continue;
      const sid = sp.analytics.studentId;
      const avg = Number(sp.average);
      const sequence = sp.analytics.period?.sequence ?? -1;
      if (
        !studentMap[sid] ||
        sequence > studentMap[sid].sequence
      ) {
        studentMap[sid] = {
          name: `${sp.analytics.student.user.firstName} ${sp.analytics.student.user.lastName}`,
          average: avg,
          sequence,
        };
      }
    }

    const averages = Object.values(studentMap).map(s => s.average);
    const average = averages.length > 0 ? averages.reduce((s, v) => s + v, 0) / averages.length : 0;
    const highest = averages.length > 0 ? Math.max(...averages) : 0;
    const lowest = averages.length > 0 ? Math.min(...averages) : 0;

    // Median
    const sorted = [...averages].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;

    // Grade distribution
    const gradeDistribution = {
      excellent: averages.filter(a => a >= 16).length,
      veryGood: averages.filter(a => a >= 14 && a < 16).length,
      good: averages.filter(a => a >= 12 && a < 14).length,
      average: averages.filter(a => a >= 10 && a < 12).length,
      insufficient: averages.filter(a => a >= 8 && a < 10).length,
      weak: averages.filter(a => a < 8).length,
    };

    // Student grades sorted desc with rank
    const studentGrades = Object.entries(studentMap)
      .sort(([, a], [, b]) => b.average - a.average)
      .map(([studentId, s], i) => ({
        studentId,
        studentName: s.name,
        average: roundTo(s.average),
        rank: i + 1,
      }));

    // Evaluations for this classSubject
    const evaluationsRaw = await prisma.evaluation.findMany({
      where: {
        classSubjectId: classSubject.id,
        period: {
          academicYearId: yearId,
        },
      },
      include: {
        grades: { select: { value: true, isAbsent: true } },
      },
      orderBy: { date: "asc" },
    });

    const evaluations = evaluationsRaw.map(ev => {
      const validGrades = ev.grades.filter(g => !g.isAbsent && g.value !== null);
      const classAverage = validGrades.length > 0
        ? validGrades.reduce((sum, g) => sum + Number(g.value || 0), 0) / validGrades.length
        : 0;
      return {
        name: ev.title || "Évaluation",
        date: ev.date,
        classAverage: roundTo(classAverage),
      };
    });

    const teacherName = classSubject.teacher
      ? `${classSubject.teacher.user.firstName} ${classSubject.teacher.user.lastName}`
      : "N/A";

    return NextResponse.json({
      subjectName: classSubject.subject.name,
      className: classSubject.class.name,
      teacherName,
      average: roundTo(average),
      highest: roundTo(highest),
      lowest: roundTo(lowest),
      median: roundTo(median),
      gradeDistribution,
      studentGrades,
      evaluations,
    });
  } catch (error) {
    logger.error("fetching subject analytics:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des analytics de matière" },
      { status: 500 }
    );
  }
}
