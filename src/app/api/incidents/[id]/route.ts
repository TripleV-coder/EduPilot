import { NextResponse } from "next/server";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { syncAnalyticsAfterStudentActivityChange } from "@/lib/services/analytics-sync";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { incidentVisibilityWhere } from "@/lib/security/incident-visibility";
import { createApiHandler } from "@/lib/api/api-helpers";

const updateIncidentSchema = z.object({
  isResolved: z.boolean().optional(),
  followUpNotes: z.string().optional(),
  actionTaken: z.string().optional(),
});

export const GET = createApiHandler(
  async (_request, { session, params }) => {
    try {
      const { id } = await params;
      const guard = await assertModelAccess(session, "incident", id, "Incident non trouvé");
      if (guard) return guard;

      // Même visibilité que la liste : un parent ou un élève ne lit que les
      // incidents de son enfant ou les siens, un enseignant ceux qu'il a signalés
      const visibility = await incidentVisibilityWhere(session);
      if (!visibility) return NextResponse.json({ error: "Incident non trouvé" }, { status: 404 });

      const incident = await prisma.behaviorIncident.findFirst({
        where: { AND: [{ id }, visibility] },
        include: {
          // Nom de l'élève seulement, jamais sa fiche complète
          student: {
            select: {
              id: true,
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
  },
);

export const PATCH = createApiHandler(
  async (request, { session, params }) => {
    try {
      const { id } = await params;
      const guard = await assertModelAccess(session, "incident", id, "Incident non trouvé");
      if (guard) return guard;
      // Un enseignant ne modifie que les incidents qu'il voit (ceux qu'il a signalés)
      const visibility = await incidentVisibilityWhere(session);
      if (!visibility || !(await prisma.behaviorIncident.count({ where: { AND: [{ id }, visibility] } }))) {
        return NextResponse.json({ error: "Incident non trouvé" }, { status: 404 });
      }

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
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
);
