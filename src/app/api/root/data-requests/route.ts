import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRoot } from "@/lib/security/require-root";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
