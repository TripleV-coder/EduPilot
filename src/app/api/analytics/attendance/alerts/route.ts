import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/analytics/attendance/alerts
 * Send alerts to parents of at-risk students
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const threshold = parseInt(searchParams.get("threshold") || "85");
    const days = parseInt(searchParams.get("days") || "30");

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get all students with attendance records
    const attendances = await prisma.attendance.findMany({
      where: {
        date: { gte: startDate },
      },
      include: {
        student: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
            parentLinks: {
              include: {
                parent: {
                  include: {
                    user: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate attendance rates
    const studentStats = attendances.reduce((acc: any, att) => {
      const sid = att.studentId;
      if (!acc[sid]) {
        acc[sid] = {
          student: att.student,
          total: 0,
          present: 0,
        };
      }
      acc[sid].total++;
      if (att.status === "PRESENT" || att.status === "LATE") {
        acc[sid].present++;
      }
      return acc;
    }, {});

    // Find at-risk students
    const atRiskStudents = Object.values(studentStats)
      .map((stats: any) => ({
        ...stats,
        rate: (stats.present / stats.total) * 100,
      }))
      .filter((stats: any) => stats.rate < threshold);

    // Send alerts to parents
    const notifications: any[] = [];

    for (const stats of atRiskStudents as any[]) {
      const parents = stats.student.parentLinks;

      for (const link of parents) {
        notifications.push({
          userId: link.parent.user.id,
          type: "WARNING",
          title: "Alerte assiduité",
          message: `${stats.student.user.firstName} ${stats.student.user.lastName} a un taux d'assiduité de ${Math.round(stats.rate)}% (seuil: ${threshold}%)`,
          link: `/students/${stats.student.id}/attendance`,
        });
      }
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications,
      });
    }

    return NextResponse.json({
      success: true,
      alertsSent: notifications.length,
      atRiskStudents: atRiskStudents.length,
    });
  } catch (error) {
    logger.error(" sending attendance alerts:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
