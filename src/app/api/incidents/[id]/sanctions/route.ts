import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { createApiHandler } from "@/lib/api/api-helpers";

const sanctionSchema = z.object({
  type: z.enum(["WARNING", "DETENTION", "SUSPENSION", "EXPULSION", "COMMUNITY_SERVICE", "LOSS_OF_PRIVILEGE", "PARENT_CONFERENCE", "COUNSELING", "OTHER"]),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export const POST = createApiHandler(
  async (request, { session, params }) => {
    try {
      const { id } = await params;
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
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
