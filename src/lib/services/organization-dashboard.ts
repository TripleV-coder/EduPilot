import prisma from "@/lib/prisma";
import { dedupeLatestAnalyticsByStudent, roundTo } from "@/lib/analytics/helpers";
import { countTeachersForSchool } from "@/lib/teachers/school-assignments";

type ComparisonMetricSite = {
  schoolId: string;
  schoolName: string;
  total: number;
  count: number;
};

type ComparisonAccumulator = {
  label: string;
  sites: Map<string, ComparisonMetricSite>;
};

type OrganizationDashboardParams = {
  organizationId: string;
  preferredSchoolId?: string;
  academicYearId?: string;
  periodId?: string;
};

type ResolvedReferenceScope = {
  schoolId: string;
  schoolName: string;
  academicYearId: string;
  academicYearName: string;
  periodId: string | null;
  periodName: string | null;
  periodSequence: number | null;
};

type SchoolComparisonMetric = {
  schoolId: string;
  schoolName: string;
  averageGrade: number;
  sampleSize: number;
};

export type OrganizationComparisonRow = {
  key: string;
  label: string;
  coverage: number;
  sampleSize: number;
  organizationAverage: number;
  delta: number;
  sites: SchoolComparisonMetric[];
};

export type OrganizationSiteSummary = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  siteType: "MAIN" | "ANNEXE";
  isActive: boolean;
  academicYearName: string | null;
  studentCount: number;
  teacherCount: number;
  classCount: number;
  averageGrade: number;
  passRate: number;
  attendanceRate: number;
  criticalRiskCount: number;
  topSubject: string | null;
  comparisonNote: string | null;
  isComparable: boolean;
  attendanceSampleSize: number;
};

export type OrganizationDashboardData = {
  organization: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    isActive: boolean;
    membershipCount: number;
    siteCount: number;
  };
  reference: {
    schoolId: string;
    schoolName: string;
    academicYearName: string;
    periodName: string | null;
    comparableSiteCount: number;
    nonComparableSiteCount: number;
  };
  summary: {
    totalSites: number;
    activeSites: number;
    comparableSites: number;
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    averageGrade: number;
    passRate: number;
    attendanceRate: number;
    criticalRiskCount: number;
  };
  sites: OrganizationSiteSummary[];
  classLevels: OrganizationComparisonRow[];
  classes: OrganizationComparisonRow[];
  subjects: OrganizationComparisonRow[];
};

type SubjectPerformanceInput = {
  subjectId: string;
  subject: {
    name: string;
    code: string;
  };
  average: number | null;
};

type AnalyticsRecordInput = {
  generalAverage: number | null;
  riskLevel: string | null;
  subjectPerformances: SubjectPerformanceInput[];
  student: {
    enrollments: Array<{
      class: {
        name: string;
        classLevel: {
          code: string;
          name: string;
          level: string;
        };
      };
    }>;
  };
};

function normalizeKey(value: string | null | undefined) {
  return (value || "").trim().toUpperCase();
}

function buildClassLevelKey(classLevel: { code: string; name: string; level: string }) {
  return normalizeKey(classLevel.code) || `${normalizeKey(classLevel.level)}:${normalizeKey(classLevel.name)}`;
}

function buildClassLevelLabel(classLevel: { code: string; name: string }) {
  return classLevel.code || classLevel.name;
}

function buildClassKey(className: string, classLevel: { code: string; name: string; level: string }) {
  return `${buildClassLevelKey(classLevel)}::${normalizeKey(className)}`;
}

function buildClassLabel(className: string, classLevel: { code: string; name: string }) {
  const levelLabel = buildClassLevelLabel(classLevel);
  return levelLabel ? `${levelLabel} / ${className}` : className;
}

function buildSubjectKey(subject: { code: string; name: string }) {
  return normalizeKey(subject.code) || normalizeKey(subject.name);
}

function accumulateMetric(
  target: Map<string, ComparisonAccumulator>,
  input: {
    key: string;
    label: string;
    schoolId: string;
    schoolName: string;
    value: number;
  }
) {
  const currentGroup = target.get(input.key) ?? {
    label: input.label,
    sites: new Map<string, ComparisonMetricSite>(),
  };

  const currentSiteMetric = currentGroup.sites.get(input.schoolId) ?? {
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    total: 0,
    count: 0,
  };

  currentSiteMetric.total += input.value;
  currentSiteMetric.count += 1;
  currentGroup.sites.set(input.schoolId, currentSiteMetric);
  target.set(input.key, currentGroup);
}

function finalizeComparisonRows(target: Map<string, ComparisonAccumulator>) {
  return Array.from(target.entries())
    .map(([key, group]) => {
      const sites = Array.from(group.sites.values())
        .filter((site) => site.count > 0)
        .map((site) => ({
          schoolId: site.schoolId,
          schoolName: site.schoolName,
          averageGrade: roundTo(site.total / site.count),
          sampleSize: site.count,
        }))
        .sort((left, right) => right.averageGrade - left.averageGrade);

      const coverage = sites.length;
      const sampleSize = sites.reduce((sum, site) => sum + site.sampleSize, 0);
      const organizationAverage = sampleSize > 0
        ? roundTo(
            sites.reduce((sum, site) => sum + (site.averageGrade * site.sampleSize), 0) /
              sampleSize
          )
        : 0;
      const delta = coverage > 1
        ? roundTo(sites[0].averageGrade - sites[sites.length - 1].averageGrade)
        : 0;

      return {
        key,
        label: group.label,
        coverage,
        sampleSize,
        organizationAverage,
        delta,
        sites,
      } satisfies OrganizationComparisonRow;
    })
    .filter((row) => row.coverage >= 2)
    .sort((left, right) => {
      if (right.coverage !== left.coverage) return right.coverage - left.coverage;
      if (right.sampleSize !== left.sampleSize) return right.sampleSize - left.sampleSize;
      return right.organizationAverage - left.organizationAverage;
    });
}

function computeAttendanceRate(input: Array<{ status: string; _count: number }>) {
  const total = input.reduce((sum, item) => sum + item._count, 0);
  const present =
    (input.find((item) => item.status === "PRESENT")?._count || 0) +
    (input.find((item) => item.status === "LATE")?._count || 0);

  return {
    total,
    rate: total > 0 ? roundTo((present / total) * 100) : 0,
  };
}

function buildTopSubjectName(
  analytics: Array<{
    subjectPerformances: SubjectPerformanceInput[];
  }>
) {
  const summary = new Map<string, { name: string; total: number; count: number }>();

  for (const analyticsItem of analytics) {
    for (const performance of analyticsItem.subjectPerformances) {
      if (performance.average === null) continue;
      const key = buildSubjectKey(performance.subject);
      const current = summary.get(key) ?? {
        name: performance.subject.name,
        total: 0,
        count: 0,
      };
      current.total += Number(performance.average);
      current.count += 1;
      summary.set(key, current);
    }
  }

  return Array.from(summary.values())
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: item.name,
      average: item.total / item.count,
    }))
    .sort((left, right) => right.average - left.average)[0]?.name || null;
}

async function resolveReferenceScope(input: {
  organizationId: string;
  schoolIds: string[];
  preferredSchoolId?: string;
  academicYearId?: string;
  periodId?: string;
}) {
  if (input.periodId) {
    const requestedPeriod = await prisma.period.findFirst({
      where: {
        id: input.periodId,
        academicYear: {
          school: {
            organizationId: input.organizationId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        sequence: true,
        academicYear: {
          select: {
            id: true,
            name: true,
            schoolId: true,
            school: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!requestedPeriod) {
      throw new Error("Période hors périmètre organisation.");
    }

    return {
      schoolId: requestedPeriod.academicYear.schoolId,
      schoolName: requestedPeriod.academicYear.school.name,
      academicYearId: requestedPeriod.academicYear.id,
      academicYearName: requestedPeriod.academicYear.name,
      periodId: requestedPeriod.id,
      periodName: requestedPeriod.name,
      periodSequence: requestedPeriod.sequence,
    } satisfies ResolvedReferenceScope;
  }

  if (input.academicYearId) {
    const requestedYear = await prisma.academicYear.findFirst({
      where: {
        id: input.academicYearId,
        school: {
          organizationId: input.organizationId,
        },
      },
      select: {
        id: true,
        name: true,
        schoolId: true,
        school: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!requestedYear) {
      throw new Error("Année académique hors périmètre organisation.");
    }

    return {
      schoolId: requestedYear.schoolId,
      schoolName: requestedYear.school.name,
      academicYearId: requestedYear.id,
      academicYearName: requestedYear.name,
      periodId: null,
      periodName: null,
      periodSequence: null,
    } satisfies ResolvedReferenceScope;
  }

  if (input.preferredSchoolId && input.schoolIds.includes(input.preferredSchoolId)) {
    const preferredCurrentYear = await prisma.academicYear.findFirst({
      where: {
        schoolId: input.preferredSchoolId,
        isCurrent: true,
      },
      select: {
        id: true,
        name: true,
        schoolId: true,
        school: {
          select: {
            name: true,
          },
        },
      },
    });

    if (preferredCurrentYear) {
      return {
        schoolId: preferredCurrentYear.schoolId,
        schoolName: preferredCurrentYear.school.name,
        academicYearId: preferredCurrentYear.id,
        academicYearName: preferredCurrentYear.name,
        periodId: null,
        periodName: null,
        periodSequence: null,
      } satisfies ResolvedReferenceScope;
    }
  }

  const currentYear = await prisma.academicYear.findFirst({
    where: {
      schoolId: { in: input.schoolIds },
      isCurrent: true,
    },
    orderBy: {
      startDate: "desc",
    },
    select: {
      id: true,
      name: true,
      schoolId: true,
      school: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!currentYear) {
    throw new Error("Aucune année académique active trouvée dans cette organisation.");
  }

  return {
    schoolId: currentYear.schoolId,
    schoolName: currentYear.school.name,
    academicYearId: currentYear.id,
    academicYearName: currentYear.name,
    periodId: null,
    periodName: null,
    periodSequence: null,
  } satisfies ResolvedReferenceScope;
}

export async function getOrganizationDashboardData(params: OrganizationDashboardParams) {
  const organization = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      isActive: true,
      _count: {
        select: {
          memberships: true,
          schools: true,
        },
      },
      schools: {
        orderBy: [
          { siteType: "asc" },
          { name: "asc" },
        ],
        select: {
          id: true,
          name: true,
          code: true,
          city: true,
          siteType: true,
          isActive: true,
        },
      },
    },
  });

  if (!organization) {
    throw new Error("Organisation introuvable.");
  }

  if (organization.schools.length === 0) {
    return {
      organization: {
        id: organization.id,
        name: organization.name,
        code: organization.code,
        description: organization.description,
        isActive: organization.isActive,
        membershipCount: organization._count.memberships,
        siteCount: organization._count.schools,
      },
      reference: {
        schoolId: "",
        schoolName: "",
        academicYearName: "",
        periodName: null,
        comparableSiteCount: 0,
        nonComparableSiteCount: 0,
      },
      summary: {
        totalSites: 0,
        activeSites: 0,
        comparableSites: 0,
        totalStudents: 0,
        totalTeachers: 0,
        totalClasses: 0,
        averageGrade: 0,
        passRate: 0,
        attendanceRate: 0,
        criticalRiskCount: 0,
      },
      sites: [],
      classLevels: [],
      classes: [],
      subjects: [],
    } satisfies OrganizationDashboardData;
  }

  const schoolIds = organization.schools.map((school) => school.id);
  const reference = await resolveReferenceScope({
    organizationId: organization.id,
    schoolIds,
    preferredSchoolId: params.preferredSchoolId,
    academicYearId: params.academicYearId,
    periodId: params.periodId,
  });

  const classLevelMetrics = new Map<string, ComparisonAccumulator>();
  const classMetrics = new Map<string, ComparisonAccumulator>();
  const subjectMetrics = new Map<string, ComparisonAccumulator>();

  const sites = await Promise.all(
    organization.schools.map(async (school) => {
      const schoolYear = school.id === reference.schoolId
        ? await prisma.academicYear.findUnique({
            where: { id: reference.academicYearId },
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
            },
          })
        : await prisma.academicYear.findFirst({
            where: {
              schoolId: school.id,
              name: reference.academicYearName,
            },
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
            },
          });

      const teacherCountPromise = countTeachersForSchool(school.id);
      const classCountPromise = prisma.class.count({
        where: {
          schoolId: school.id,
          deletedAt: null,
        },
      });

      if (!schoolYear) {
        const [teacherCount, classCount] = await Promise.all([teacherCountPromise, classCountPromise]);

        return {
          id: school.id,
          name: school.name,
          code: school.code,
          city: school.city,
          siteType: school.siteType,
          isActive: school.isActive,
          academicYearName: null,
          studentCount: 0,
          teacherCount,
          classCount,
          averageGrade: 0,
          passRate: 0,
          attendanceRate: 0,
          criticalRiskCount: 0,
          topSubject: null,
          comparisonNote: `Année ${reference.academicYearName} absente sur ce site`,
          isComparable: false,
          attendanceSampleSize: 0,
        } satisfies OrganizationSiteSummary;
      }

      const schoolPeriod = reference.periodId
        ? school.id === reference.schoolId
          ? await prisma.period.findUnique({
              where: { id: reference.periodId },
              select: {
                id: true,
                name: true,
                sequence: true,
              },
            })
          : await prisma.period.findFirst({
              where: {
                academicYearId: schoolYear.id,
                OR: [
                  { sequence: reference.periodSequence ?? undefined },
                  { name: reference.periodName ?? undefined },
                ],
              },
              orderBy: {
                sequence: "asc",
              },
              select: {
                id: true,
                name: true,
                sequence: true,
              },
            })
        : null;

      const [teacherCount, classCount] = await Promise.all([teacherCountPromise, classCountPromise]);

      if (reference.periodId && !schoolPeriod) {
        return {
          id: school.id,
          name: school.name,
          code: school.code,
          city: school.city,
          siteType: school.siteType,
          isActive: school.isActive,
          academicYearName: schoolYear.name,
          studentCount: 0,
          teacherCount,
          classCount,
          averageGrade: 0,
          passRate: 0,
          attendanceRate: 0,
          criticalRiskCount: 0,
          topSubject: null,
          comparisonNote: `Période ${reference.periodName} absente sur ce site`,
          isComparable: false,
          attendanceSampleSize: 0,
        } satisfies OrganizationSiteSummary;
      }

      const [studentCount, analytics, attendanceStats] = await Promise.all([
        prisma.enrollment.count({
          where: {
            academicYearId: schoolYear.id,
            status: "ACTIVE",
            class: {
              schoolId: school.id,
            },
          },
        }),
        prisma.studentAnalytics.findMany({
          where: {
            academicYearId: schoolYear.id,
            ...(schoolPeriod ? { periodId: schoolPeriod.id } : {}),
            student: {
              schoolId: school.id,
            },
          },
          include: {
            subjectPerformances: {
              include: {
                subject: {
                  select: {
                    name: true,
                    code: true,
                  },
                },
              },
            },
            student: {
              select: {
                enrollments: {
                  where: {
                    academicYearId: schoolYear.id,
                    status: "ACTIVE",
                  },
                  select: {
                    class: {
                      select: {
                        name: true,
                        classLevel: {
                          select: {
                            code: true,
                            name: true,
                            level: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.attendance.groupBy({
          by: ["status"],
          where: {
            class: {
              schoolId: school.id,
            },
            date: {
              gte: schoolYear.startDate,
              lte: schoolYear.endDate,
            },
          },
          _count: true,
        }),
      ]);

      const currentAnalytics = (schoolPeriod
        ? analytics
        : dedupeLatestAnalyticsByStudent(analytics)) as AnalyticsRecordInput[];
      const gradedAnalytics = currentAnalytics.filter((item) => item.generalAverage !== null);
      const averageGrade = gradedAnalytics.length > 0
        ? roundTo(
            gradedAnalytics.reduce((sum, item) => sum + Number(item.generalAverage), 0) /
              gradedAnalytics.length
          )
        : 0;
      const passRate = gradedAnalytics.length > 0
        ? roundTo(
            (gradedAnalytics.filter((item) => Number(item.generalAverage) >= 10).length /
              gradedAnalytics.length) *
              100
          )
        : 0;
      const criticalRiskCount = currentAnalytics.filter((item) => item.riskLevel === "CRITICAL").length;
      const attendance = computeAttendanceRate(attendanceStats);
      const topSubject = buildTopSubjectName(currentAnalytics);

      for (const analyticsItem of currentAnalytics) {
        const activeEnrollment = analyticsItem.student.enrollments[0];
        if (!activeEnrollment) continue;

        if (analyticsItem.generalAverage !== null) {
          const classLevel = activeEnrollment.class.classLevel;
          const classLevelKey = buildClassLevelKey(classLevel);
          const classLevelLabel = buildClassLevelLabel(classLevel);
          const classKey = buildClassKey(activeEnrollment.class.name, classLevel);
          const classLabel = buildClassLabel(activeEnrollment.class.name, classLevel);
          const generalAverage = Number(analyticsItem.generalAverage);

          accumulateMetric(classLevelMetrics, {
            key: classLevelKey,
            label: classLevelLabel,
            schoolId: school.id,
            schoolName: school.name,
            value: generalAverage,
          });

          accumulateMetric(classMetrics, {
            key: classKey,
            label: classLabel,
            schoolId: school.id,
            schoolName: school.name,
            value: generalAverage,
          });
        }

        for (const performance of analyticsItem.subjectPerformances) {
          if (performance.average === null) continue;

          accumulateMetric(subjectMetrics, {
            key: buildSubjectKey(performance.subject),
            label: performance.subject.name,
            schoolId: school.id,
            schoolName: school.name,
            value: Number(performance.average),
          });
        }
      }

      return {
        id: school.id,
        name: school.name,
        code: school.code,
        city: school.city,
        siteType: school.siteType,
        isActive: school.isActive,
        academicYearName: schoolYear.name,
        studentCount,
        teacherCount,
        classCount,
        averageGrade,
        passRate,
        attendanceRate: attendance.rate,
        criticalRiskCount,
        topSubject,
        comparisonNote: null,
        isComparable: true,
        attendanceSampleSize: attendance.total,
      } satisfies OrganizationSiteSummary;
    })
  );

  const comparableSites = sites.filter((site) => site.isComparable);
  const studentWeight = comparableSites.reduce((sum, site) => sum + site.studentCount, 0);
  const attendanceWeight = comparableSites.reduce((sum, site) => sum + site.attendanceSampleSize, 0);

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      code: organization.code,
      description: organization.description,
      isActive: organization.isActive,
      membershipCount: organization._count.memberships,
      siteCount: organization._count.schools,
    },
    reference: {
      schoolId: reference.schoolId,
      schoolName: reference.schoolName,
      academicYearName: reference.academicYearName,
      periodName: reference.periodName,
      comparableSiteCount: comparableSites.length,
      nonComparableSiteCount: sites.length - comparableSites.length,
    },
    summary: {
      totalSites: sites.length,
      activeSites: sites.filter((site) => site.isActive).length,
      comparableSites: comparableSites.length,
      totalStudents: comparableSites.reduce((sum, site) => sum + site.studentCount, 0),
      totalTeachers: sites.reduce((sum, site) => sum + site.teacherCount, 0),
      totalClasses: sites.reduce((sum, site) => sum + site.classCount, 0),
      averageGrade: studentWeight > 0
        ? roundTo(
            comparableSites.reduce((sum, site) => sum + (site.averageGrade * site.studentCount), 0) /
              studentWeight
          )
        : 0,
      passRate: studentWeight > 0
        ? roundTo(
            comparableSites.reduce((sum, site) => sum + (site.passRate * site.studentCount), 0) /
              studentWeight
          )
        : 0,
      attendanceRate: attendanceWeight > 0
        ? roundTo(
            comparableSites.reduce((sum, site) => sum + (site.attendanceRate * site.attendanceSampleSize), 0) /
              attendanceWeight
          )
        : 0,
      criticalRiskCount: comparableSites.reduce((sum, site) => sum + site.criticalRiskCount, 0),
    },
    sites,
    classLevels: finalizeComparisonRows(classLevelMetrics).slice(0, 12),
    classes: finalizeComparisonRows(classMetrics).slice(0, 12),
    subjects: finalizeComparisonRows(subjectMetrics).slice(0, 12),
  } satisfies OrganizationDashboardData;
}
