import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isRootUserEmail } from "@/lib/security/root-access";

export const dynamic = "force-dynamic";

/**
 * POST /api/root/auth
 * Authentification root additionnelle via secret (double vérification)
 * Le client envoie { secret: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (session.user.role !== "SUPER_ADMIN" || !isRootUserEmail(session.user.email ?? "")) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { secret } = body as { secret?: string };

  const rootSecret = process.env.ROOT_SECRET;
  if (!rootSecret) {
    return NextResponse.json({ error: "ROOT_SECRET non configuré" }, { status: 500 });
  }

  if (!secret || secret !== rootSecret) {
    return NextResponse.json({ error: "Secret root invalide" }, { status: 403 });
  }

  return NextResponse.json({ success: true, isRoot: true });
}
