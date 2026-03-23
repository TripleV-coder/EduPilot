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
      )?.class?.name || "N/A",
      average: Number(item.generalAverage),
      riskLevel: (item.riskLevel || "").toLowerCase(),
    }));
}

export async function getAdminDashboardData(schoolId: string, yearId: string, filterClassId?: string, filterPeriodId?: string, filterSubjectId?: string) {
  const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
    prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
    prisma.teacherProfile.count({ where: { schoolId, deletedAt: null } }),
    prisma.class.count({ where: { schoolId, deletedAt: null } }),
  ]);

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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [attendanceLast30Days, studentsInSchoolCount, recentActivity] = await Promise.all([
    prisma.attendance.findMany({
      where: { student: { schoolId }, date: { gte: thirtyDaysAgo } },
      select: { studentId: true },
      distinct: ['studentId']
    }),
    prisma.studentProfile.count({ where: { schoolId, deletedAt: null } }),
    prisma.auditLog.findMany({
      where: { schoolId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { firstName: true, lastName: true } } }
    })
  ]);

  const dropoutRate = studentsInSchoolCount > 0 ? (Math.max(0, studentsInSchoolCount - attendanceLast30Days.length) / studentsInSchoolCount) * 100 : 0;

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
    studentGrowth: 2.4, 
    attendanceGrowth: -0.5,
    averageGrowth: 0.1,
    activeAlerts: atRiskStudents.length,
    performanceDistribution,
    riskDistribution,
    attendanceDistribution,
    subjectSummary,
    classSummary,
    monthlyTrend,
    atRiskStudents,
    recentActivity,
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

  const storageUsed = `${((totalSchools * 450 + totalUsers * 45) / 1024).toFixed(1)} GB`;

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
