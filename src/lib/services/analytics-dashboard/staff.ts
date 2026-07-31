// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

import prisma from "@/lib/prisma";
import { roundTo } from "@/lib/analytics/helpers";

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
