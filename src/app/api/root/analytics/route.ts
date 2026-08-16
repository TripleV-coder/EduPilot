import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import { logger } from "@/lib/utils/logger";

import { createApiHandler } from "@/lib/api/api-helpers";
export const dynamic = "force-dynamic";

function getStartDate(period: string): Date {
  const now = new Date();
  const ms: Record<string, number> = {
    "7d": 7 * 86400000,
    "30d": 30 * 86400000,
    "90d": 90 * 86400000,
    "1y": 365 * 86400000,
  };
  return new Date(now.getTime() - (ms[period] || ms["30d"]));
}

export const GET = createApiHandler(
    async (request, context) => {

  const session = context.session;
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "30d";
    const now = new Date();
    const startDate = getStartDate(period);

    // All aggregations in parallel using database-level grouping
    const [usersByDay, paymentsByDay, schoolsByDay, activityByDay] = await Promise.all([
      prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT DATE("createdAt") as day, COUNT(*) as count
        FROM users
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
      prisma.$queryRaw<Array<{ day: string; count: bigint; revenue: number }>>`
        SELECT DATE("paidAt") as day, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue
        FROM payments
        WHERE "paidAt" >= ${startDate} AND "paidAt" IS NOT NULL
        GROUP BY DATE("paidAt")
        ORDER BY day ASC
      `,
      prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT DATE("createdAt") as day, COUNT(*) as count
        FROM schools
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
      prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
        SELECT DATE("createdAt") as day, COUNT(*) as count
        FROM audit_logs
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
    ]);

    // Merge into timeline
    const dailyData = new Map<string, { users: number; payments: number; revenue: number; schools: number; activity: number }>();

    const ensure = (day: string) => {
      if (!dailyData.has(day)) dailyData.set(day, { users: 0, payments: 0, revenue: 0, schools: 0, activity: 0 });
      return dailyData.get(day)!;
    };

    for (const r of usersByDay) ensure(r.day).users = Number(r.count);
    for (const r of paymentsByDay) { ensure(r.day).payments = Number(r.count); ensure(r.day).revenue = Number(r.revenue); }
    for (const r of schoolsByDay) ensure(r.day).schools = Number(r.count);
    for (const r of activityByDay) ensure(r.day).activity = Number(r.count);

    const timeline = Array.from(dailyData.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalUsers = timeline.reduce((s, d) => s + d.users, 0);
    const totalPayments = timeline.reduce((s, d) => s + d.payments, 0);
    const totalRevenue = timeline.reduce((s, d) => s + d.revenue, 0);
    const totalSchools = timeline.reduce((s, d) => s + d.schools, 0);
    const totalActivity = timeline.reduce((s, d) => s + d.activity, 0);

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
    },
    {},
);

