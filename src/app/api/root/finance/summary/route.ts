import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import { logger } from "@/lib/utils/logger";

import { createApiHandler } from "@/lib/api/api-helpers";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
    async (request, context) => {

  const session = context.session;
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const [schools, plans] = await Promise.all([
      prisma.school.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          planId: true,
          subscriptionStatus: true,
        },
      }),
      prisma.subscriptionPlan.findMany(),
    ]);

    const [paymentStats, recentPayments] = await Promise.all([
      prisma.payment.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.payment.findMany({
        where: {
          paidAt: { not: null },
          status: "VERIFIED",
        },
        orderBy: {
          paidAt: "desc",
        },
        take: 8,
        include: {
          student: {
            include: {
              school: {
                select: { name: true },
              },
            },
          },
        },
      }),
    ]);

    const planMap = new Map(plans.map((p) => [p.id, p]));

    let totalMonthlyRevenue = 0;
    const schoolsByPlan: Record<string, number> = {};

    schools.forEach((school) => {
      if (school.planId) {
        const plan = planMap.get(school.planId);
        if (plan) {
          totalMonthlyRevenue += Number(plan.priceMonthly);
          schoolsByPlan[plan.name] = (schoolsByPlan[plan.name] || 0) + 1;
        }
      }
    });

    const paidCount = paymentStats.find((row) => row.status === "VERIFIED")?._count ?? 0;
    const totalPayments = paymentStats.reduce((sum, row) => sum + row._count, 0);
    const collectionRate = totalPayments > 0 ? (paidCount / totalPayments) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalMonthlyRevenue,
        activeTenants: schools.length,
        averageRevenuePerTenant: schools.length > 0 ? totalMonthlyRevenue / schools.length : 0,
        collectionRate,
      },
      distribution: Object.entries(schoolsByPlan).map(([name, count]) => ({ name, count })),
      recentPayments: recentPayments.map((payment) => ({
        id: payment.id,
        schoolName: payment.student.school?.name || "École non liée",
        amount: Number(payment.amount),
        paidAt: payment.paidAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    logger.error("Error fetching platform finance summary", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des finances" },
      { status: 500 }
    );
  }
    },
    {},
);

