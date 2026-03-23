import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const sanctionSchema = z.object({
  type: z.enum(["WARNING", "DETENTION", "SUSPENSION", "EXPULSION", "COMMUNITY_SERVICE", "LOSS_OF_PRIVILEGE", "PARENT_CONFERENCE", "COUNSELING", "OTHER"]),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "incident", id, "Incident non trouvé");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = sanctionSchema.parse(body);

    const sanction = await prisma.sanction.create({
      data: {
        incidentId: id,
        type: validatedData.type,
        description: validatedData.description,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
        assignedById: session.user.id,
      },
    });

    return NextResponse.json(sanction, { status: 201 });
  } catch (error) {
    logger.error(" creating sanction:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
