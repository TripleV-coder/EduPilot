import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
 * GET /api/root/data-requests
 * Liste les demandes d'accès aux données en attente
 */
export async function GET() {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  const requests = await prisma.dataAccessRequest.findMany({
    where: { status: "PENDING" },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, role: true, email: true },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json({ data: requests });
}

/**
 * PATCH /api/root/data-requests
 * Approuve ou rejette une demande
 * Body: { id: string, action: "APPROVE" | "REJECT" }
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const { id, action } = body as { id?: string; action?: string };

  if (!id || !["APPROVE", "REJECT"].includes(action ?? "")) {
    return NextResponse.json({ error: "id et action (APPROVE|REJECT) requis" }, { status: 400 });
  }

  const updated = await prisma.dataAccessRequest.update({
    where: { id },
    data: {
      status: action === "APPROVE" ? "COMPLETED" : "REJECTED",
      completedAt: new Date(),
      processedBy: session?.user?.id,
    },
  });

  return NextResponse.json({ data: updated });
}
