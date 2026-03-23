import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAINTENANCE_KEY = "maintenance_mode";

function requireRoot(session: Session | null, userEmail?: string | null, userId?: string | null) {
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isRootUserEmail(userEmail) || !hasValidRootSession(session)) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }
  return null;
}

/**
 * GET /api/root/system/maintenance
 * Retourne l'état du mode maintenance
 */
export async function GET() {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  const setting = await prisma.systemSetting.findUnique({
    where: { key: MAINTENANCE_KEY },
  });

  return NextResponse.json({ enabled: setting?.value === "true" });
}

/**
 * POST /api/root/system/maintenance
 * Active ou désactive le mode maintenance
 * Body: { enabled: boolean }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const enabled = !!body.enabled;

  await prisma.systemSetting.upsert({
    where: { key: MAINTENANCE_KEY },
    update: { value: String(enabled), updatedBy: session?.user?.id },
    create: {
      key: MAINTENANCE_KEY,
      value: String(enabled),
      type: "boolean",
      updatedBy: session?.user?.id,
    },
  });

  return NextResponse.json({ enabled });
}
