// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";
import { countTeachersForSchool } from "@/lib/teachers/school-assignments";
import type { AnalyticsWithDetails } from "./types";
import {
  buildPerformanceDistribution,
  buildRiskDistribution,
  buildSubjectSummary,
  buildAtRiskStudents,
} from "./builders";

async function buildSiteComparison(input: {
  rootSchoolId: string;
  yearId: string;
  filterClassId?: string;
  filterPeriodId?: string;
  filterSubjectId?: string;
  networkSchoolIds?: string[];
}) {
  const [referenceYear, referencePeriod, referenceSubject, referenceClass] = await Promise.all([
    prisma.academicYear.findUnique({
      where: { id: input.yearId },
      select: { id: true, name: true },
    }),
    input.filterPeriodId
      ? prisma.period.findUnique({
          where: { id: input.filterPeriodId },
          select: { id: true, name: true, sequence: true },
        })
      : Promise.resolve(null),
    input.filterSubjectId
      ? prisma.subject.findUnique({
          where: { id: input.filterSubjectId },
          select: { id: true, schoolId: true, name: true, code: true },
        })
      : Promise.resolve(null),
    input.filterClassId
      ? prisma.class.findUnique({
          where: { id: input.filterClassId },
          select: {
            id: true,
            schoolId: true,
            name: true,
            classLevel: {
              select: {
                code: true,
                name: true,
                level: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!referenceYear) {
    return [];
  }

  if (input.filterPeriodId && !referencePeriod) {
    return [];
  }

  if (input.filterSubjectId && (!referenceSubject || referenceSubject.schoolId !== input.rootSchoolId)) {
    return [];
  }

  if (input.filterClassId && (!referenceClass || referenceClass.schoolId !== input.rootSchoolId)) {
    return [];
  }

  const rootSchool = await prisma.school.findUnique({
    where: { id: input.rootSchoolId },
    select: {
      id: true,
      name: true,
      city: true,
      organizationId: true,
      parentSchoolId: true,
      siteType: true,
    },
  });

  if (!rootSchool) {
    return [];
  }

  let networkSchoolIds = Array.from(
    new Set(
      [input.rootSchoolId, ...(input.networkSchoolIds || [])]
        .filter((schoolId): schoolId is string => typeof schoolId === "string" && schoolId.length > 0)
    )
  );

  if (networkSchoolIds.length <= 1 && rootSchool.siteType === "MAIN") {
    const childSchools = await prisma.school.findMany({
      where: { parentSchoolId: input.rootSchoolId },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    networkSchoolIds = [input.rootSchoolId, ...childSchools.map((school) => school.id)];
  }

  if (rootSchool.organizationId) {
    const organizationSchools = await prisma.school.findMany({
      where: { organizationId: rootSchool.organizationId },
      select: { id: true },
    });
    const allowedSchoolIds = new Set(organizationSchools.map((school) => school.id));
    networkSchoolIds = networkSchoolIds.filter((schoolId) => allowedSchoolIds.has(schoolId));
  } else {
    const networkRootId = rootSchool.parentSchoolId ?? (rootSchool.siteType === "MAIN" ? rootSchool.id : null);

    if (networkRootId) {
      const hierarchySchools = await prisma.school.findMany({
        where: {
          OR: [
            { id: networkRootId },
            { parentSchoolId: networkRootId },
          ],
        },
        select: { id: true },
      });
      const allowedSchoolIds = new Set(hierarchySchools.map((school) => school.id));
      networkSchoolIds = networkSchoolIds.filter((schoolId) => allowedSchoolIds.has(schoolId));
    }
  }

  networkSchoolIds = Array.from(new Set([input.rootSchoolId, ...networkSchoolIds]));

  if (networkSchoolIds.length <= 1) {
    return [];
  }

  const schoolsById = new Map(
    (
      await prisma.school.findMany({
        where: { id: { in: networkSchoolIds } },
        select: {
          id: true,
          name: true,
          city: true,
        },
      })
    ).map((school) => [school.id, school] as const)
  );

  const schools = networkSchoolIds
    .map((schoolId) => schoolsById.get(schoolId))
    .filter((school): school is { id: string; name: string; city: string | null } => Boolean(school));

  if (schools.length <= 1) {
    return [];
  }

  return Promise.all(
    schools.map(async (school) => {
      const schoolYear =
        school.id === input.rootSchoolId
          ? await prisma.academicYear.findUnique({
              where: { id: input.yearId },
              select: { id: true, startDate: true, endDate: true },
            })
          : await prisma.academicYear.findFirst({
              where: {
                schoolId: school.id,
                OR: [
                  { name: referenceYear.name },
                  { isCurrent: true },
                ],
              },
              orderBy: [
                { isCurrent: "desc" },
                { startDate: "desc" },
              ],
              select: { id: true, startDate: true, endDate: true },
            });

      if (!schoolYear) {
        return {
          id: school.id,
          name: school.name,
          city: school.city || "Indisponible",
          studentCount: 0,
          averageGrade: 0,
          attendanceRate: 0,
          passRate: 0,
          topSubject: null as string | null,
          comparisonNote: "Année académique non trouvée sur ce site",
        };
      }

      const [schoolPeriod, schoolSubject, schoolClass] = await Promise.all([
        referencePeriod
          ? school.id === input.rootSchoolId
            ? Promise.resolve(referencePeriod)
            : prisma.period.findFirst({
                where: {
                  academicYearId: schoolYear.id,
                  OR: [
                    { sequence: referencePeriod.sequence },
                    { name: referencePeriod.name },
                  ],
                },
                orderBy: { sequence: "asc" },
                select: { id: true, name: true, sequence: true },
              })
          : Promise.resolve(null),
        referenceSubject
          ? school.id === input.rootSchoolId
            ? Promise.resolve(referenceSubject)
            : prisma.subject.findFirst({
                where: {
                  schoolId: school.id,
                  OR: [
                    { code: referenceSubject.code },
                    { name: referenceSubject.name },
                  ],
                },
                select: { id: true, name: true, code: true },
              })
          : Promise.resolve(null),
        referenceClass
          ? school.id === input.rootSchoolId
            ? Promise.resolve(referenceClass)
            : prisma.class.findFirst({
                where: {
                  schoolId: school.id,
                  deletedAt: null,
                  OR: [
                    {
                      name: referenceClass.name,
                      classLevel: {
                        is: { code: referenceClass.classLevel.code },
                      },
                    },
                    {
                      name: referenceClass.name,
                      classLevel: {
                        is: {
                          name: referenceClass.classLevel.name,
                          level: referenceClass.classLevel.level,
                        },
                      },
                    },
                  ],
                },
                select: { id: true, name: true },
              })
          : Promise.resolve(null),
      ]);

      if (input.filterPeriodId && !schoolPeriod) {
        return {
          id: school.id,
          name: school.name,
          city: school.city || "Indisponible",
          studentCount: 0,
          averageGrade: 0,
          attendanceRate: 0,
          passRate: 0,
          topSubject: null as string | null,
          comparisonNote: "Période non configurée sur ce site",
        };
      }

      if (input.filterSubjectId && !schoolSubject) {
        return {
          id: school.id,
          name: school.name,
          city: school.city || "Indisponible",
          studentCount: 0,
          averageGrade: 0,
          attendanceRate: 0,
          passRate: 0,
          topSubject: null as string | null,
          comparisonNote: "Matière équivalente introuvable",
        };
      }

      if (input.filterClassId && !schoolClass) {
        return {
          id: school.id,
          name: school.name,
          city: school.city || "Indisponible",
          studentCount: 0,
          averageGrade: 0,
          attendanceRate: 0,
          passRate: 0,
          topSubject: schoolSubject?.name || null,
          comparisonNote: "Classe équivalente introuvable",
        };
      }

      const enrollmentScope = schoolClass
        ? {
            enrollments: {
              some: {
                classId: schoolClass.id,
                academicYearId: schoolYear.id,
                status: "ACTIVE" as const,
              },
            },
          }
        : {};

      const [studentCount, analytics, attendanceStats] = await Promise.all([
        schoolClass
          ? prisma.enrollment.count({
              where: {
                classId: schoolClass.id,
                academicYearId: schoolYear.id,
                status: "ACTIVE",
              },
            })
          : prisma.studentProfile.count({
              where: { schoolId: school.id, deletedAt: null },
            }),
        prisma.studentAnalytics.findMany({
          where: {
            academicYearId: schoolYear.id,
            ...(schoolPeriod ? { periodId: schoolPeriod.id } : {}),
            student: {
              schoolId: school.id,
              ...enrollmentScope,
            },
          },
          include: {
            period: { select: { id: true, name: true, sequence: true } },
            subjectPerformances: { include: { subject: { select: { name: true } } } },
          },
        }),
        prisma.attendance.groupBy({
          by: ["status"],
          where: {
            student: {
              schoolId: school.id,
              ...enrollmentScope,
            },
            date: {
              gte: schoolYear.startDate,
              lte: schoolYear.endDate,
            },
          },
          _count: true,
        }),
      ]);

      const currentAnalytics = input.filterPeriodId ? analytics : dedupeLatestAnalyticsByStudent(analytics);
      const subjectScores = schoolSubject
        ? currentAnalytics.flatMap((item) =>
            item.subjectPerformances
              .filter((performance) => performance.subjectId === schoolSubject.id && performance.average !== null)
              .map((performance) => Number(performance.average))
          )
        : [];

      const scoredAnalytics = schoolSubject
        ? []
        : currentAnalytics.filter((item) => item.generalAverage !== null);
      const averageGrade = schoolSubject
        ? subjectScores.length > 0
          ? subjectScores.reduce((sum, value) => sum + value, 0) / subjectScores.length
          : 0
        : scoredAnalytics.length > 0
          ? scoredAnalytics.reduce((sum, item) => sum + Number(item.generalAverage), 0) / scoredAnalytics.length
          : 0;
      const passRate = schoolSubject
        ? subjectScores.length > 0
          ? (subjectScores.filter((value) => value >= 10).length / subjectScores.length) * 100
          : 0
        : scoredAnalytics.length > 0
          ? (scoredAnalytics.filter((item) => Number(item.generalAverage) >= 10).length / scoredAnalytics.length) * 100
          : 0;

      const attendanceTotal = attendanceStats.reduce((sum, item) => sum + item._count, 0);
      const attendancePresent =
        (attendanceStats.find((item) => item.status === "PRESENT")?._count || 0) +
        (attendanceStats.find((item) => item.status === "LATE")?._count || 0);
      const attendanceRate = attendanceTotal > 0 ? (attendancePresent / attendanceTotal) * 100 : 0;
      const topSubject = schoolSubject
        ? schoolSubject.name
        : buildSubjectSummary(currentAnalytics)[0]?.name || null;

      return {
        id: school.id,
        name: school.name,
        city: school.city || "Indisponible",
        studentCount,
        averageGrade: roundTo(averageGrade),
        attendanceRate: roundTo(attendanceRate),
        passRate: roundTo(passRate),
        topSubject,
        comparisonNote: null as string | null,
      };
    })
  );
}

export async function getAdminDashboardData(
  schoolId: string,
  yearId: string,
  filterClassId?: string,
  filterPeriodId?: string,
  filterSubjectId?: string,
  comparisonSchoolIds?: string[]
) {
  const [totalStudents, totalTeachers, totalClasses, schoolData] = await Promise.all([
    prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
    countTeachersForSchool(schoolId),
    prisma.class.count({ where: { schoolId, deletedAt: null } }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        siteType: true,
        _count: { select: { childSchools: true } },
      }
    }),
  ]);

  const normalizedComparisonSchoolIds = Array.from(
    new Set(
      [schoolId, ...(comparisonSchoolIds || [])]
        .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0)
    )
  );
  const annexesCount =
    normalizedComparisonSchoolIds.length > 1
      ? normalizedComparisonSchoolIds.length - 1
      : schoolData?._count?.childSchools || 0;

  let filterStudentIds: string[] | undefined;
  if (filterClassId) {
    const classEnrollments = await prisma.enrollment.findMany({
      where: { classId: filterClassId, academicYearId: yearId, status: "ACTIVE" },
      select: { studentId: true },
    });
    filterStudentIds = classEnrollments.map(e => e.studentId);
  }

  const analyticsWhere: Prisma.StudentAnalyticsWhereInput = { academicYearId: yearId, student: { schoolId } };
  if (filterStudentIds) analyticsWhere.studentId = { in: filterStudentIds };
  if (filterPeriodId) analyticsWhere.periodId = filterPeriodId;

  const analytics = await prisma.studentAnalytics.findMany({
    where: analyticsWhere,
    include: {
      period: { select: { id: true, name: true, sequence: true } },
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          enrollments: {
            where: { academicYearId: yearId, status: "ACTIVE" },
            include: { class: { select: { name: true } } },
          },
        },
      },
      subjectPerformances: { include: { subject: { select: { name: true } } } },
    },
  });

  const currentAnalytics = filterPeriodId ? analytics : dedupeLatestAnalyticsByStudent(analytics);
  const scoredCurrentAnalytics = currentAnalytics.filter(item => item.generalAverage !== null);

  const averageGrade = scoredCurrentAnalytics.length > 0
    ? scoredCurrentAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / scoredCurrentAnalytics.length
    : 0;

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: yearId },
    select: { startDate: true, endDate: true },
  });

  const attendanceWhere: Prisma.AttendanceWhereInput = {
    student: { schoolId },
    date: {
      gte: academicYear?.startDate ?? new Date(new Date().getFullYear(), 0, 1),
      lte: academicYear?.endDate ?? new Date(),
    },
  };
  if (filterStudentIds) attendanceWhere.studentId = { in: filterStudentIds };

  const attendanceStats = await prisma.attendance.groupBy({
    by: ["status"],
    where: attendanceWhere,
    _count: true,
  });

  const attendanceDistribution = {
    present: attendanceStats.find(a => a.status === "PRESENT")?._count || 0,
    absent: attendanceStats.find(a => a.status === "ABSENT")?._count || 0,
    late: attendanceStats.find(a => a.status === "LATE")?._count || 0,
    excused: attendanceStats.find(a => a.status === "EXCUSED")?._count || 0,
  };

  const totalAttendance = Object.values(attendanceDistribution).reduce((s, v) => s + v, 0);
  const attendanceRate = totalAttendance > 0
    ? ((attendanceDistribution.present + attendanceDistribution.late) / totalAttendance) * 100
    : 0;

  const passRate = scoredCurrentAnalytics.length > 0
    ? (scoredCurrentAnalytics.filter(a => Number(a.generalAverage) >= 10).length / scoredCurrentAnalytics.length) * 100
    : 0;

  const failureRate = scoredCurrentAnalytics.length > 0
    ? (scoredCurrentAnalytics.filter(a => Number(a.generalAverage) < 10).length / scoredCurrentAnalytics.length) * 100
    : 0;

  const [droppedStudentsCount, studentsInSchoolCount, recentActivity] = await Promise.all([
    prisma.enrollment.count({
      where: { class: { schoolId }, academicYearId: yearId, status: { in: ["DROPPED", "SUSPENDED"] } }
    }),
    prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
    prisma.auditLog.findMany({
      where: { schoolId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true } } }
    })
  ]);

  const dropoutRate = studentsInSchoolCount > 0 ? (droppedStudentsCount / studentsInSchoolCount) * 100 : 0;

  const [pendingPayments, paymentsReceived] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "PENDING", fee: { schoolId }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "VERIFIED", fee: { schoolId }, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const performanceDistribution = buildPerformanceDistribution(currentAnalytics);
  const riskDistribution = buildRiskDistribution(currentAnalytics);
  const subjectSummary = buildSubjectSummary(currentAnalytics, filterSubjectId);

  const enrollments = await prisma.enrollment.findMany({
    where: { academicYearId: yearId, status: "ACTIVE", class: { schoolId } },
    select: { studentId: true, classId: true, class: { select: { name: true } } },
  });

  const classMap: Record<string, { name: string; totals: number; count: number; students: Set<string> }> = {};
  for (const enr of enrollments) {
    if (!classMap[enr.classId]) {
      classMap[enr.classId] = { name: enr.class.name, totals: 0, count: 0, students: new Set() };
    }
    classMap[enr.classId].students.add(enr.studentId);
  }

  for (const a of currentAnalytics) {
    if (a.generalAverage === null) continue;
    for (const [classId, data] of Object.entries(classMap)) {
      if (data.students.has(a.studentId)) {
        data.totals += Number(a.generalAverage);
        data.count += 1;
      }
    }
  }

  const classSummary = Object.values(classMap)
    .map(c => ({
      name: c.name,
      average: c.count > 0 ? roundTo(c.totals / c.count) : 0,
      studentCount: c.students.size,
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 10);

  const periods = await prisma.period.findMany({
    where: { academicYearId: yearId },
    orderBy: { sequence: "asc" },
  });

  const monthlyTrend = periods.map(period => {
    const periodAnalytics = analytics.filter(a => a.periodId === period.id && a.generalAverage !== null);
    const avg = periodAnalytics.length > 0
      ? periodAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / periodAnalytics.length
      : 0;
    return { name: period.name, value: roundTo(avg) };
  });

  const atRiskStudents = buildAtRiskStudents(currentAnalytics, yearId);

  // Calculate realistic growths
  const currentMonthAvg = monthlyTrend[monthlyTrend.length - 1]?.value || 0;
  const previousMonthAvg = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2].value : currentMonthAvg;
  const averageGrowth = previousMonthAvg > 0 ? roundTo(((currentMonthAvg - previousMonthAvg) / previousMonthAvg) * 100) : 0;
  
  // Approximation légère: on mesure la croissance du mois courant via les créations récentes
  // pour éviter des historiques volumineux sur chaque chargement du dashboard.
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const newStudentsThisMonth = await prisma.studentProfile.count({
    where: { schoolId, createdAt: { gte: startOfMonth } }
  });
  const prevStudentsCount = Math.max(1, totalStudents - newStudentsThisMonth);
  const studentGrowth = roundTo((newStudentsThisMonth / prevStudentsCount) * 100);

  // Calculate real attendance growth vs previous month
  const prevMonthStart = new Date(startOfMonth);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
  const prevMonthEnd = new Date(startOfMonth);
  prevMonthEnd.setSeconds(-1);

  const prevAttendanceStats = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      student: { schoolId },
      date: { gte: prevMonthStart, lte: prevMonthEnd },
    },
    _count: true,
  });

  const prevTotalAttendance = prevAttendanceStats.reduce((s, v) => s + v._count, 0);
  const prevAttendanceRate = prevTotalAttendance > 0
    ? (( (prevAttendanceStats.find(a => a.status === "PRESENT")?._count || 0) + (prevAttendanceStats.find(a => a.status === "LATE")?._count || 0) ) / prevTotalAttendance) * 100
    : attendanceRate; // Fallback to current if no data in prev month

  const attendanceGrowth = roundTo(attendanceRate - prevAttendanceRate);
  const siteComparison = await buildSiteComparison({
    rootSchoolId: schoolId,
    yearId,
    filterClassId,
    filterPeriodId,
    filterSubjectId,
    networkSchoolIds: normalizedComparisonSchoolIds,
  });

  return {
    totalStudents,
    totalTeachers,
    totalClasses,
    averageGrade: roundTo(averageGrade),
    attendanceRate: roundTo(attendanceRate),
    passRate: roundTo(passRate),
    failureRate: roundTo(failureRate),
    dropoutRate: roundTo(dropoutRate),
    pendingPayments: Number(pendingPayments._sum.amount || 0),
    paymentsReceived: Number(paymentsReceived._sum.amount || 0),
    studentGrowth, 
    attendanceGrowth,
    averageGrowth,
    activeAlerts: atRiskStudents.length,
    performanceDistribution,
    riskDistribution,
    attendanceDistribution,
    subjectSummary,
    classSummary,
    monthlyTrend,
    atRiskStudents,
    recentActivity,
    annexesCount,
    siteComparison,
  };
}

export async function getGlobalDashboardData(yearId?: string, filterClassId?: string, filterPeriodId?: string, filterSubjectId?: string) {
  // FETCH STRICTLY METRICS PERTAINING TO SAAS INFRASTRUCTURE.
  // DO NOT fetch students, grades, payments, or attendance for the Super Admin, as per GDPR limits.

  const [totalSchools, totalUsers, recentSchools, recentActivity] = await Promise.all([
    prisma.school.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, role: { not: "SUPER_ADMIN" } } }),
    prisma.school.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, city: true, isActive: true }
    }),
    prisma.auditLog.findMany({
      where: { schoolId: null }, // Only see global administrative logs, not school-specific operations
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true } } }
    })
  ]);

  // Per-school SaaS counters (counts only — no PII, no academic data).
  // Respects the GDPR boundary noted above: we only ask "how many accounts
  // exist on each tenant" so the SuperAdmin can monitor adoption.
  const allActiveSchools = await prisma.school.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: true, isActive: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  const networkSchools = await Promise.all(
    allActiveSchools.map(async (s) => {
      const [userCount, studentCount, teacherCount, openAlerts] = await Promise.all([
        prisma.user.count({ where: { schoolId: s.id, isActive: true } }),
        prisma.user.count({ where: { schoolId: s.id, isActive: true, role: "STUDENT" } }),
        prisma.user.count({ where: { schoolId: s.id, isActive: true, role: "TEACHER" } }),
        // "Alerts" for the SuperAdmin = sensitive ops (DELETE / REVOKE) on this
        // school in the past 7 days. Stays in the SaaS-monitoring lane (no PII).
        prisma.auditLog.count({
          where: {
            schoolId: s.id,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            OR: [
              { action: { contains: "DELETE", mode: "insensitive" } },
              { action: { contains: "REVOKE", mode: "insensitive" } },
              { action: { contains: "ERROR", mode: "insensitive" } },
            ],
          },
        }),
      ]);
      return {
        id: s.id,
        name: s.name,
        city: s.city,
        isActive: s.isActive,
        studentCount,
        teacherCount,
        userCount,
        openAlerts,
      };
    })
  );

  // Remove fake storage calculation.
  // Using a simpler realistic metric: showing pure counts without making up storage MBs
  const storageUsed = "N/A (Non mesuré)";

  return {
    totalSchools,
    totalUsers,
    storageUsed,
    recentSchools,
    networkSchools,
    recentActivity,
    isGlobal: true,
  };
}
