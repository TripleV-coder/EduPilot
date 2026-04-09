import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";
import { countTeachersForSchool } from "@/lib/teachers/school-assignments";

export type AnalyticsWithDetails = Prisma.StudentAnalyticsGetPayload<{
  include: {
    period: {
      select: { id: true; name: true; sequence: true };
    };
    student: {
      include: {
        user: { select: { firstName: true; lastName: true } };
        enrollments: {
          include: { class: { select: { name: true } } };
        };
      };
    };
    subjectPerformances: {
      include: {
        subject: { select: { name: true } };
      };
    };
  };
}>;

export function buildPerformanceDistribution(analytics: { performanceLevel: string | null }[]) {
  return {
    excellent: analytics.filter(a => a.performanceLevel === "EXCELLENT").length,
    veryGood: analytics.filter(a => a.performanceLevel === "VERY_GOOD").length,
    good: analytics.filter(a => a.performanceLevel === "GOOD").length,
    average: analytics.filter(a => a.performanceLevel === "AVERAGE").length,
    insufficient: analytics.filter(a => a.performanceLevel === "INSUFFICIENT").length,
    weak: analytics.filter(a => a.performanceLevel === "WEAK").length,
  };
}

export function buildRiskDistribution(analytics: { riskLevel: string | null }[]) {
  return {
    low: analytics.filter(a => a.riskLevel === "LOW").length,
    medium: analytics.filter(a => a.riskLevel === "MEDIUM").length,
    high: analytics.filter(a => a.riskLevel === "HIGH").length,
    critical: analytics.filter(a => a.riskLevel === "CRITICAL").length,
  };
}

export function buildSubjectSummary(analytics: { subjectPerformances?: { subjectId: string; subject: { name: string }; average: number | Prisma.Decimal | null }[] }[], filterSubjectId?: string) {
  const subjectMap: Record<string, { name: string; total: number; count: number }> = {};

  for (const analyticsItem of analytics) {
    for (const perf of analyticsItem.subjectPerformances ?? []) {
      if (filterSubjectId && perf.subjectId !== filterSubjectId) continue;
      if (perf.average === null) continue;
      if (!subjectMap[perf.subjectId]) {
        subjectMap[perf.subjectId] = { name: perf.subject.name, total: 0, count: 0 };
      }
      subjectMap[perf.subjectId].total += Number(perf.average || 0);
      subjectMap[perf.subjectId].count += 1;
    }
  }

  return Object.values(subjectMap)
    .map((item) => ({
      name: item.name,
      average: item.count > 0 ? roundTo(item.total / item.count) : 0,
    }))
    .sort((left, right) => right.average - left.average);
}

export function buildAtRiskStudents(analytics: AnalyticsWithDetails[], yearId: string) {
  return analytics
    .filter((item) => item.riskLevel === "HIGH" || item.riskLevel === "CRITICAL")
    .sort((left, right) => Number(left.generalAverage || 0) - Number(right.generalAverage || 0))
    .slice(0, 5)
    .map((item) => ({
      id: item.studentId,
      name: `${item.student.user.firstName} ${item.student.user.lastName}`,
      className: item.student.enrollments.find(
        (enrollment) =>
          enrollment.academicYearId === yearId && enrollment.status === "ACTIVE"
      )?.class?.name || "N/A",
      average: Number(item.generalAverage),
      riskLevel: (item.riskLevel || "").toLowerCase(),
    }));
}

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
          city: school.city || "N/A",
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
          city: school.city || "N/A",
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
          city: school.city || "N/A",
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
          city: school.city || "N/A",
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
        city: school.city || "N/A",
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

  // Remove fake storage calculation. 
  // Using a simpler realistic metric: showing pure counts without making up storage MBs
  const storageUsed = "N/A (Non mesuré)";

  return {
    totalSchools,
    totalUsers,
    storageUsed,
    recentSchools,
    recentActivity,
    isGlobal: true,
  };
}

export async function getTeacherDashboardData(userId: string, _schoolId: string, yearId: string) {
  const teacherProfile = await prisma.teacherProfile.findFirst({ where: { userId } });
  if (!teacherProfile) throw new Error("Profil enseignant introuvable");

  const classSubjects = await prisma.classSubject.findMany({
    where: { teacherId: teacherProfile.id },
    include: {
      class: { select: { id: true, name: true } },
      subject: { select: { name: true } },
    },
  });

  const classIds = [...new Set(classSubjects.map(cs => cs.classId))];
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: { in: classIds }, academicYearId: yearId, status: "ACTIVE" },
    select: { studentId: true, classId: true, class: { select: { name: true } } },
  });

  const studentIds = enrollments.map(e => e.studentId);
  const analytics = await prisma.studentAnalytics.findMany({
    where: { academicYearId: yearId, studentId: { in: studentIds } },
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

  const currentAnalytics = dedupeLatestAnalyticsByStudent(analytics);
  const scoredCurrentAnalytics = currentAnalytics.filter(item => item.generalAverage !== null);
  const classAverage = scoredCurrentAnalytics.length > 0
    ? scoredCurrentAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / scoredCurrentAnalytics.length
    : 0;

  const classStudentMap: Record<string, { name: string; studentIds: string[] }> = {};
  for (const enr of enrollments) {
    if (!classStudentMap[enr.classId]) {
      classStudentMap[enr.classId] = { name: enr.class.name, studentIds: [] };
    }
    classStudentMap[enr.classId].studentIds.push(enr.studentId);
  }

  const classPerformance = Object.values(classStudentMap).map(cls => {
    const clsAnalytics = currentAnalytics.filter(a => cls.studentIds.includes(a.studentId) && a.generalAverage !== null);
    const avg = clsAnalytics.length > 0
      ? clsAnalytics.reduce((sum, a) => sum + Number(a.generalAverage), 0) / clsAnalytics.length
      : 0;
    return { name: cls.name, average: roundTo(avg) };
  });

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

  return {
    myClasses: classIds.length,
    myStudents: studentIds.length,
    classAverage: roundTo(classAverage),
    classPerformance,
    monthlyTrend,
    atRiskStudents: buildAtRiskStudents(currentAnalytics, yearId),
  };
}

export async function getStudentDashboardData(userId: string, yearId: string) {
  const studentProfile = await prisma.studentProfile.findFirst({ where: { userId } });
  if (!studentProfile) throw new Error("Profil étudiant introuvable");

  const academicYear = await prisma.academicYear.findUnique({
    where: { id: yearId },
    select: { startDate: true, endDate: true },
  });

  const analytics = await prisma.studentAnalytics.findMany({
    where: { studentId: studentProfile.id, academicYearId: yearId },
    include: {
      subjectPerformances: { include: { subject: { select: { name: true } } } },
      period: { select: { name: true, sequence: true } },
    },
    orderBy: { period: { sequence: "asc" } },
  });

  const latestAnalytics = analytics.length > 0 ? analytics[analytics.length - 1] : null;
  const myAverage = latestAnalytics ? Number(latestAnalytics.generalAverage || 0) : 0;

  const attendanceStats = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      studentId: studentProfile.id,
      date: {
        gte: academicYear?.startDate ?? new Date(new Date().getFullYear(), 0, 1),
        lte: academicYear?.endDate ?? new Date(),
      },
    },
    _count: true,
  });

  const totalAtt = attendanceStats.reduce((s, a) => s + a._count, 0);
  const presentCount = (attendanceStats.find(a => a.status === "PRESENT")?._count || 0)
    + (attendanceStats.find(a => a.status === "LATE")?._count || 0);
  
  return {
    myAverage: roundTo(myAverage),
    myRank: latestAnalytics?.classRank ?? null,
    attendanceRate: totalAtt > 0 ? roundTo((presentCount / totalAtt) * 100) : 0,
    subjectPerformances: latestAnalytics ? latestAnalytics.subjectPerformances.map(sp => ({
      name: sp.subject.name,
      average: Number(sp.average || 0),
    })) : [],
    monthlyTrend: analytics.map(a => ({
      name: a.period.name,
      value: Number(a.generalAverage || 0),
    })),
  };
}

export async function getParentDashboardData(userId: string, yearId: string) {
  const parentProfile = await prisma.parentProfile.findFirst({
    where: { userId },
    include: {
      parentStudents: {
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  if (!parentProfile) throw new Error("Profil parent introuvable");

  // Note (Audit) : Bien que cela génère des requêtes N+1 (appels multiples à getStudentDashboardData), 
  // on utilise Promise.all pour paralléliser l'exécution. C'est un choix délibéré (trade-off) 
  // pour centraliser et réutiliser la logique métier complexe (croissance, assiduité, classement) 
  // de `getStudentDashboardData` sans dupliquer le code. Un parent ayant généralement peu d'enfants (1-3), 
  // l'impact sur les performances reste négligeable.
  const children = await Promise.all(
    parentProfile.parentStudents.map(async (ps) => {
      const data = await getStudentDashboardData(ps.student.userId, yearId);
      return {
        name: `${ps.student.user.firstName} ${ps.student.user.lastName}`,
        ...data,
      };
    })
  );

  return { children };
}

export async function getAccountantDashboardData(schoolId: string) {
  const [paymentsReceived, paymentsPending, totalFees] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "VERIFIED", fee: { schoolId }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "PENDING", fee: { schoolId }, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.fee.aggregate({
      where: { schoolId, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const statusCounts = await prisma.payment.groupBy({
    by: ["status"],
    where: { fee: { schoolId } },
    _count: true,
  });

  const payments = await prisma.payment.findMany({
    where: { fee: { schoolId }, paidAt: { not: null } },
    select: { paidAt: true, amount: true, status: true },
  });

  const monthMap: Record<string, { received: number; pending: number }> = {};
  for (const p of payments) {
    if (!p.paidAt) continue;
    const month = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[month]) monthMap[month] = { received: 0, pending: 0 };
    if (p.status === "VERIFIED" || p.status === "RECONCILED") {
      monthMap[month].received += Number(p.amount);
    } else if (p.status === "PENDING") {
      monthMap[month].pending += Number(p.amount);
    }
  }

  return {
    paymentsReceived: Number(paymentsReceived._sum.amount || 0),
    paymentsPending: Number(paymentsPending._sum.amount || 0),
    totalFees: Number(totalFees._sum.amount || 0),
    paymentsByMonth: Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({ month, ...data })),
    paymentStatusDistribution: {
      verified: statusCounts.find(s => s.status === "VERIFIED")?._count || 0,
      pending: statusCounts.find(s => s.status === "PENDING")?._count || 0,
      cancelled: statusCounts.find(s => s.status === "CANCELLED")?._count || 0,
      reconciled: statusCounts.find(s => s.status === "RECONCILED")?._count || 0,
    },
  };
}

export async function getStaffDashboardData(schoolId: string, yearId: string) {
  const [totalStudents, totalClasses, incidentsCount, recentActivity] = await Promise.all([
    prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
    prisma.class.count({ where: { schoolId, deletedAt: null } }),
    prisma.behaviorIncident.count({ where: { student: { schoolId } } }),
    prisma.auditLog.findMany({
      where: { schoolId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendanceStats = await prisma.attendance.groupBy({
    by: ["status"],
    where: {
      student: { schoolId },
      date: { gte: today },
    },
    _count: true,
  });

  const attendanceDistribution = {
    present: attendanceStats.find((a) => a.status === "PRESENT")?._count || 0,
    absent: attendanceStats.find((a) => a.status === "ABSENT")?._count || 0,
    late: attendanceStats.find((a) => a.status === "LATE")?._count || 0,
    excused: attendanceStats.find((a) => a.status === "EXCUSED")?._count || 0,
  };
  const totalAttendance = Object.values(attendanceDistribution).reduce((sum, value) => sum + value, 0);
  const attendanceRate = totalAttendance > 0
    ? ((attendanceDistribution.present + attendanceDistribution.late) / totalAttendance) * 100
    : 0;

  const enrollments = await prisma.enrollment.findMany({
    where: { academicYearId: yearId, status: "ACTIVE", class: { schoolId } },
    select: { classId: true, studentId: true, class: { select: { id: true, name: true } } },
  });

  const classSummary = Object.values(
    enrollments.reduce<Record<string, { id: string; name: string; studentCount: number; average: number }>>((acc, enrollment) => {
      if (!acc[enrollment.classId]) {
        acc[enrollment.classId] = {
          id: enrollment.class.id,
          name: enrollment.class.name,
          studentCount: 0,
          average: 0,
        };
      }
      acc[enrollment.classId].studentCount += 1;
      return acc;
    }, {})
  )
    .sort((left, right) => right.studentCount - left.studentCount)
    .slice(0, 6);

  return {
    totalStudents,
    totalClasses,
    attendanceRate: roundTo(attendanceRate),
    activeAlerts: incidentsCount,
    attendanceDistribution,
    classSummary,
    recentActivity,
  };
}
