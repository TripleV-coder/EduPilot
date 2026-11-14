// Extrait de l'ancien src/lib/services/analytics-dashboard.ts (1205 lignes)
// lors de la découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

import prisma from "@/lib/prisma";
import { getChildFinance } from "@/lib/finance/family-finance";
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
    // Aucun appel enregistré : pas de « 0 % » qui ressemblerait à une mesure.
    attendanceRate: totalAtt > 0 ? roundTo((presentCount / totalAtt) * 100) : null,
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
        // La carte de l'accueil ouvre le dossier de CET enfant (lien vérifié par l'API)
        studentId: ps.student.id,
        name: `${ps.student.user.firstName} ${ps.student.user.lastName}`,
        ...data,
      };
    })
  );

  // Échéances et reste à payer : MÊME source que la page Paiements
  // (getChildFinance → getFeeBalance + couverture chronologique). L'accueil
  // faisait son propre calcul : échéances déjà payées affichées « à payer »,
  // montant entier d'une échéance partiellement couverte, rien au-delà de 60 j.
  const studentIds = parentProfile.parentStudents.map((ps) => ps.student.id);
  const finances = (await Promise.all(studentIds.map((id) => getChildFinance(prisma, id)))).filter(
    (f): f is NonNullable<typeof f> => f !== null,
  );

  const today = new Date();
  const horizon = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);

  type ParentPayment = {
    id: string;
    studentId: string;
    childName: string;
    label: string;
    amount: number;
    dueDate: string | null;
    state: "due" | "overdue";
  };

  const allPayments: ParentPayment[] = [];
  for (const finance of finances) {
    const { studentId, firstName } = finance.child;
    for (const fee of finance.fees) {
      if (fee.remaining <= 0) continue;
      const rows = fee.installments
        ? fee.installments.filter((row) => row.outstanding > 0).map((row) => ({ id: row.id, amount: row.outstanding, dueDate: row.dueDate as Date | null }))
        : [{ id: `due:${fee.feeId}:${studentId}`, amount: fee.remaining, dueDate: fee.dueDate }];
      for (const row of rows) {
        allPayments.push({
          id: row.id,
          studentId,
          childName: firstName ?? "Enfant",
          label: fee.name,
          amount: row.amount,
          dueDate: row.dueDate ? row.dueDate.toISOString() : null,
          state: row.dueDate && row.dueDate < today ? "overdue" : "due",
        });
      }
    }
  }
  allPayments.sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity));

  // Total : reste canonique de chaque enfant (sans troncature ni horizon)
  const totalDue = finances.reduce((sum, f) => sum + f.totals.remaining, 0);
  // Liste affichée : retards et échéances des 60 prochains jours
  const pendingPayments = allPayments.filter((p) => !p.dueDate || new Date(p.dueDate) <= horizon).slice(0, 12);

  // « Prochaine » échéance = la plus proche À VENIR ; les passées sont comptées
  // à part comme retards.
  const nextDueDate = allPayments
    .filter((p) => p.state === "due" && p.dueDate)
    .map((p) => new Date(p.dueDate as string).getTime())
    .sort((a, b) => a - b)[0] ?? null;
  const overdueCount = allPayments.filter((p) => p.state === "overdue").length;

  return {
    children,
    pendingPayments,
    totalDue,
    nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : null,
    overdueCount,
  };
}
