import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import { logger } from "@/lib/utils/logger";

function requireRoot(session: Session | null, userEmail?: string | null, userId?: string | null) {
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isRootUserEmail(userEmail) || !hasValidRootSession(session)) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "30d"; // 7d, 30d, 90d, 1y
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Évolution des inscriptions d'utilisateurs
    const userRegistrations = await prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Évolution des paiements
    const payments = await prisma.payment.findMany({
      where: {
        paidAt: { gte: startDate, not: null },
      },
      select: {
        paidAt: true,
        amount: true,
      },
      orderBy: { paidAt: "asc" },
    });

    // Évolution des écoles créées
    const schoolCreations = await prisma.school.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Activité par jour (audit logs) - on récupère tous les logs et on groupe manuellement
    const allActivityLogs = await prisma.auditLog.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
    });

    // Grouper par jour manuellement
    const dailyActivityMap = new Map<string, number>();
    allActivityLogs.forEach((log) => {
      const day = log.createdAt.toISOString().split("T")[0];
      dailyActivityMap.set(day, (dailyActivityMap.get(day) || 0) + 1);
    });

    const dailyActivity = Array.from(dailyActivityMap.entries()).map(([date, count]) => ({
      createdAt: new Date(date),
      _count: count,
    }));

    // Agrégation par jour pour les graphiques
    const dailyData: Record<string, { users: number; payments: number; revenue: number; schools: number; activity: number }> = {};

    userRegistrations.forEach((u) => {
      const day = u.createdAt.toISOString().split("T")[0];
      if (!dailyData[day]) dailyData[day] = { users: 0, payments: 0, revenue: 0, schools: 0, activity: 0 };
      dailyData[day].users++;
    });

    payments.forEach((p) => {
      if (p.paidAt) {
        const day = p.paidAt.toISOString().split("T")[0];
        if (!dailyData[day]) dailyData[day] = { users: 0, payments: 0, revenue: 0, schools: 0, activity: 0 };
        dailyData[day].payments++;
        dailyData[day].revenue += Number(p.amount);
      }
    });

    schoolCreations.forEach((s) => {
      const day = s.createdAt.toISOString().split("T")[0];
      if (!dailyData[day]) dailyData[day] = { users: 0, payments: 0, revenue: 0, schools: 0, activity: 0 };
      dailyData[day].schools++;
    });

    dailyActivity.forEach((a) => {
      const day = a.createdAt.toISOString().split("T")[0];
      if (!dailyData[day]) dailyData[day] = { users: 0, payments: 0, revenue: 0, schools: 0, activity: 0 };
      dailyData[day].activity += a._count;
    });

    // Convertir en tableau trié
    const timeline = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Statistiques globales pour la période
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPayments = payments.length;
    const totalUsers = userRegistrations.length;
    const totalSchools = schoolCreations.length;
    const totalActivity = dailyActivity.reduce((sum, a) => sum + a._count, 0);

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      timeline,
      summary: {
        users: totalUsers,
        payments: totalPayments,
        revenue: totalRevenue,
        schools: totalSchools,
        activity: totalActivity,
        averageRevenuePerDay: timeline.length > 0 ? totalRevenue / timeline.length : 0,
        averageUsersPerDay: timeline.length > 0 ? totalUsers / timeline.length : 0,
      },
    });
  } catch (error) {
    logger.error("Error fetching root analytics", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des analytics" },
      { status: 500 }
    );
  }
}
