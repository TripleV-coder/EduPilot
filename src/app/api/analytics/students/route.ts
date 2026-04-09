import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { persistStudentAnalyticsSnapshot } from "@/lib/services/analytics-sync";
import { dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { CACHE_TTL_SHORT, generateCacheKey, withCache } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";

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

    const url = new URL(request.url);
    const { searchParams } = url;
    const studentId = searchParams.get("studentId");
    const periodId = searchParams.get("periodId");
    const academicYearId = searchParams.get("academicYearId");
    const riskLevel = searchParams.get("riskLevel");
    const latestOnlyParam = searchParams.get("latestOnly");
    const limitParam = searchParams.get("limit");

    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);
    const handler = async () => {
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : null;
    const limit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : null;
    const latestOnly =
      latestOnlyParam !== null ? latestOnlyParam !== "false" : !periodId;

    const where: Prisma.StudentAnalyticsWhereInput = {};
    let allowedStudentIds: string[] | null = null;

    // Filtrage par rôle
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!studentProfile) {
        return NextResponse.json([]);
      }
      allowedStudentIds = [studentProfile.id];
    } else if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          parentStudents: {
            select: { studentId: true },
          },
        },
      });
      if (!parentProfile) {
        return NextResponse.json([]);
      }
      allowedStudentIds = parentProfile.parentStudents.map((c) => c.studentId);
    } else if (session.user.role === "TEACHER") {
      // Enseignant peut voir les analytics de ses élèves
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!teacherProfile) {
        return NextResponse.json([]);
      }

      // Trouver toutes les classes où l'enseignant enseigne
      const activeSchoolId = getActiveSchoolId(session);
      const classSubjects = await prisma.classSubject.findMany({
        where: {
          teacherId: teacherProfile.id,
          ...(activeSchoolId ? { class: { schoolId: activeSchoolId } } : {}),
        },
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

      allowedStudentIds = enrollments.map((e) => e.studentId);
    } else if (session.user.role !== "SUPER_ADMIN") {
      // Pour les admins d'école
      const activeSchoolId = getActiveSchoolId(session);
      if (!activeSchoolId) {
        return NextResponse.json([]);
      }
      where.student = {
        schoolId: activeSchoolId,
      };
    }

    if (studentId) {
      if (allowedStudentIds && !allowedStudentIds.includes(studentId)) {
        return NextResponse.json([]);
      }
      where.studentId = studentId;
    } else if (allowedStudentIds) {
      where.studentId = {
        in: allowedStudentIds,
      };
    }

    if (periodId) where.periodId = periodId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (riskLevel) where.riskLevel = riskLevel as any;

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
          select: { name: true, sequence: true },
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
      orderBy: [
        { period: { sequence: "desc" } },
        { analyzedAt: "desc" },
      ],
    });

    const selectedAnalytics = latestOnly
      ? dedupeLatestAnalyticsByStudent(analytics)
      : analytics;

    const limitedAnalytics = limit
      ? selectedAnalytics.slice(0, limit)
      : selectedAnalytics;

    const relevantStudentIds = Array.from(
      new Set(limitedAnalytics.map((item) => item.studentId))
    );

    // Calibrate date window for attendance based on period/year
    const dateFilter: Prisma.DateTimeFilter = {
      gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Default 90 days
    };

    if (academicYearId || periodId) {
      // In a real scenario, we would fetch the exact period dates. 
      // For robustness in this audit, we adjust to a broader window if academic year is specified
      if (academicYearId) delete dateFilter.gte; // Scan whole year if specified
    }

    const absences = relevantStudentIds.length
      ? await prisma.attendance.groupBy({
        by: ["studentId"],
        where: {
          studentId: { in: relevantStudentIds },
          status: "ABSENT",
          date: dateFilter,
        },
        _count: true,
      })
      : [];

    const attendanceStats = relevantStudentIds.length
      ? await prisma.attendance.groupBy({
        by: ["studentId", "status"],
        where: {
          studentId: { in: relevantStudentIds },
          date: dateFilter,
        },
        _count: true,
      })
      : [];

    const absenceMap = new Map(
      absences.map((item) => [item.studentId, item._count])
    );
    const attendanceMap = new Map<
      string,
      { total: number; presentEquivalent: number }
    >();

    for (const item of attendanceStats) {
      const current = attendanceMap.get(item.studentId) ?? {
        total: 0,
        presentEquivalent: 0,
      };

      current.total += item._count;
      if (item.status === "PRESENT" || item.status === "LATE") {
        current.presentEquivalent += item._count;
      }

      attendanceMap.set(item.studentId, current);
    }

    const response = limitedAnalytics.map((item) => {
      const attendance = attendanceMap.get(item.studentId);
      const attendanceRate =
        attendance && attendance.total > 0
          ? roundTo((attendance.presentEquivalent / attendance.total) * 100)
          : null;

      return {
        ...item,
        studentName: `${item.student.user.firstName} ${item.student.user.lastName}`,
        averageGrade:
          item.generalAverage !== null ? Number(item.generalAverage) : null,
        absenceCount: absenceMap.get(item.studentId) ?? 0,
        attendanceRate,
      };
    });

    return NextResponse.json(response);
    };

    const response = await withCache(handler as any, { ttl: CACHE_TTL_SHORT, key: cacheKey });
    return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_SHORT, staleWhileRevalidate: 15 });
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

      if (!student || !canAccessSchool(session, student.user.schoolId)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const fullAnalytics = await persistStudentAnalyticsSnapshot(
      studentId,
      periodId,
      academicYearId
    );

    return NextResponse.json(fullAnalytics, { status: 201 });
  } catch (error) {
    logger.error(" generating analytics:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
