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

    return NextResponse.json({
      summary: {
        totalMonthlyRevenue,
        activeTenants: schools.length,
        averageRevenuePerTenant: schools.length > 0 ? totalMonthlyRevenue / schools.length : 0,
      },
      distribution: Object.entries(schoolsByPlan).map(([name, count]) => ({ name, count })),
    });
  } catch (error) {
    logger.error("Error fetching platform finance summary", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du calcul des finances" },
      { status: 500 }
    );
  }
}
