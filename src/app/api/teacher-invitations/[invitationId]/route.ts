import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";

/** DELETE /api/teacher-invitations/[id] — révoque un code encore valable de l'école active. */
export const DELETE = createApiHandler(
  async (_request, { session, params }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    const { invitationId } = await params;

    const revoked = await prisma.teacherInvitation.updateMany({
      where: { id: invitationId, schoolId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) {
      return NextResponse.json({ error: "Code introuvable ou déjà utilisé" }, { status: 404 });
    }

    await createAuditLog({
      userId: session.user.id,
      action: "TEACHER_INVITATION_REVOKE",
      entity: "TeacherInvitation",
      entityId: invitationId,
      schoolId,
    });
    return NextResponse.json({ success: true });
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
