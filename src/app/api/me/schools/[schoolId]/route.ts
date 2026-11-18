import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { detachTeacherFromSchool } from "@/lib/teachers/school-membership";

/**
 * DELETE /api/me/schools/[schoolId] — l'enseignant quitte un établissement
 * rattaché. Ses cours de cette école lui sont retirés ; ses notes restent.
 * L'établissement principal (qui porte le compte) ne se quitte pas ici.
 */
export const DELETE = createApiHandler(
  async (_request, { session, params }) => {
    const { schoolId } = await params;
    const teacher = await prisma.teacherProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!teacher) return NextResponse.json({ error: "Profil enseignant introuvable" }, { status: 404 });

    const result = await detachTeacherFromSchool({ teacherId: teacher.id, schoolId, actorUserId: session.user.id, by: "TEACHER" });
    if (!result.ok) {
      return result.reason === "PRIMARY_SCHOOL"
        ? NextResponse.json({ error: "Votre établissement principal ne se quitte pas d'ici : adressez-vous à sa direction." }, { status: 409 })
        : NextResponse.json({ error: "Vous n'êtes pas rattaché à cet établissement." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  },
  { allowedRoles: ["TEACHER"] },
);
