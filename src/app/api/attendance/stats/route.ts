import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { CACHE_TTL_SHORT, generateCacheKey, withCache } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { parseDateRangeParams } from "@/lib/validations/date-range";

/**
 * GET /api/attendance/stats
 * Get attendance statistics
 */
export const GET = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
const url = new URL(request.url);
    const { searchParams } = url;
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const dateRange = parseDateRangeParams(searchParams);
    if (!dateRange.success) return dateRange.response;
    const { startDate, endDate } = dateRange;
    const activeSchoolId = getActiveSchoolId(session);

    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);
    const handler = async (): Promise<NextResponse> => {
      const where: Prisma.AttendanceWhereInput = {};

      if (studentId) where.studentId = studentId;
      if (classId) where.classId = classId;

      if (startDate || endDate) {
        where.date = {};
        if (startDate) (where.date as Prisma.DateTimeFilter).gte = startDate;
        if (endDate) (where.date as Prisma.DateTimeFilter).lte = endDate;
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
        if (!activeSchoolId) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
        where.student = {
          schoolId: activeSchoolId,
          user: { isActive: true }
        };
      }

      // Audit M5 : comptage par PostgreSQL (une ligne par élève et par statut)
      // au lieu de charger toutes les présences de l'établissement — une ligne
      // par élève et par jour, soit ~180 000 lignes par an pour 1 000 élèves.
      const counts = await prisma.attendance.groupBy({
        by: ["studentId", "status"],
        where,
        _count: { _all: true },
      });

      const emptyTally = () => ({ total: 0, present: 0, absent: 0, late: 0, excused: 0 });
      const totals = emptyTally();
      const perStudent = new Map<string, ReturnType<typeof emptyTally>>();
      for (const row of counts) {
        const count = row._count._all;
        const studentTally = perStudent.get(row.studentId) ?? emptyTally();
        perStudent.set(row.studentId, studentTally);
        for (const tally of [totals, studentTally]) {
          tally.total += count;
          if (row.status === "PRESENT") tally.present += count;
          else if (row.status === "ABSENT") tally.absent += count;
          else if (row.status === "LATE") tally.late += count;
          else if (row.status === "EXCUSED") tally.excused += count;
        }
      }

      // Calculate statistics
      const { total, present, absent, late, excused } = totals;

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
      if (!studentId && total > 0) {
        byStudent = {};

        for (const [sid, studentTally] of perStudent) {
          byStudent[sid] = {
            ...studentTally,
            presentRate:
              studentTally.total > 0
                ? (((studentTally.present + studentTally.late) / studentTally.total) * 100).toFixed(2)
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

    const response = await withCache(handler, { ttl: CACHE_TTL_SHORT, key: cacheKey });
    return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_SHORT, staleWhileRevalidate: 15 });
  } catch (error) {
    logger.error(" fetching attendance stats:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }

  }
);
