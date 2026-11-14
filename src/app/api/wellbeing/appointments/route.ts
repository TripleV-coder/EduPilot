import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import {
    WELLBEING_DESK_ROLES,
    appointmentCreateSchema,
    appointmentVariantFor,
} from "@/lib/wellbeing/appointments";

/**
 * POST /api/wellbeing/appointments — la direction planifie un rendez-vous de
 * la cellule d'écoute. L'agenda n'était alimenté par rien : il restait vide.
 * Le libellé est anonyme par défaut ; le journal d'audit n'en garde rien.
 */
export const POST = createApiHandler(
    async (request, { session }) => {
        const data = appointmentCreateSchema.parse(await request.json());
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "Choisissez d'abord un établissement." }, { status: 400 });
        }

        const appointment = await prisma.psyAppointment.create({
            data: {
                schoolId,
                startAt: data.startAt,
                durationMinutes: data.durationMinutes,
                kind: data.kind,
                anonymousLabel: data.anonymousLabel || "Anonyme",
                isUrgent: data.isUrgent,
                variantHint: appointmentVariantFor(data.kind, data.isUrgent),
            },
        });
        await createAuditLog({
            userId: session.user.id,
            action: "PSY_APPOINTMENT_CREATED",
            entity: "PsyAppointment",
            entityId: appointment.id,
            schoolId,
            newValues: { startAt: appointment.startAt.toISOString(), durationMinutes: appointment.durationMinutes, isUrgent: appointment.isUrgent },
        });
        return NextResponse.json(
            {
                id: appointment.id,
                startAt: appointment.startAt.toISOString(),
                durationMinutes: appointment.durationMinutes,
                kind: appointment.kind,
                anonymousLabel: appointment.anonymousLabel,
                variantHint: appointment.variantHint,
                isUrgent: appointment.isUrgent,
            },
            { status: 201 },
        );
    },
    { requireAuth: true, allowedRoles: [...WELLBEING_DESK_ROLES] },
);
