import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { detachTeacherFromSchool } from "@/lib/teachers/school-membership";

/**
 * DELETE /api/teachers/[id]/membership — l'école active retire un enseignant
 * rattaché depuis une autre école. Le rattachement est désactivé (historique
 * des notes conservé) et ses cours dans cette école lui sont retirés.
 * L'école principale d'un enseignant ne se retire pas ici.
 */
export const DELETE = createApiHandler(
  async (_request, { session, params }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    const { id } = await params;

    const result = await detachTeacherFromSchool({ teacherId: id, schoolId, actorUserId: session.user.id, by: "SCHOOL" });
    if (!result.ok) {
      return result.reason === "PRIMARY_SCHOOL"
        ? NextResponse.json(
            { error: "C'est l'établissement principal de cet enseignant : son compte se gère depuis la fiche du personnel." },
            { status: 409 },
          )
        : NextResponse.json({ error: "Cet enseignant n'est pas rattaché à votre établissement." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
