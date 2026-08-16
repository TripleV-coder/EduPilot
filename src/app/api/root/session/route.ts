import { NextResponse } from "next/server";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";

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

  const isRoot =
    session.user.role === "SUPER_ADMIN" &&
    isRootUserEmail(session.user.email ?? "") &&
    hasValidRootSession(session);

  return NextResponse.json({ isRoot });
    },
    {},
);

