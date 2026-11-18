import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { isYearLocked } from "@/lib/academic/year-lock";
import { calendarEventSchema } from "@/lib/validations/calendar";

const eventUpdateSchema = calendarEventSchema
    .omit({ academicYearId: true })
    .partial()
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

async function loadEvent(id: string) {
    return prisma.schoolCalendarEvent.findUnique({
        where: { id },
        select: { id: true, schoolId: true, name: true, type: true, startDate: true, endDate: true, academicYear: { select: { status: true } } },
    });
}

/** PATCH /api/calendar/events/[id] — corriger un évènement du calendrier (création seule auparavant). */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = eventUpdateSchema.parse(await request.json());
        const event = await loadEvent(id);
        if (!event || !canAccessSchool(session, event.schoolId)) {
            return NextResponse.json({ error: "Évènement introuvable" }, { status: 404 });
        }
        if (isYearLocked(event.academicYear.status)) {
            return NextResponse.json({ error: "Année clôturée : son calendrier ne se modifie plus." }, { status: 409 });
        }
        const startDate = data.startDate !== undefined ? new Date(data.startDate) : event.startDate;
        const endDate = data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : event.endDate;
        if (Number.isNaN(startDate.getTime()) || (endDate && Number.isNaN(endDate.getTime()))) {
            return NextResponse.json({ error: "Date invalide." }, { status: 400 });
        }
        if (endDate && endDate < startDate) {
            return NextResponse.json({ error: "La date de fin doit suivre la date de début." }, { status: 400 });
        }
        const updated = await prisma.schoolCalendarEvent.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.type !== undefined ? { type: data.type } : {}),
                startDate,
                endDate,
                ...(data.isAllDay !== undefined ? { isAllDay: data.isAllDay } : {}),
                ...(data.description !== undefined ? { description: data.description || null } : {}),
                ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
                ...(data.targetRoles !== undefined ? { targetRoles: data.targetRoles } : {}),
            },
        });
        await createAuditLog({
            userId: session.user.id, action: "CALENDAR_EVENT_UPDATED", entity: "SchoolCalendarEvent", entityId: id, schoolId: event.schoolId,
            oldValues: { name: event.name, type: event.type, startDate: event.startDate, endDate: event.endDate },
            newValues: { name: updated.name, type: updated.type, startDate: updated.startDate, endDate: updated.endDate },
        });
        await invalidateByPath("/api/calendar");
        return NextResponse.json(updated);
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);

/** DELETE /api/calendar/events/[id] — retirer un évènement (aucune donnée n'y est rattachée). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const event = await loadEvent(id);
        if (!event || !canAccessSchool(session, event.schoolId)) {
            return NextResponse.json({ error: "Évènement introuvable" }, { status: 404 });
        }
        if (isYearLocked(event.academicYear.status)) {
            return NextResponse.json({ error: "Année clôturée : son calendrier ne se modifie plus." }, { status: 409 });
        }
        await prisma.schoolCalendarEvent.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id, action: "CALENDAR_EVENT_DELETED", entity: "SchoolCalendarEvent", entityId: id, schoolId: event.schoolId,
            oldValues: { name: event.name, type: event.type, startDate: event.startDate },
        });
        await invalidateByPath("/api/calendar");
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
