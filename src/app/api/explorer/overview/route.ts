import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { runAsSystem } from "@/lib/db/db-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = createApiHandler(async (request, context) => {

  try {
    // Anonyme : chiffres des seules écoles publiées, comptés au titre du système
    // (sans session, la RLS masquerait les effectifs). Connecté : inchangé.
    // Session en attente du second facteur : traitée comme anonyme (route publique,
    // createApiHandler ne l'arrête pas quand requireAuth vaut false).
    const anonymous =
      !context.session?.user || (context.session.user.isTwoFactorEnabled && !context.session.user.isTwoFactorAuthenticated);
    const published = { isActive: true, isPublic: true };
    const countAll = () =>
      Promise.all([
        prisma.school.count({ where: anonymous ? published : { isActive: true } }),
        prisma.studentProfile.count({ where: anonymous ? { deletedAt: null, school: published } : { deletedAt: null } }),
        prisma.class.count(anonymous ? { where: { school: published } } : undefined),
        prisma.teacherProfile.count({ where: anonymous ? { deletedAt: null, school: published } : { deletedAt: null } }),
      ]);
    const [schoolsCount, studentsCount, classesCount, teachersCount] = anonymous
      ? await runAsSystem("explorateur public : statistiques des écoles publiées", countAll)
      : await countAll();

    return NextResponse.json(
      {
        schools: schoolsCount,
        students: studentsCount,
        classes: classesCount,
        teachers: teachersCount,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    logger.error("Explorer overview error", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des statistiques réelles" },
      { status: 500 }
    );
  }

}, { requireAuth: false });
