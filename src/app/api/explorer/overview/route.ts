import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";
import { runAsSystem } from "@/lib/db/db-context";
import { getAccessibleSchoolIds, getActiveSchoolId } from "@/lib/api/tenant-isolation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = createApiHandler(async (request, context) => {

  try {
    // Anonyme : chiffres des seules écoles publiées, comptés au titre du système
    // (sans session, la RLS masquerait les effectifs). Connecté : ses écoles seulement.
    // Session en attente du second facteur : traitée comme anonyme (route publique,
    // createApiHandler ne l'arrête pas quand requireAuth vaut false).
    const anonymous =
      !context.session?.user || (context.session.user.isTwoFactorEnabled && !context.session.user.isTwoFactorAuthenticated);
    const published = { isActive: true, isPublic: true };
    // Connecté : périmètre de l'utilisateur (ses écoles), jamais toute la
    // plateforme — écoles, classes et enseignants ne sont pas sous RLS.
    // SUPER_ADMIN garde la vue globale.
    const session = context.session;
    const scopedIds = !anonymous && session?.user.role !== "SUPER_ADMIN"
      ? Array.from(new Set([getActiveSchoolId(session), ...getAccessibleSchoolIds(session)].filter((id): id is string => Boolean(id))))
      : null;
    const schoolScope = anonymous ? published : scopedIds ? { isActive: true, id: { in: scopedIds } } : { isActive: true };
    const countAll = () =>
      Promise.all([
        prisma.school.count({ where: schoolScope }),
        prisma.studentProfile.count({ where: { deletedAt: null, school: schoolScope } }),
        prisma.class.count({ where: { school: schoolScope } }),
        prisma.teacherProfile.count({ where: { deletedAt: null, school: schoolScope } }),
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
