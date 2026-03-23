import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/parents/dashboard
 * Get parent dashboard with children analytics
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        parentStudents: {
          include: {
            student: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, avatar: true },
                },
                enrollments: {
                  where: { status: "ACTIVE" },
                  include: {
                    class: {
                      include: { classLevel: true },
                    },
                    academicYear: true,
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!parentProfile) {
      return NextResponse.json({ error: "Profil parent non trouvé" }, { status: 404 });
    }

    // Get analytics for each child
    const childrenAnalytics = await Promise.all(
      parentProfile.parentStudents.map(async (link) => {
        const student = link.student;
        const enrollment = student.enrollments[0];

        // Get grades (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const grades = await prisma.grade.findMany({
          where: {
            studentId: student.id,
            deletedAt: null,
            createdAt: { gte: thirtyDaysAgo },
          },
          include: {
            evaluation: {
              include: {
                classSubject: {
                  include: { subject: true },
                },
              },
            },
          },
        });

        // Calculate average
        const gradesWithValues = grades.filter(g => g.value !== null);
        const average = gradesWithValues.length > 0
          ? gradesWithValues.reduce((sum, g) => sum + Number(g.value), 0) / gradesWithValues.length
          : null;

        // Get attendance (last 30 days)
        const attendances = await prisma.attendance.findMany({
          where: {
            studentId: student.id,
            date: { gte: thirtyDaysAgo },
          },
        });

        const attendanceRate = attendances.length > 0
          ? ((attendances.filter(a => a.status === "PRESENT" || a.status === "LATE").length) / attendances.length) * 100
          : 100;

        // Get recent homework submissions
        const homeworkSubmissions = await prisma.homeworkSubmission.findMany({
          where: {
            studentId: student.id,
            createdAt: { gte: thirtyDaysAgo },
          },
          include: {
            homework: {
              select: { title: true, dueDate: true },
            },
          },
        });

        const gradedHomework = homeworkSubmissions.filter(h => h.grade !== null);
        const homeworkAverage = gradedHomework.length > 0
          ? gradedHomework.reduce((sum, h) => sum + Number(h.grade), 0) / gradedHomework.length
          : null;

        // Get behavior incidents
        const incidents = await prisma.behaviorIncident.findMany({
          where: {
            studentId: student.id,
            date: { gte: thirtyDaysAgo },
          },
        });

        // Get upcoming homework
        const upcomingHomework = await prisma.homework.findMany({
          where: {
            dueDate: { gte: new Date() },
            isPublished: true,
            classSubject: {
              class: {
                enrollments: {
                  some: {
                    studentId: student.id,
                    status: "ACTIVE",
                  },
                },
              },
            },
          },
          take: 5,
          orderBy: { dueDate: "asc" },
        });

        // Check for missing submissions
        const upcomingHomeworkIds = upcomingHomework.map(h => h.id);
        const existingSubmissions = await prisma.homeworkSubmission.findMany({
          where: {
            studentId: student.id,
            homeworkId: { in: upcomingHomeworkIds },
          },
          select: { homeworkId: true },
        });

        const submittedIds = existingSubmissions.map(s => s.homeworkId);
        const missingHomework = upcomingHomework.filter(h => !submittedIds.includes(h.id));

        return {
          student: {
            id: student.id,
            userId: student.user.id,
            firstName: student.user.firstName,
            lastName: student.user.lastName,
            avatar: student.user.avatar,
            matricule: student.matricule,
            class: enrollment ? {
              name: enrollment.class.name,
              level: enrollment.class.classLevel.name,
            } : null,
          },
          academics: {
            averageGrade: average ? Math.round(average * 100) / 100 : null,
            recentGradesCount: gradesWithValues.length,
            homeworkAverage: homeworkAverage ? Math.round(homeworkAverage * 100) / 100 : null,
            homeworkSubmitted: gradedHomework.length,
            homeworkTotal: homeworkSubmissions.length,
          },
          attendance: {
            rate: Math.round(attendanceRate * 100) / 100,
            present: attendances.filter(a => a.status === "PRESENT").length,
            absent: attendances.filter(a => a.status === "ABSENT").length,
            late: attendances.filter(a => a.status === "LATE").length,
            isAtRisk: attendanceRate < 85,
          },
          behavior: {
            incidentsCount: incidents.length,
            hasCritical: incidents.some(i => i.severity === "CRITICAL"),
            recentIncidents: incidents.slice(0, 3),
          },
          upcoming: {
            homework: missingHomework.slice(0, 3),
            homeworkDue: missingHomework.length,
          },
          alerts: [
            ...(attendanceRate < 85 ? [{
              level: "warning",
              message: `Taux d'assiduité faible: ${Math.round(attendanceRate)}%`,
            }] : []),
            ...(incidents.length > 3 ? [{
              level: "warning",
              message: `${incidents.length} incidents de comportement ce mois`,
            }] : []),
            ...(missingHomework.length > 0 ? [{
              level: "info",
              message: `${missingHomework.length} devoir(s) à rendre`,
            }] : []),
          ],
        };
      })
    );

    return NextResponse.json({
      children: childrenAnalytics,
      childrenCount: childrenAnalytics.length,
    });
  } catch (error) {
    logger.error(" fetching parent dashboard:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
