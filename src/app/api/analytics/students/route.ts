import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, RiskLevel } from "@prisma/client";
import { persistStudentAnalyticsSnapshot } from "@/lib/services/analytics-sync";
import { dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { CACHE_TTL_SHORT, generateCacheKey, withCache } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

/**
 * GET /api/analytics/students
 * Obtenir les analytics des élèves
 */
/** C3 : liste toujours bornée (défaut 200, plafond 500) et sans détail superflu. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const RISK_SEVERITY: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

/** Champs lus par les écrans (risques, nuage assiduité/notes, tableaux) — rien de plus. */
const ANALYTICS_LIST_SELECT = {
  id: true,
  studentId: true,
  periodId: true,
  academicYearId: true,
  generalAverage: true,
  classRank: true,
  classSize: true,
  performanceLevel: true,
  riskLevel: true,
  riskFactors: true,
  analyzedAt: true,
  period: { select: { name: true, sequence: true } },
  student: {
    select: {
      user: { select: { firstName: true, lastName: true } },
      enrollments: {
        where: { status: "ACTIVE" as const, deletedAt: null },
        select: { class: { select: { name: true } } },
        take: 1,
      },
    },
  },
} satisfies Prisma.StudentAnalyticsSelect;

type RiskSortable = { riskLevel: string; generalAverage: Prisma.Decimal | number | null; studentId: string };

/** Plus grand risque d'abord, puis plus faible moyenne (sans moyenne : en dernier). */
function byRiskThenAverage(left: RiskSortable, right: RiskSortable): number {
  const severity = (RISK_SEVERITY[right.riskLevel] ?? 0) - (RISK_SEVERITY[left.riskLevel] ?? 0);
  if (severity !== 0) return severity;
  const a = left.generalAverage === null ? Number.POSITIVE_INFINITY : Number(left.generalAverage);
  const b = right.generalAverage === null ? Number.POSITIVE_INFINITY : Number(right.generalAverage);
  if (a !== b) return a < b ? -1 : 1;
  return left.studentId.localeCompare(right.studentId);
}

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const url = new URL(request.url);
    const { searchParams } = url;
    const studentId = searchParams.get("studentId");
    const periodId = searchParams.get("periodId");
    const academicYearId = searchParams.get("academicYearId");
    const riskLevel = searchParams.get("riskLevel");
    const latestOnlyParam = searchParams.get("latestOnly");
    const limitParam = searchParams.get("limit");
    const classId = searchParams.get("classId");

    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);
    const handler = async () => {
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : null;
    const limit = Math.min(
      MAX_LIMIT,
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT
    );
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
    if (riskLevel) where.riskLevel = riskLevel as RiskLevel;
    if (classId) {
      where.student = {
        ...(where.student as Prisma.StudentProfileWhereInput | undefined),
        enrollments: { some: { classId, status: "ACTIVE", deletedAt: null } },
      };
    }

    // Dernière analyse par élève calculée en base (distinct) ; le tri par
    // risque précède la limite : les élèves les plus à risque ne sont jamais
    // écartés (C3).
    const analytics = latestOnly
      ? await prisma.studentAnalytics.findMany({
          where,
          select: ANALYTICS_LIST_SELECT,
          distinct: ["studentId"],
          orderBy: [{ studentId: "asc" }, { period: { sequence: "desc" } }, { analyzedAt: "desc" }],
        })
      : await prisma.studentAnalytics.findMany({
          where,
          select: ANALYTICS_LIST_SELECT,
          orderBy: [{ riskLevel: "desc" }, { generalAverage: "asc" }, { period: { sequence: "desc" } }],
          take: limit,
        });

    const selectedAnalytics = latestOnly ? dedupeLatestAnalyticsByStudent(analytics) : analytics;
    const limitedAnalytics = [...selectedAnalytics].sort(byRiskThenAverage).slice(0, limit);

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

      const { student, period, ...fields } = item;
      const average = item.generalAverage !== null ? Number(item.generalAverage) : null;
      return {
        ...fields,
        generalAverage: average,
        periodName: period?.name ?? null,
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        className: student.enrollments?.[0]?.class?.name ?? null,
        averageGrade: average,
        absenceCount: absenceMap.get(item.studentId) ?? 0,
        attendanceRate,
      };
    });

    return NextResponse.json(response);
    };

    const response = await withCache(handler, { ttl: CACHE_TTL_SHORT, key: cacheKey });
    return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_SHORT, staleWhileRevalidate: 15 });
  
    } catch (error) {
    logger.error(" fetching analytics:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

});

/**
 * POST /api/analytics/students
 * Générer les analytics pour un élève sur une période
 */
export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!roleSatisfies(session.user.role, allowedRoles)) {
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

});
