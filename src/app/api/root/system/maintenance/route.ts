import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRoot } from "@/lib/security/require-root";
import prisma from "@/lib/prisma";
import {
  MAINTENANCE_ENABLED_KEY,
  MAINTENANCE_MESSAGE_KEY,
  DEFAULT_MAINTENANCE_MESSAGE,
  getMaintenanceState,
  invalidateMaintenanceCache,
} from "@/lib/system/maintenance";

export const dynamic = "force-dynamic";

/** Longueur maximale du message de maintenance personnalisé. */
const MAX_MESSAGE_LENGTH = 500;

/**
 * GET /api/root/system/maintenance
 * Retourne l'état du mode maintenance + le message personnalisé courant.
 */
export async function GET() {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  const state = await getMaintenanceState();
  return NextResponse.json(state);
}

/**
 * POST /api/root/system/maintenance
 * Active ou désactive le mode maintenance et persiste un message optionnel.
 * Body: { enabled: boolean, message?: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const enabled = !!body.enabled;

  await prisma.systemSetting.upsert({
    where: { key: MAINTENANCE_ENABLED_KEY },
    update: { value: String(enabled), updatedBy: session?.user?.id },
    create: {
      key: MAINTENANCE_ENABLED_KEY,
      value: String(enabled),
      type: "boolean",
      updatedBy: session?.user?.id,
    },
  });

  // Le message personnalisé n'est mis à jour que s'il est fourni explicitement.
  if (typeof body.message === "string") {
    const message = body.message.trim().slice(0, MAX_MESSAGE_LENGTH);
    await prisma.systemSetting.upsert({
      where: { key: MAINTENANCE_MESSAGE_KEY },
      update: { value: message, updatedBy: session?.user?.id },
      create: {
        key: MAINTENANCE_MESSAGE_KEY,
        value: message,
        type: "string",
        updatedBy: session?.user?.id,
      },
    });
  }

  invalidateMaintenanceCache();

  const state = await getMaintenanceState();
  return NextResponse.json({
    enabled: state.enabled,
    message: state.message,
    defaultMessage: DEFAULT_MAINTENANCE_MESSAGE,
  });
}
