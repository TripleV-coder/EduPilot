import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { dependencyConflict } from "@/lib/api/dependency-guard";

const lineUpdateSchema = z
    .object({
        number: z.string().trim().min(1).max(20).optional(),
        label: z.string().trim().min(1).max(120).optional(),
        direction: z.enum(["OUTBOUND", "RETURN", "BOTH"]).optional(),
        status: z.enum(["ON_TIME", "DELAYED", "INCIDENT", "INACTIVE"]).optional(),
        note: z.string().trim().max(500).nullable().optional(),
        isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

const WRITE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"];

async function loadLine(id: string) {
    return prisma.transportLine.findUnique({ where: { id }, select: { id: true, schoolId: true, number: true, label: true, status: true, isActive: true } });
}

/** PATCH /api/transport/lines/[id] — corriger une ligne, son état (retard, incident) ou la désactiver. */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = lineUpdateSchema.parse(await request.json());
        const line = await loadLine(id);
        if (!line || !canAccessSchool(session, line.schoolId)) {
            return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
        }
        const updated = await prisma.transportLine.update({
            where: { id },
            data: { ...data, ...(data.note !== undefined ? { note: data.note || null } : {}) },
        });
        await createAuditLog({
            userId: session.user.id, action: "TRANSPORT_LINE_UPDATED", entity: "TransportLine", entityId: id, schoolId: line.schoolId,
            oldValues: { number: line.number, label: line.label, status: line.status, isActive: line.isActive },
            newValues: { number: updated.number, label: updated.label, status: updated.status, isActive: updated.isActive },
        });
        return NextResponse.json(updated);
    },
    { requireAuth: true, allowedRoles: WRITE_ROLES },
);

/** DELETE /api/transport/lines/[id] — ligne sans élève, véhicule ni arrêt (sinon : la désactiver). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const line = await loadLine(id);
        if (!line || !canAccessSchool(session, line.schoolId)) {
            return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
        }
        const [students, buses, stops] = await Promise.all([
            prisma.studentTransport.count({ where: { lineId: id } }),
            prisma.bus.count({ where: { lineId: id } }),
            prisma.busRoute.count({ where: { lineId: id } }),
        ]);
        const conflict = dependencyConflict(
            `la ligne ${line.number}`,
            [
                { count: students, one: "élève inscrit", many: "élèves inscrits" },
                { count: buses, one: "véhicule", many: "véhicules" },
                { count: stops, one: "arrêt", many: "arrêts" },
            ],
            "Retirez d'abord ses élèves, ou désactivez-la.",
        );
        if (conflict) return conflict;
        await prisma.transportLine.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id, action: "TRANSPORT_LINE_DELETED", entity: "TransportLine", entityId: id, schoolId: line.schoolId,
            oldValues: { number: line.number, label: line.label },
        });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: WRITE_ROLES },
);
