import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateStudentAnalytics } from "@/lib/services/student-analytics";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/analytics/students
 * Obtenir les analytics des élèves
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const periodId = searchParams.get("periodId");
    const academicYearId = searchParams.get("academicYearId");
    const riskLevel = searchParams.get("riskLevel");

    const where: any = {};

    // Filtrage par rôle
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!studentProfile) {
        return NextResponse.json([]);
      }
      where.studentId = studentProfile.id;
    } else if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          children: {
            select: { studentId: true },
          },
        },
      });
      if (!parentProfile) {
        return NextResponse.json([]);
      }
      where.studentId = {
        in: parentProfile.children.map((c) => c.studentId),
      };
    } else if (session.user.role === "TEACHER") {
      // Enseignant peut voir les analytics de ses élèves
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (teacherProfile) {
        // Trouver toutes les classes où l'enseignant enseigne
        const classSubjects = await prisma.classSubject.findMany({
          where: { teacherId: teacherProfile.id },
          select: { classId: true },
        });

        const classIds = [...new Set(classSubjects.map((cs) => cs.classId))];

        // Obtenir les élèves de ces classes
        const enrollments = await prisma.enrollment.findMany({
          where: {
            classId: { in: classIds },
            status: "ACTIVE",
          },
          select: { studentId: true },
        });

        where.studentId = {
          in: enrollments.map((e) => e.studentId),
        };
      }
    } else if (session.user.role !== "SUPER_ADMIN") {
      // Pour les admins d'école
      where.student = {
        user: {
        },
      };
    }

    if (studentId) where.studentId = studentId;
    if (periodId) where.periodId = periodId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (riskLevel) where.riskLevel = riskLevel;

    const analytics = await prisma.studentAnalytics.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        period: {
          select: { name: true },
        },
        academicYear: {
          select: { name: true },
        },
        subjectPerformances: {
          include: {
            subject: {
              select: { name: true, code: true },
            },
          },
        },
      },
      orderBy: { analyzedAt: "desc" },
    });

    return NextResponse.json(analytics);
  } catch (error) {
    logger.error(" fetching analytics:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/analytics/students
 * Générer les analytics pour un élève sur une période
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, periodId, academicYearId } = body;

    if (!studentId || !periodId || !academicYearId) {
      return NextResponse.json(
        { error: "studentId, periodId et academicYearId sont requis" },
        { status: 400 }
      );
    }

    // Vérifier l'accès
    if (session.user.role !== "SUPER_ADMIN") {
      const student = await prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: true },
      });

      if (!student || student.user.schoolId !== session.user.schoolId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Générer les analytics
    const analyticsData = await generateStudentAnalytics(studentId, periodId, academicYearId);

    // Sauvegarder dans la base
    const analytics = await prisma.studentAnalytics.upsert({
      where: {
        studentId_periodId: {
          studentId,
          periodId,
        },
      },
      create: {
        studentId,
        periodId,
        academicYearId,
        generalAverage: analyticsData.generalAverage,
        classRank: analyticsData.classRank,
        classSize: analyticsData.classSize,
        performanceLevel: analyticsData.performanceLevel,
        progressionRate: analyticsData.progressionRate,
        consistencyRate: analyticsData.consistencyRate,
        riskLevel: analyticsData.riskLevel,
        riskFactors: analyticsData.riskFactors,
      },
      update: {
        generalAverage: analyticsData.generalAverage,
        classRank: analyticsData.classRank,
        classSize: analyticsData.classSize,
        performanceLevel: analyticsData.performanceLevel,
        progressionRate: analyticsData.progressionRate,
        consistencyRate: analyticsData.consistencyRate,
        riskLevel: analyticsData.riskLevel,
        riskFactors: analyticsData.riskFactors,
        analyzedAt: new Date(),
      },
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        period: {
          select: { name: true },
        },
        academicYear: {
          select: { name: true },
        },
      },
    });

    // Sauvegarder les performances par matière
    for (const perf of analyticsData.subjectPerformances) {
      await prisma.subjectPerformance.upsert({
        where: {
          analyticsId_subjectId: {
            analyticsId: analytics.id,
            subjectId: perf.subjectId,
          },
        },
        create: {
          analyticsId: analytics.id,
          subjectId: perf.subjectId,
          average: perf.average,
          gradesCount: perf.gradesCount,
          minGrade: perf.min,
          maxGrade: perf.max,
          standardDev: perf.standardDev,
          isStrength: perf.isStrength,
          isWeakness: perf.isWeakness,
          trend: perf.trend,
          progressionRate: perf.progressionRate,
        },
        update: {
          average: perf.average,
          gradesCount: perf.gradesCount,
          minGrade: perf.min,
          maxGrade: perf.max,
          standardDev: perf.standardDev,
          isStrength: perf.isStrength,
          isWeakness: perf.isWeakness,
          trend: perf.trend,
          progressionRate: perf.progressionRate,
        },
      });
    }

    // Récupérer l'analytics complet
    const fullAnalytics = await prisma.studentAnalytics.findUnique({
      where: { id: analytics.id },
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        period: {
          select: { name: true },
        },
        academicYear: {
          select: { name: true },
        },
        subjectPerformances: {
          include: {
            subject: {
              select: { name: true, code: true },
            },
          },
        },
      },
    });

    return NextResponse.json(fullAnalytics, { status: 201 });
  } catch (error) {
    logger.error(" generating analytics:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
