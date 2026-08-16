import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * GET /api/parents/dashboard
 * Get parent dashboard with children analytics
 */
export const GET = createApiHandler(
  async (_request, context) => {
    try {
      const session = context.session;

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

      // Batch-fetch analytics for all children to avoid N+1 queries
      const studentIds = parentProfile.parentStudents.map((link) => link.student.id);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [allGrades, allAttendances, allHomeworkSubmissions, allIncidents] = await Promise.all([
        prisma.grade.findMany({
          where: { studentId: { in: studentIds }, deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
          include: { evaluation: { include: { classSubject: { include: { subject: true } } } } },
        }),
        prisma.attendance.findMany({
          where: { studentId: { in: studentIds }, date: { gte: thirtyDaysAgo } },
        }),
        prisma.homeworkSubmission.findMany({
          where: { studentId: { in: studentIds }, createdAt: { gte: thirtyDaysAgo } },
          include: { homework: { select: { title: true, dueDate: true } } },
        }),
        prisma.behaviorIncident.findMany({
          where: { studentId: { in: studentIds }, date: { gte: thirtyDaysAgo } },
        }),
      ]);

      // Index by studentId for O(1) lookups
      const gradesByStudent = new Map<string, typeof allGrades>();
      const attendancesByStudent = new Map<string, typeof allAttendances>();
      const submissionsByStudent = new Map<string, typeof allHomeworkSubmissions>();
      const incidentsByStudent = new Map<string, typeof allIncidents>();

      for (const g of allGrades) (gradesByStudent.get(g.studentId) ?? gradesByStudent.set(g.studentId, []).get(g.studentId)!).push(g);
      for (const a of allAttendances) (attendancesByStudent.get(a.studentId) ?? attendancesByStudent.set(a.studentId, []).get(a.studentId)!).push(a);
      for (const s of allHomeworkSubmissions) (submissionsByStudent.get(s.studentId) ?? submissionsByStudent.set(s.studentId, []).get(s.studentId)!).push(s);
      for (const i of allIncidents) (incidentsByStudent.get(i.studentId) ?? incidentsByStudent.set(i.studentId, []).get(i.studentId)!).push(i);

      const childrenAnalytics = await Promise.all(
        parentProfile.parentStudents.map(async (link) => {
          const student = link.student;
          const enrollment = student.enrollments[0];

          const grades = gradesByStudent.get(student.id) ?? [];
          const gradesWithValues = grades.filter((g) => g.value !== null);
          const average =
            gradesWithValues.length > 0
              ? gradesWithValues.reduce((sum, g) => sum + Number(g.value), 0) / gradesWithValues.length
              : null;

          const attendances = attendancesByStudent.get(student.id) ?? [];
          const attendanceRate =
            attendances.length > 0
              ? (attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length / attendances.length) * 100
              : 100;

          const homeworkSubmissions = submissionsByStudent.get(student.id) ?? [];
          const gradedHomework = homeworkSubmissions.filter((h) => h.grade !== null);
          const homeworkAverage =
            gradedHomework.length > 0
              ? gradedHomework.reduce((sum, h) => sum + Number(h.grade), 0) / gradedHomework.length
              : null;

          const incidents = incidentsByStudent.get(student.id) ?? [];

          // Get upcoming homework (per-student due to class enrollment filter)
          const upcomingHomework = await prisma.homework.findMany({
            where: {
              dueDate: { gte: new Date() },
              isPublished: true,
              classSubject: {
                class: {
                  enrollments: {
                    some: { studentId: student.id, status: "ACTIVE" },
                  },
                },
              },
            },
            take: 5,
            orderBy: { dueDate: "asc" },
          });

          const upcomingHomeworkIds = upcomingHomework.map((h) => h.id);
          const existingSubmissions =
            upcomingHomeworkIds.length > 0
              ? await prisma.homeworkSubmission.findMany({
                  where: { studentId: student.id, homeworkId: { in: upcomingHomeworkIds } },
                  select: { homeworkId: true },
                })
              : [];

          const submittedIds = existingSubmissions.map((s) => s.homeworkId);
          const missingHomework = upcomingHomework.filter((h) => !submittedIds.includes(h.id));

          return {
            student: {
              id: student.id,
              userId: student.user.id,
              firstName: student.user.firstName,
              lastName: student.user.lastName,
              avatar: student.user.avatar,
              matricule: student.matricule,
              class: enrollment
                ? {
                    name: enrollment.class.name,
                    level: enrollment.class.classLevel.name,
                  }
                : null,
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
              present: attendances.filter((a) => a.status === "PRESENT").length,
              absent: attendances.filter((a) => a.status === "ABSENT").length,
              late: attendances.filter((a) => a.status === "LATE").length,
              isAtRisk: attendanceRate < 85,
            },
            behavior: {
              incidentsCount: incidents.length,
              hasCritical: incidents.some((i) => i.severity === "CRITICAL"),
              recentIncidents: incidents.slice(0, 3),
            },
            upcoming: {
              homework: missingHomework.slice(0, 3),
              homeworkDue: missingHomework.length,
            },
            alerts: [
              ...(attendanceRate < 85
                ? [
                    {
                      level: "warning",
                      message: `Taux d'assiduité faible: ${Math.round(attendanceRate)}%`,
                    },
                  ]
                : []),
              ...(incidents.length > 3
                ? [
                    {
                      level: "warning",
                      message: `${incidents.length} incidents de comportement ce mois`,
                    },
                  ]
                : []),
              ...(missingHomework.length > 0
                ? [
                    {
                      level: "info",
                      message: `${missingHomework.length} devoir(s) à rendre`,
                    },
                  ]
                : []),
            ],
          };
        }),
      );

      return NextResponse.json({
        children: childrenAnalytics,
        childrenCount: childrenAnalytics.length,
      });
    } catch (error) {
      logger.error(" fetching parent dashboard:", error as Error);
      return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }
  },
  { allowedRoles: ["PARENT"] },
);
