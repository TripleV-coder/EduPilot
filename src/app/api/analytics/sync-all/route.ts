import { NextResponse } from "next/server";
import { z } from "zod";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

const syncSchema = z.object({ academicYearId: z.string().min(1).max(64).optional() });

/**
 * POST /api/analytics/sync-all — recalcule les analyses de tous les élèves.
 *
 * Opération lourde : réservée au personnel pédagogique (les rôles de la page
 * Analyses). Elle était ouverte à tout compte connecté, et l'année demandée
 * n'était pas rattachée à l'établissement.
 */
export const POST = createApiHandler(
  async (request, context) => {
    try {
      const session = context.session;
      const schoolId = getActiveSchoolId(session);
      if (!schoolId) {
        return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
      }

      const parsed = syncSchema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        return NextResponse.json({ error: "Données invalides" }, { status: 400 });
      }
      const { academicYearId } = parsed.data;

      const year = await prisma.academicYear.findFirst({
        where: academicYearId ? { id: academicYearId, schoolId } : { schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!year) {
        return NextResponse.json(
          { error: academicYearId ? "Année scolaire introuvable" : "Année académique requise" },
          { status: academicYearId ? 404 : 400 }
        );
      }

      const result = await syncAllStudentsForSchool(schoolId, year.id);
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      logger.error("Error in global sync:", error as Error);
      return NextResponse.json({ error: "Erreur lors de la synchronisation globale" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }
);
