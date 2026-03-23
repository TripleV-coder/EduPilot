import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { CACHE_TTL_SHORT, generateCacheKey, withCache } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";

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

    const url = new URL(request.url);
    const { searchParams } = url;
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);
    const handler = async () => {
      const where: Prisma.AttendanceWhereInput = {};

      if (studentId) where.studentId = studentId;
      if (classId) where.classId = classId;

      if (startDate || endDate) {
        where.date = {};
        if (startDate) (where.date as Prisma.DateTimeFilter).gte = new Date(startDate);
        if (endDate) (where.date as Prisma.DateTimeFilter).lte = new Date(endDate);
      }

      // Role-based filtering
      const userRole = session.user.role;
      if (userRole === "STUDENT") {
        const studentProfile = await prisma.studentProfile.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        });

        if (!studentProfile) {
          return NextResponse.json({
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            presentRate: 0,
            absentRate: 0,
            byStudent: null,
          });
        }

        where.studentId = studentProfile.id;
      } else if (userRole === "PARENT") {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId: session.user.id },
          include: { parentStudents: true },
        });

        if (!parentProfile) {
          return NextResponse.json({
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            presentRate: 0,
            absentRate: 0,
            byStudent: null,
          });
        }

        where.studentId = { in: parentProfile.parentStudents.map((c) => c.studentId) };
      } else if (userRole !== "SUPER_ADMIN") {
        // Protection mutli-tenants stricte : force le filtrage par schoolId de la session
        where.student = {
          schoolId: session.user.schoolId as string,
          user: { isActive: true }
        };
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

      const presentEquivalent = present + late;
      const presentRate = total > 0 ? ((presentEquivalent / total) * 100).toFixed(2) : "0";
      const absentRate = total > 0 ? ((absent / total) * 100).toFixed(2) : "0";

      // Group by student if multiple students
      let byStudent: Record<string, {
        total: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
        presentRate: string;
      }> | null = null;
      if (!studentId && attendances.length > 0) {
        const studentIds = [...new Set(attendances.map((a) => a.studentId))];
        byStudent = {};

        for (const sid of studentIds) {
          const studentAttendances = attendances.filter((a) => a.studentId === sid);
          const studentTotal = studentAttendances.length;
          const studentPresent = studentAttendances.filter((a) => a.status === "PRESENT").length;
          const studentLate = studentAttendances.filter((a) => a.status === "LATE").length;
          const studentPresentEquivalent = studentPresent + studentLate;

          byStudent[sid] = {
            total: studentTotal,
            present: studentPresent,
            absent: studentAttendances.filter((a) => a.status === "ABSENT").length,
            late: studentLate,
            excused: studentAttendances.filter((a) => a.status === "EXCUSED").length,
            presentRate:
              studentTotal > 0
                ? ((studentPresentEquivalent / studentTotal) * 100).toFixed(2)
                : "0",
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
    };

    const response = await withCache(handler as any, { ttl: CACHE_TTL_SHORT, key: cacheKey });
    return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_SHORT, staleWhileRevalidate: 15 });
  } catch (error) {
    logger.error(" fetching attendance stats:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
}
