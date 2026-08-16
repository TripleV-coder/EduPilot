import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { ensureRequestedSchoolAccess } from "@/lib/api/tenant-isolation";
import { hasPermission } from "@/lib/rbac/permissions";
import { Permission } from "@/lib/rbac/permissions";
import { orderedCycles, normalizeOfferedLevels, type RealCycle } from "@/lib/benin/levels";
import { createApiHandler } from "@/lib/api/api-helpers";

const REAL_CYCLES = ["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE"] as const;
const bodySchema = z.object({
  offeredLevels: z.array(z.enum(REAL_CYCLES)).min(1, "Au moins un cycle est requis."),
});

/**
 * GET /api/schools/[id]/levels — cycles offerts par l'école + référentiel.
 * PATCH — met à jour les cycles offerts (SCHOOL_ADMIN/SUPER_ADMIN).
 */
export const GET = createApiHandler(async (request, context) => {
        const { id } = await context.params;
        const session = context.session;
  const accessError = ensureRequestedSchoolAccess(session, id);
  if (accessError) return accessError;

  if (!hasPermission(session.user.role, Permission.SCHOOL_READ)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const school = await prisma.school.findUnique({
    where: { id },
    select: { id: true, name: true, level: true, offeredLevels: true },
  });
  if (!school) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });

  return NextResponse.json({
    schoolId: school.id,
    offeredLevels: normalizeOfferedLevels(school.offeredLevels),
    // Référentiel pour l'UI de configuration (cycles, classes, examen, séries)
    cycles: orderedCycles().map((c) => ({
      level: c.level,
      label: c.label,
      grades: c.grades,
      finalExam: c.finalExam,
      hasSeries: Boolean(c.series),
    })),
  });

});

export const PATCH = createApiHandler(async (request, context) => {
        const { id } = await context.params;
        const session = context.session;
  const accessError = ensureRequestedSchoolAccess(session, id);
  if (accessError) return accessError;

  if (!hasPermission(session.user.role, Permission.SCHOOL_UPDATE)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const offered = normalizeOfferedLevels(parsed.data.offeredLevels as RealCycle[]);

  const existing = await prisma.school.findUnique({
    where: { id },
    select: { offeredLevels: true },
  });
  if (!existing) return NextResponse.json({ error: "Établissement introuvable" }, { status: 404 });

  // Garde-fou : interdire le retrait d'un cycle qui a encore des classes-niveaux.
  const removed = existing.offeredLevels.filter((lvl) => !offered.includes(lvl as RealCycle));
  if (removed.length > 0) {
    const blocking = await prisma.classLevel.count({
      where: { schoolId: id, level: { in: removed } },
    });
    if (blocking > 0) {
      return NextResponse.json(
        {
          error:
            "Impossible de retirer un cycle qui contient encore des classes. Archivez d'abord les niveaux concernés.",
          code: "CYCLE_HAS_CLASSES",
          blockingLevels: removed,
        },
        { status: 409 }
      );
    }
  }

  // School.level (legacy) reste cohérent : cycle unique → ce cycle ; sinon MIXED.
  const legacyLevel = offered.length === 1 ? offered[0] : "MIXED";

  const updated = await prisma.school.update({
    where: { id },
    data: { offeredLevels: offered, level: legacyLevel },
    select: { offeredLevels: true, level: true },
  });

  logger.info("Cycles offerts mis à jour", {
    schoolId: id,
    by: session.user.id,
    offeredLevels: updated.offeredLevels,
  });

  return NextResponse.json({ schoolId: id, offeredLevels: updated.offeredLevels });

});

