/**
 * Rattachement d'un enseignant à des établissements supplémentaires.
 *
 * - Rejoindre : l'enseignant saisit le code d'invitation remis par l'école ;
 *   le code est consommé de façon atomique (une seule utilisation, même en
 *   cas de saisies simultanées).
 * - Quitter (l'enseignant) / retirer (l'établissement) : le rattachement est
 *   désactivé, jamais supprimé (l'historique des notes reste intact), et ses
 *   cours dans cette école lui sont retirés — sans quoi l'école resterait
 *   accessible via ses affectations (`school-access.ts`).
 * - L'établissement principal ne se quitte pas par ce biais : il porte le
 *   compte (création, mot de passe provisoire) et se gère par l'administration.
 */
import prisma from "@/lib/prisma";
import { hashTeacherInvitationCode, isWellFormedTeacherInvitationCode } from "./invitation-code";

export type JoinResult =
    | { ok: true; schoolId: string; schoolName: string; alreadyMember: boolean }
    | { ok: false; reason: "INVALID_CODE" | "NOT_A_TEACHER" | "SCHOOL_INACTIVE" };

export async function joinSchoolWithInvitation(params: { userId: string; code: string }): Promise<JoinResult> {
    // Réponse identique pour un code mal formé, inconnu, utilisé, révoqué ou
    // expiré : aucune information sur l'existence d'un code.
    if (!isWellFormedTeacherInvitationCode(params.code)) return { ok: false, reason: "INVALID_CODE" };

    const teacher = await prisma.teacherProfile.findUnique({
        where: { userId: params.userId },
        select: { id: true, schoolId: true, deletedAt: true, user: { select: { role: true } } },
    });
    if (!teacher || teacher.deletedAt || teacher.user.role !== "TEACHER") return { ok: false, reason: "NOT_A_TEACHER" };

    const now = new Date();
    const invitation = await prisma.teacherInvitation.findUnique({
        where: { codeHash: hashTeacherInvitationCode(params.code) },
        select: { id: true, schoolId: true, usedAt: true, revokedAt: true, expiresAt: true, school: { select: { name: true, isActive: true } } },
    });
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= now) {
        return { ok: false, reason: "INVALID_CODE" };
    }
    if (!invitation.school.isActive) return { ok: false, reason: "SCHOOL_INACTIVE" };

    const existing = await prisma.teacherSchoolAssignment.findUnique({
        where: { teacherId_schoolId: { teacherId: teacher.id, schoolId: invitation.schoolId } },
        select: { status: true },
    });
    if (existing?.status === "ACTIVE" || teacher.schoolId === invitation.schoolId) {
        // Déjà membre : le code n'est pas consommé, il reste utilisable par la bonne personne
        return { ok: true, schoolId: invitation.schoolId, schoolName: invitation.school.name, alreadyMember: true };
    }

    const consumed = await prisma.$transaction(async (tx) => {
        // Consommation atomique : une seule saisie gagne, même simultanée
        const claim = await tx.teacherInvitation.updateMany({
            where: { id: invitation.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
            data: { usedAt: now, usedByUserId: params.userId },
        });
        if (claim.count !== 1) return false;
        await tx.teacherSchoolAssignment.upsert({
            where: { teacherId_schoolId: { teacherId: teacher.id, schoolId: invitation.schoolId } },
            create: { teacherId: teacher.id, userId: params.userId, schoolId: invitation.schoolId, status: "ACTIVE", isPrimary: false, startDate: now },
            update: { status: "ACTIVE", startDate: now, endDate: null },
        });
        await tx.auditLog.create({
            data: {
                userId: params.userId,
                schoolId: invitation.schoolId,
                action: "TEACHER_JOINED_SCHOOL",
                entity: "TeacherSchoolAssignment",
                entityId: teacher.id,
                newValues: { invitationId: invitation.id },
            },
        });
        return true;
    });
    if (!consumed) return { ok: false, reason: "INVALID_CODE" };
    return { ok: true, schoolId: invitation.schoolId, schoolName: invitation.school.name, alreadyMember: false };
}

export type DetachResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "PRIMARY_SCHOOL" };

/**
 * Désactive le rattachement d'un enseignant à un établissement et lui retire
 * ses cours et ses classes principales dans cet établissement.
 */
export async function detachTeacherFromSchool(params: {
    teacherId: string;
    schoolId: string;
    actorUserId: string;
    by: "TEACHER" | "SCHOOL";
}): Promise<DetachResult> {
    const teacher = await prisma.teacherProfile.findUnique({
        where: { id: params.teacherId },
        select: { id: true, schoolId: true, schoolAssignments: { where: { schoolId: params.schoolId }, select: { status: true, isPrimary: true } } },
    });
    const assignment = teacher?.schoolAssignments[0];
    if (!teacher || !assignment || assignment.status !== "ACTIVE") return { ok: false, reason: "NOT_FOUND" };
    if (assignment.isPrimary || teacher.schoolId === params.schoolId) return { ok: false, reason: "PRIMARY_SCHOOL" };

    const now = new Date();
    await prisma.$transaction(async (tx) => {
        await tx.teacherSchoolAssignment.update({
            where: { teacherId_schoolId: { teacherId: teacher.id, schoolId: params.schoolId } },
            data: { status: "INACTIVE", endDate: now },
        });
        const courses = await tx.classSubject.updateMany({
            where: { teacherId: teacher.id, class: { schoolId: params.schoolId } },
            data: { teacherId: null },
        });
        const mainClasses = await tx.class.updateMany({
            where: { mainTeacherId: teacher.id, schoolId: params.schoolId },
            data: { mainTeacherId: null },
        });
        await tx.auditLog.create({
            data: {
                userId: params.actorUserId,
                schoolId: params.schoolId,
                action: params.by === "TEACHER" ? "TEACHER_LEFT_SCHOOL" : "TEACHER_REMOVED_FROM_SCHOOL",
                entity: "TeacherSchoolAssignment",
                entityId: teacher.id,
                newValues: { coursesUnassigned: courses.count, mainClassesUnassigned: mainClasses.count },
            },
        });
    });
    return { ok: true };
}
