import { NextResponse } from "next/server";
import { hasValidRootSession } from "@/lib/security/root-access";

import { createApiHandler } from "@/lib/api/api-helpers";
export const dynamic = "force-dynamic";

/**
 * GET /api/root/session
 * Vérifie si l'utilisateur courant a une session root valide
 */
export const GET = createApiHandler(
    async (request, context) => {

  const session = context.session;

  if (!session?.user) {
    return NextResponse.json({ isRoot: false });
  }

  // SUPER_ADMIN, et membre de ROOT_USER_EMAILS si la liste est définie (N36).
  const isRoot = hasValidRootSession(session);

  return NextResponse.json({ isRoot });
    },
    {},
);

