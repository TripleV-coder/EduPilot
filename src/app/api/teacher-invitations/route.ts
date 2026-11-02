import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import {
  generateTeacherInvitationCode,
  hashTeacherInvitationCode,
  teacherInvitationExpiry,
} from "@/lib/teachers/invitation-code";

const SCHOOL_MANAGERS = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
/** Codes en circulation au même moment, par école (anti-abus). */
const MAX_OPEN_INVITATIONS = 20;

/**
 * GET /api/teacher-invitations — pour l'école active : codes encore valables
 * (jamais le code lui-même, seulement sa date) et enseignants rattachés depuis
 * une autre école.
 */
export const GET = createApiHandler(
  async (_request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });

    const now = new Date();
    const [invitations, members] = await Promise.all([
      prisma.teacherInvitation.findMany({
        where: { schoolId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, expiresAt: true },
      }),
      prisma.teacherSchoolAssignment.findMany({
        where: { schoolId, status: "ACTIVE", isPrimary: false, teacher: { schoolId: { not: schoolId } } },
        orderBy: { startDate: "desc" },
        select: {
          teacherId: true,
          startDate: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          teacher: { select: { school: { select: { name: true } } } },
        },
      }),
    ]);

    return NextResponse.json({
      invitations,
      members: members.map((m) => ({
        teacherId: m.teacherId,
        name: `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim(),
        email: m.user.email,
        primarySchoolName: m.teacher.school?.name ?? null,
        since: m.startDate,
      })),
    });
  },
  { allowedRoles: SCHOOL_MANAGERS },
);

/**
 * POST /api/teacher-invitations — émet un code d'invitation à usage unique
 * (7 jours) pour un enseignant qui a DÉJÀ un compte EduPilot. Le code n'est
 * renvoyé qu'ici, une seule fois ; seule son empreinte est conservée.
 */
export const POST = createApiHandler(
  async (_request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });

    const open = await prisma.teacherInvitation.count({
      where: { schoolId, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (open >= MAX_OPEN_INVITATIONS) {
      return NextResponse.json(
        { error: `${MAX_OPEN_INVITATIONS} codes sont déjà en circulation : révoquez-en avant d'en créer un autre.` },
        { status: 409 },
      );
    }

    const code = generateTeacherInvitationCode();
    const invitation = await prisma.teacherInvitation.create({
      data: {
        schoolId,
        codeHash: hashTeacherInvitationCode(code),
        createdById: session.user.id,
        expiresAt: teacherInvitationExpiry(),
      },
      select: { id: true, expiresAt: true },
    });

    await createAuditLog({
      userId: session.user.id,
      action: "TEACHER_INVITATION_CREATE",
      entity: "TeacherInvitation",
      entityId: invitation.id,
      schoolId,
      newValues: { expiresAt: invitation.expiresAt.toISOString() },
    });

    return NextResponse.json({ id: invitation.id, code, expiresAt: invitation.expiresAt }, { status: 201 });
  },
  { allowedRoles: SCHOOL_MANAGERS },
);
