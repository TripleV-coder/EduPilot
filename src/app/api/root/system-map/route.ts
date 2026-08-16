import { NextResponse } from "next/server";
import { requireRoot } from "@/lib/security/require-root";
import { getRootSystemMap } from "@/lib/services/root-system-map";
import { logger } from "@/lib/utils/logger";

import { createApiHandler } from "@/lib/api/api-helpers";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
    async (request, context) => {

  const session = context.session;
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const payload = await getRootSystemMap();
    return NextResponse.json(payload);
  } catch (error) {
    logger.error("Error loading root system map", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du chargement de la cartographie système" },
      { status: 500 }
    );
  }
    },
    {},
);

