import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/attendance/stats
 * Get attendance statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};

    if (studentId) where.studentId = studentId;
    if (classId) where.classId = classId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    // Role-based filtering
    const userRole = session.user.role;
    if (userRole === "STUDENT") {
      where.studentId = session.user.id;
    } else if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });
      if (parentProfile) {
        where.studentId = { in: parentProfile.children.map((c) => c.studentId) };
      }
    }

    // Get attendance records
    const attendances = await prisma.attendance.findMany({
      where,
      select: {
        status: true,
        studentId: true,
      },
    });

    // Calculate statistics
    const total = attendances.length;
    const present = attendances.filter((a) => a.status === "PRESENT").length;
    const absent = attendances.filter((a) => a.status === "ABSENT").length;
    const late = attendances.filter((a) => a.status === "LATE").length;
    const excused = attendances.filter((a) => a.status === "EXCUSED").length;

    const presentRate = total > 0 ? ((present / total) * 100).toFixed(2) : "0";
    const absentRate = total > 0 ? ((absent / total) * 100).toFixed(2) : "0";

    // Group by student if multiple students
    let byStudent: any = null;
    if (!studentId && attendances.length > 0) {
      const studentIds = [...new Set(attendances.map((a) => a.studentId))];
      byStudent = {};

      for (const sid of studentIds) {
        const studentAttendances = attendances.filter((a) => a.studentId === sid);
        const studentTotal = studentAttendances.length;
        const studentPresent = studentAttendances.filter((a) => a.status === "PRESENT").length;

        byStudent[sid] = {
          total: studentTotal,
          present: studentPresent,
          absent: studentAttendances.filter((a) => a.status === "ABSENT").length,
          late: studentAttendances.filter((a) => a.status === "LATE").length,
          excused: studentAttendances.filter((a) => a.status === "EXCUSED").length,
          presentRate: studentTotal > 0 ? ((studentPresent / studentTotal) * 100).toFixed(2) : "0",
        };
      }
    }

    return NextResponse.json({
      total,
      present,
      absent,
      late,
      excused,
      presentRate: parseFloat(presentRate),
      absentRate: parseFloat(absentRate),
      byStudent,
    });
  } catch (error) {
    logger.error(" fetching attendance stats:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
}
