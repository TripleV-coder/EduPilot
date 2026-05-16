import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRoot } from "@/lib/security/require-root";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAINTENANCE_KEY = "maintenance_mode";

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
