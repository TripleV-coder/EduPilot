import { Session } from "next-auth";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGlobalDashboardData } from "@/lib/services/analytics-dashboard";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";

function requireRoot(session: Session | null, userEmail?: string | null, userId?: string | null) {
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isRootUserEmail(userEmail) || !hasValidRootSession(session)) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }
  return null;
}

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
