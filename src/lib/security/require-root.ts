import { Session } from "next-auth";
import { NextResponse } from "next/server";
import { hasValidRootSession } from "@/lib/security/root-access";

export function requireRoot(session: Session | null, userEmail?: string | null, userId?: string | null) {
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  // SUPER_ADMIN, et membre de ROOT_USER_EMAILS si la liste est définie (N36).
  if (!hasValidRootSession(session)) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }
  return null;
}
