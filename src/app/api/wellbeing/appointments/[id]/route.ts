import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { WELLBEING_DESK_ROLES } from "@/lib/wellbeing/appointments";

/** DELETE /api/wellbeing/appointments/[id] — annuler un rendez-vous (aucune donnée n'y est rattachée). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const appointment = await prisma.psyAppointment.findUnique({
            where: { id },
            select: { id: true, schoolId: true, startAt: true },
        });
        if (!appointment || !canAccessSchool(session, appointment.schoolId)) {
            return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
        }
        await prisma.psyAppointment.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id,
            action: "PSY_APPOINTMENT_CANCELLED",
            entity: "PsyAppointment",
            entityId: id,
            schoolId: appointment.schoolId,
            oldValues: { startAt: appointment.startAt.toISOString() },
        });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: [...WELLBEING_DESK_ROLES] },
);
