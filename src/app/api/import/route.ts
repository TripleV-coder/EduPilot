import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { checkStudentQuota } from "@/lib/saas/quotas";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { importStudentsAllOrNothing } from "@/lib/import/student-import";

/**
 * POST /api/import — { type: "STUDENTS", data: [...], schoolId? } (appel direct
 * de l'API ; l'écran d'import passe par /api/import/students).
 *
 * N55 : mêmes règles que /api/import/students (lib/import/student-import,
 * N46, N50, N54) — tout le lot validé d'abord ; à la moindre erreur 422 et
 * rien d'écrit, rapport { row, field, message } ; sinon une transaction :
 * 200 { created, credentials, errors: [], warnings }.
 * Avant : l'établissement de la requête était pris tel quel pour tout rôle ;
 * un prénom ou un nom manquant devenait « Élève » / « Nouveau » ; classe, date
 * de naissance, genre et adresse étaient ignorés ; aucune validation.
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    const { type, data, schoolId: requestedSchoolId } = await request.json();

    // Seul le SUPER_ADMIN choisit l'établissement ; les autres rôles importent dans le leur.
    const targetSchoolId =
      session.user.role === "SUPER_ADMIN"
        ? requestedSchoolId || getActiveSchoolId(session)
        : getActiveSchoolId(session);

    if (!targetSchoolId) {
      return NextResponse.json({ error: "Établissement requis" }, { status: 400 });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Données invalides ou vides" }, { status: 400 });
    }

    // Cap anti-DoS : une transaction non bornée bloquerait la connexion DB
    if (data.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 lignes par import. Découpez votre fichier." },
        { status: 400 }
      );
    }

    if (type !== "STUDENTS") {
      return NextResponse.json(
        {
          error: "Type d'import non supporté par cet endpoint.",
          code: "UNSUPPORTED_IMPORT_TYPE",
          supported: ["STUDENTS"],
        },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({ where: { id: targetSchoolId }, select: { id: true } });
    if (!school) {
      return NextResponse.json({ error: "Établissement introuvable" }, { status: 400 });
    }

    const quota = await checkStudentQuota(targetSchoolId);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: `Quota d'élèves atteint (${quota.limit}).`, code: "QUOTA_EXCEEDED" },
        { status: 403 }
      );
    }
    if (quota.current + data.length > quota.limit) {
      return NextResponse.json(
        { error: `L'import dépasserait votre quota restant de ${quota.limit - quota.current}.`, code: "QUOTA_WILL_EXCEED" },
        { status: 403 }
      );
    }

    const outcome = await importStudentsAllOrNothing(targetSchoolId, data);
    if (outcome.status === 200 && outcome.body.created > 0) {
      await invalidateByPath(CACHE_PATHS.students).catch(() => { });
    }
    return NextResponse.json(outcome.body, { status: outcome.status });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE, Permission.USER_CREATE],
  }
);
