import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { Permission } from "@/lib/rbac/permissions";
import { createAuditLog } from "@/lib/security/audit-log";
import { findScheduleConflict } from "@/lib/schedules/conflicts";

const time = z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Format d'heure invalide (attendu : HH:mm, ex. 08:30)");

const scheduleUpdateSchema = z
    .object({
        dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
        startTime: time.optional(),
        endTime: time.optional(),
        room: z.string().trim().max(50, "Le nom de la salle est trop long").nullable().optional(),
        classSubjectId: z.string().cuid().nullable().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

async function loadSchedule(id: string) {
    return prisma.schedule.findUnique({
        where: { id },
        select: {
            id: true, classId: true, classSubjectId: true, dayOfWeek: true, startTime: true, endTime: true, room: true,
            class: { select: { schoolId: true } },
            classSubject: { select: { teacherId: true } },
        },
    });
}

/**
 * PATCH /api/schedules/[id] — déplacer un créneau (jour, heures), changer sa
 * salle ou sa matière. Seule la création existait : un créneau mal placé ne
 * pouvait être ni corrigé ni retiré.
 */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = scheduleUpdateSchema.parse(await request.json());
        const current = await loadSchedule(id);
        if (!current || !canAccessSchool(session, current.class.schoolId)) {
            return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });
        }

        const next = {
            dayOfWeek: data.dayOfWeek ?? current.dayOfWeek,
            startTime: data.startTime ?? current.startTime,
            endTime: data.endTime ?? current.endTime,
            classSubjectId: data.classSubjectId === undefined ? current.classSubjectId : data.classSubjectId,
        };
        if (next.endTime <= next.startTime) {
            return NextResponse.json({ error: "L'heure de fin doit être après l'heure de début." }, { status: 400 });
        }

        let teacherId = current.classSubject?.teacherId ?? null;
        if (next.classSubjectId && next.classSubjectId !== current.classSubjectId) {
            const subject = await prisma.classSubject.findUnique({
                where: { id: next.classSubjectId },
                select: { classId: true, teacherId: true },
            });
            if (!subject || subject.classId !== current.classId) {
                return NextResponse.json({ error: "Cette matière n'appartient pas à la classe du créneau." }, { status: 400 });
            }
            teacherId = subject.teacherId;
        } else if (!next.classSubjectId) {
            teacherId = null;
        }

        const conflict = await findScheduleConflict({ classId: current.classId, ...next, teacherId, excludeId: id });
        if (conflict === "CLASS") {
            return NextResponse.json({ error: "Un autre créneau de cette classe occupe déjà cette plage." }, { status: 409 });
        }
        if (conflict === "TEACHER") {
            return NextResponse.json({ error: "L'enseignant a déjà un cours sur cette plage horaire." }, { status: 409 });
        }

        const updated = await prisma.schedule.update({
            where: { id },
            data: {
                dayOfWeek: next.dayOfWeek,
                startTime: next.startTime,
                endTime: next.endTime,
                classSubjectId: next.classSubjectId,
                ...(data.room !== undefined ? { room: data.room || null } : {}),
            },
            include: { classSubject: { include: { subject: true } } },
        });
        await createAuditLog({
            userId: session.user.id,
            action: "SCHEDULE_UPDATED",
            entity: "Schedule",
            entityId: id,
            schoolId: current.class.schoolId,
            oldValues: { dayOfWeek: current.dayOfWeek, startTime: current.startTime, endTime: current.endTime, room: current.room, classSubjectId: current.classSubjectId },
            newValues: { dayOfWeek: updated.dayOfWeek, startTime: updated.startTime, endTime: updated.endTime, room: updated.room, classSubjectId: updated.classSubjectId },
        });
        return NextResponse.json(updated);
    },
    { requireAuth: true, requiredPermissions: [Permission.SCHEDULE_UPDATE] },
);

/** DELETE /api/schedules/[id] — retirer un créneau (aucune donnée n'y est rattachée). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const current = await loadSchedule(id);
        if (!current || !canAccessSchool(session, current.class.schoolId)) {
            return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });
        }
        await prisma.schedule.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id,
            action: "SCHEDULE_DELETED",
            entity: "Schedule",
            entityId: id,
            schoolId: current.class.schoolId,
            oldValues: { classId: current.classId, dayOfWeek: current.dayOfWeek, startTime: current.startTime, endTime: current.endTime },
        });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, requiredPermissions: [Permission.SCHEDULE_DELETE] },
);
