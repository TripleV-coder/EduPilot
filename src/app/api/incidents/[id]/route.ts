import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { syncAnalyticsAfterStudentActivityChange } from "@/lib/services/analytics-sync";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const updateIncidentSchema = z.object({
  isResolved: z.boolean().optional(),
  followUpNotes: z.string().optional(),
  actionTaken: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const guard = await assertModelAccess(session, "incident", id, "Incident non trouvé");
    if (guard) return guard;

    const incident = await prisma.behaviorIncident.findUnique({
      where: { id: id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "incident", id, "Incident non trouvé");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = updateIncidentSchema.parse(body);

    const updateData: Prisma.BehaviorIncidentUpdateInput = { ...validatedData };
    if (validatedData.isResolved) {
      updateData.resolvedAt = new Date();
    }

    const incident = await prisma.behaviorIncident.update({
      where: { id: id },
      data: updateData,
    });

    await syncAnalyticsAfterStudentActivityChange(
      [incident.studentId],
      incident.date
    );
    await invalidateByPath("/api/analytics");

    return NextResponse.json(incident);
  } catch (error) {
    logger.error(" updating incident:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
