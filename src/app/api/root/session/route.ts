import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/root/session
 * Vérifie si l'utilisateur courant a une session root valide
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ isRoot: false });
  }

  const isRoot =
    session.user.role === "SUPER_ADMIN" &&
    isRootUserEmail(session.user.email ?? "") &&
    hasValidRootSession(session);

  return NextResponse.json({ isRoot });
}
