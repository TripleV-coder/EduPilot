import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { roundTo } from "@/lib/analytics/helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { getOwnStudentIds } from "@/lib/auth/family-scope";
import {
  aggregateGradeStatistics,
  averageGrade,
  rankStudents,
  type GradeBucket,
  type GradeStatsScope,
} from "@/lib/services/grade-statistics";

/** Rôles qui voient le classement nominatif de n'importe quelle classe de leur établissement. */
const RANKING_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

function roundBuckets(buckets: Record<string, GradeBucket>): Record<string, GradeBucket> {
  return Object.fromEntries(
    Object.entries(buckets).map(([key, value]) => [key, { ...value, average: roundTo(value.average) }])
  );
}

/** Enseignant de la classe : une de ses matières, ou professeur principal. */
async function teachesClass(userId: string, classId: string): Promise<boolean> {
  const [subjects, main] = await Promise.all([
    prisma.classSubject.count({ where: { classId, teacher: { userId } } }),
    prisma.class.count({ where: { id: classId, mainTeacher: { userId } } }),
  ]);
  return subjects + main > 0;
}

/**
 * GET /api/grades/statistics — statistiques de notes.
 *
 * Agrégats calculés en base (C3). Périmètre (N10) : établissement actif ;
 * un PARENT n'accède qu'aux notes de ses enfants, un STUDENT qu'aux siennes ;
 * le classement nominatif (type=class) est réservé à la direction et aux
 * enseignants de la classe — les autres ne reçoivent que le rang demandé.
 */
export const GET = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
    if (!session?.user) {
      return NextResponse.json(
        { error: "Non authentifié", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId");
    const periodId = searchParams.get("periodId");
    const type = searchParams.get("type"); // "student" | "class" | "subject"
    const role = session.user.role;
    const activeSchoolId = getActiveSchoolId(session);

    if (role !== "SUPER_ADMIN" && !activeSchoolId) {
      return NextResponse.json(
        { error: "Accès refusé : aucun établissement associé", code: "NO_SCHOOL" },
        { status: 403 }
      );
    }

    // Périmètre famille (N10)
    const ownStudentIds = await getOwnStudentIds(role, session.user.id);
    if (ownStudentIds !== null && studentId && !ownStudentIds.includes(studentId)) {
      return NextResponse.json(
        { error: "Accès refusé : cet élève n'est pas dans votre périmètre", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    const studentIds = studentId ? [studentId] : ownStudentIds;

    const scope: GradeStatsScope = {
      schoolId: role === "SUPER_ADMIN" ? null : activeSchoolId,
      classId,
      subjectId,
      periodId,
      studentIds,
    };

    const stats = await aggregateGradeStatistics(scope);

    let trend: "up" | "down" | "stable" | null = null;
    if (periodId && stats.totalGrades > 0) {
      const currentPeriod = await prisma.period.findUnique({
        where: { id: periodId },
        select: { academicYearId: true, sequence: true },
      });
      const previousPeriod = currentPeriod
        ? await prisma.period.findFirst({
            where: { academicYearId: currentPeriod.academicYearId, sequence: { lt: currentPeriod.sequence } },
            orderBy: { sequence: "desc" },
            select: { id: true },
          })
        : null;
      if (previousPeriod) {
        const previousAverage = await averageGrade({ ...scope, periodId: previousPeriod.id });
        if (previousAverage !== null) {
          if (stats.average > previousAverage + 0.5) trend = "up";
          else if (stats.average < previousAverage - 0.5) trend = "down";
          else trend = "stable";
        }
      }
    }

    let ranking:
      | {
          totalStudents: number;
          rank: number | null;
          topStudent: ReturnType<typeof roundRanked> | null;
          bottomStudent: ReturnType<typeof roundRanked> | null;
          students?: Array<ReturnType<typeof roundRanked>>;
        }
      | null = null;

    if (type === "class" && classId) {
      const ranked = (
        await rankStudents({ schoolId: scope.schoolId, classId, periodId })
      ).map(roundRanked);
      const focusId = studentId ?? (role === "STUDENT" ? ownStudentIds?.[0] ?? null : null);
      const rankIndex = focusId ? ranked.findIndex((student) => student.studentId === focusId) : -1;
      const canSeeNames =
        roleSatisfies(role, RANKING_ROLES) || (role === "TEACHER" && (await teachesClass(session.user.id, classId)));

      ranking = canSeeNames
        ? {
            totalStudents: ranked.length,
            rank: rankIndex >= 0 ? rankIndex + 1 : null,
            topStudent: ranked[0] ?? null,
            bottomStudent: ranked[ranked.length - 1] ?? null,
            students: ranked,
          }
        : {
            totalStudents: ranked.length,
            rank: rankIndex >= 0 ? rankIndex + 1 : null,
            topStudent: null,
            bottomStudent: null,
          };
    }

    return NextResponse.json({
      statistics: {
        ...stats,
        average: roundTo(stats.average),
        highest: roundTo(stats.highest),
        lowest: roundTo(stats.lowest),
        passRate: roundTo(stats.passRate),
        bySubject: roundBuckets(stats.bySubject),
        byType: roundBuckets(stats.byType),
      },
      trend,
      ranking,
    });
  } catch (error) {
    logger.error("Error fetching grade statistics", error as Error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des statistiques",
        code: "STATISTICS_ERROR",
      },
      { status: 500 }
    );
  }

  }
);

function roundRanked(student: { studentId: string; studentName: string; average: number; gradeCount: number }) {
  return { ...student, average: roundTo(student.average) };
}
