import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/analytics/attendance
 * Get attendance analytics and at-risk students
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const studentId = searchParams.get("studentId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Get attendance records
    const where: any = {};
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // Calculate statistics
    const total = attendances.length;
    const present = attendances.filter(a => a.status === "PRESENT").length;
    const absent = attendances.filter(a => a.status === "ABSENT").length;
    const late = attendances.filter(a => a.status === "LATE").length;
    const excused = attendances.filter(a => a.status === "EXCUSED").length;

    const attendanceRate = total > 0 ? ((present + late) / total) * 100 : 100;

    // Group by student to find at-risk students
    const studentStats = attendances.reduce((acc: any, attendance) => {
      const sid = attendance.studentId;
      if (!acc[sid]) {
        acc[sid] = {
          studentId: sid,
          studentName: `${attendance.student.user.firstName} ${attendance.student.user.lastName}`,
          userId: attendance.student.user.id,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
        };
      }
      acc[sid].total++;
      acc[sid][attendance.status.toLowerCase()]++;
      return acc;
    }, {});

    // Calculate rates and identify at-risk students
    const atRiskThreshold = 85; // 85% attendance minimum
    const atRiskStudents = Object.values(studentStats)
      .map((stats: any) => ({
        ...stats,
        attendanceRate: ((stats.present + stats.late) / stats.total) * 100,
      }))
      .filter((stats: any) => stats.attendanceRate < atRiskThreshold)
      .sort((a: any, b: any) => a.attendanceRate - b.attendanceRate);

    // Get trend (last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [recentAttendances, previousAttendances] = await Promise.all([
      prisma.attendance.count({
        where: {
          ...where,
          date: { gte: thirtyDaysAgo },
          status: { in: ["PRESENT", "LATE"] },
        },
      }),
      prisma.attendance.count({
        where: {
          ...where,
          date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          status: { in: ["PRESENT", "LATE"] },
        },
      }),
    ]);

    const [recentTotal, previousTotal] = await Promise.all([
      prisma.attendance.count({
        where: { ...where, date: { gte: thirtyDaysAgo } },
      }),
      prisma.attendance.count({
        where: { ...where, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
    ]);

    const recentRate = recentTotal > 0 ? (recentAttendances / recentTotal) * 100 : 100;
    const previousRate = previousTotal > 0 ? (previousAttendances / previousTotal) * 100 : 100;
    const trend = recentRate - previousRate;

    return NextResponse.json({
      summary: {
        total,
        present,
        absent,
        late,
        excused,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
      },
      trend: {
        current: Math.round(recentRate * 100) / 100,
        previous: Math.round(previousRate * 100) / 100,
        change: Math.round(trend * 100) / 100,
      },
      atRiskStudents,
      atRiskCount: atRiskStudents.length,
    });
  } catch (error) {
    logger.error(" fetching attendance analytics:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
