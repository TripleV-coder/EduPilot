import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGlobalDashboardData } from "@/lib/services/analytics-dashboard";
import { requireRoot } from "@/lib/security/require-root";

export async function GET() {
  const session = await auth();
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
}
