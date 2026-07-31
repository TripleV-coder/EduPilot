// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

import prisma from "@/lib/prisma";
import { roundTo } from "@/lib/analytics/helpers";

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

  // Aggregate payment installments across all children for the parent view.
  const studentIds = parentProfile.parentStudents.map((ps) => ps.student.id);
  const studentFirstName = new Map(
    parentProfile.parentStudents.map((ps) => [ps.student.id, ps.student.user.firstName ?? ""]),
  );

  const installments = studentIds.length
    ? await prisma.installmentPayment.findMany({
        where: { paymentPlan: { studentId: { in: studentIds } } },
        include: {
          paymentPlan: {
            select: {
              studentId: true,
              fee: { select: { name: true } },
            },
          },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const today = new Date();
  const horizonDays = 60;
  const horizon = new Date(today.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  type ParentPayment = {
    id: string;
    childName: string;
    label: string;
    amount: number;
    dueDate: string | null;
    state: "paid" | "due" | "overdue";
  };

  const pendingPayments: ParentPayment[] = installments
    .filter((i) => {
      if (i.status === "PAID") return true;
      const d = new Date(i.dueDate);
      return d <= horizon;
    })
    .map((i) => {
      const paid = i.status === "PAID";
      const overdue = !paid && new Date(i.dueDate) < today;
      return {
        id: i.id,
        childName: studentFirstName.get(i.paymentPlan.studentId) ?? "Enfant",
        label: i.paymentPlan.fee.name,
        amount: Number(i.amount),
        dueDate: paid && i.paidAt ? i.paidAt.toISOString() : i.dueDate.toISOString(),
        state: paid ? "paid" : overdue ? "overdue" : "due",
      } satisfies ParentPayment;
    })
    .slice(0, 12);

  const totalDue = pendingPayments
    .filter((p) => p.state !== "paid")
    .reduce((acc, p) => acc + p.amount, 0);

  const nextDueDate = pendingPayments
    .filter((p) => p.state !== "paid" && p.dueDate)
    .map((p) => new Date(p.dueDate as string).getTime())
    .sort((a, b) => a - b)[0] ?? null;

  return {
    children,
    pendingPayments,
    totalDue,
    nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : null,
  };
}
