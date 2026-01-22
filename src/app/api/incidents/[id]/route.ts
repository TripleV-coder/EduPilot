import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateIncidentSchema = z.object({
  isResolved: z.boolean().optional(),
  followUpNotes: z.string().optional(),
  actionTaken: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const incident = await prisma.behaviorIncident.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        sanctions: {
          include: {
            assignedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!incident) {
      return NextResponse.json({ error: "Incident non trouvé" }, { status: 404 });
    }

    return NextResponse.json(incident);
  } catch (error) {
    logger.error(" fetching incident:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateIncidentSchema.parse(body);

    const updateData: any = { ...validatedData };
    if (validatedData.isResolved) {
      updateData.resolvedAt = new Date();
    }

    const incident = await prisma.behaviorIncident.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(incident);
  } catch (error) {
    logger.error(" updating incident:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
