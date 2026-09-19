import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { checkStudentQuota } from "@/lib/saas/quotas";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { importStudentsAllOrNothing } from "@/lib/import/student-import";

/**
 * POST /api/students/bulk-import — { students: [...] } (appel direct de l'API ;
 * aucun écran ne l'utilise, l'écran d'import passe par /api/import/students).
 *
 * N52 : mêmes règles que /api/import/students (lib/import/student-import) —
 * tout le lot validé d'abord ; à la moindre erreur 422 et rien d'écrit, rapport
 * { row, field, message } ; sinon une seule transaction :
 * 200 { created, credentials, errors: [], warnings }.
 * Avant : lignes en erreur ignorées et autres créées ; un parent rattaché à
 * l'élève par simple email, sans vérification — chemin écarté par N50.
 */
const bodySchema = z.object({
  // Cap anti-DoS à 500 lignes/lot (cohérent avec /api/import/{students,teachers,parents}).
  // Les lignes elles-mêmes sont validées par l'import, qui situe chaque erreur.
  students: z
    .array(z.unknown())
    .min(1, "Aucun élève à importer.")
    .max(500, "Maximum 500 lignes par import. Découpez votre fichier."),
});

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const body = await request.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: validation.error.issues
      }, { status: 400 });
    }

    const { students } = validation.data;

    // Quota check before processing
    const quota = await checkStudentQuota(schoolId);
    if (!quota.allowed) {
      return NextResponse.json({
        error: `Quota d'élèves atteint (${quota.limit}). Veuillez passer à un plan supérieur.`,
        code: "QUOTA_EXCEEDED"
      }, { status: 403 });
    }

    if (quota.current + students.length > quota.limit) {
      return NextResponse.json({
        error: `L'import de ${students.length} élèves dépasserait votre quota restant de ${quota.limit - quota.current}.`,
        code: "QUOTA_WILL_EXCEED"
      }, { status: 403 });
    }

    const outcome = await importStudentsAllOrNothing(schoolId, students);
    if (outcome.status === 200 && outcome.body.created > 0) {
      await invalidateByPath(CACHE_PATHS.students).catch(() => { });
    }
    return NextResponse.json(outcome.body, { status: outcome.status });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE],
  }
);

export const GET = createApiHandler(
  async (_request, _context, _t) => {
    // Modèle CSV. Pas de colonne « email du parent » (N50/N52) : le rattachement
    // des parents passe par l'import « Parents » (matricule de l'enfant).
    const template = `email,firstName,lastName,className,dateOfBirth,gender,birthPlace,address
jean.dupont@exemple.com,Jean,Dupont,Terminale A1,01/01/2005,M,Cotonou,Akpakpa
marie.martin@exemple.com,Marie,Martin,Terminale A1,15/05/2005,F,Porto-Novo,Avakpa`;

    return new NextResponse(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=modele_import_eleves_complet.csv",
      },
    });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.STUDENT_CREATE],
  }
);
