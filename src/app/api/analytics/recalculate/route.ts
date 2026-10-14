import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";

export const dynamic = "force-dynamic";

/**
 * Recalcul des analyses (moyennes, niveaux de performance, niveaux de risque)
 * de tous les élèves d'un établissement, pour l'année en cours.
 *
 * Avant : un second modèle de risque, rudimentaire, écrasait le niveau de
 * risque calculé par le modèle officiel ; il comptait une moyenne absente comme
 * 0 (élève non évalué → « risque élevé ») et acceptait l'identifiant de
 * n'importe quel établissement. Désormais : le calcul officiel (paramètres de
 * l'école, aucune valeur absente comptée 0), limité à son propre établissement.
 */
export const POST = createApiHandler(
  async (request, context) => {
    const session = context.session;

    const body = (await request.json().catch(() => ({}))) as { schoolId?: unknown };
    const requested = typeof body.schoolId === "string" ? body.schoolId : null;
    const targetSchoolId = requested || getActiveSchoolId(session);

    if (!targetSchoolId) {
      return NextResponse.json({ error: "schoolId requis" }, { status: 400 });
    }
    if (!canAccessSchool(session, targetSchoolId)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    try {
      const year = await prisma.academicYear.findFirst({
        where: { schoolId: targetSchoolId, isCurrent: true },
        select: { id: true },
      });
      if (!year) {
        return NextResponse.json({ error: "Aucune année scolaire en cours" }, { status: 400 });
      }

      const result = await syncAllStudentsForSchool(targetSchoolId, year.id);
      logger.info(`Analytics recalculated for school ${targetSchoolId}: ${result.processed} students processed.`);

      return NextResponse.json({
        success: true,
        processed: result.processed,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error in analytics recalculate job", error as Error);
      return NextResponse.json({ error: "Erreur lors du calcul" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
);
