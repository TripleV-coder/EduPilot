import { NextResponse } from "next/server";
import { getGlobalDashboardData } from "@/lib/services/analytics-dashboard";
import { requireRoot } from "@/lib/security/require-root";

import { createApiHandler } from "@/lib/api/api-helpers";
export const GET = createApiHandler(
    async (request, context) => {

  const session = context.session;
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  const data = await getGlobalDashboardData();

  return NextResponse.json({
    totalSchools: data.totalSchools,
    totalUsers: data.totalUsers,
    storageUsed: data.storageUsed,
    recentSchools: data.recentSchools,
    recentActivity: data.recentActivity,
  });
    },
    {},
);

