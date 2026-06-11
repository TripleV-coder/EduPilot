import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";

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
      )?.class?.name || "Indisponible",
      average: Number(item.generalAverage),
      riskLevel: (item.riskLevel || "").toLowerCase(),
    }));
}

export async function buildSiteComparison(input: {
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
