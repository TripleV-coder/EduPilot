import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";
import { dependencyConflict } from "@/lib/api/dependency-guard";

const SCAN_TYPES = ["GATE", "CANTEEN", "TRANSPORT", "LIBRARY", "INFIRMARY"] as const;
const WRITE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"];

const pointUpdateSchema = z
    .object({
        name: z.string().trim().min(1, "Nom requis").optional(),
        type: z.enum(SCAN_TYPES).optional(),
        location: z.string().trim().max(120).nullable().optional(),
        isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

async function loadPoint(id: string) {
    return prisma.scanPoint.findUnique({ where: { id }, select: { id: true, schoolId: true, name: true, type: true, isActive: true } });
}

/** PATCH /api/access-control/scan-points/[id] — renommer, déplacer ou désactiver un point de passage. */
export const PATCH = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const data = pointUpdateSchema.parse(await request.json());
        const point = await loadPoint(id);
        if (!point || !canAccessSchool(session, point.schoolId)) {
            return NextResponse.json({ error: "Point de passage introuvable" }, { status: 404 });
        }
        const updated = await prisma.scanPoint.update({
            where: { id },
            data: { ...data, ...(data.location !== undefined ? { location: data.location || null } : {}) },
        });
        await createAuditLog({
            userId: session.user.id, action: "SCAN_POINT_UPDATED", entity: "ScanPoint", entityId: id, schoolId: point.schoolId,
            oldValues: { name: point.name, type: point.type, isActive: point.isActive },
            newValues: { name: updated.name, type: updated.type, isActive: updated.isActive },
        });
        return NextResponse.json(updated);
    },
    { requireAuth: true, allowedRoles: WRITE_ROLES },
);

/** DELETE /api/access-control/scan-points/[id] — point jamais utilisé (le journal des passages est conservé). */
export const DELETE = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const point = await loadPoint(id);
        if (!point || !canAccessSchool(session, point.schoolId)) {
            return NextResponse.json({ error: "Point de passage introuvable" }, { status: 404 });
        }
        const logs = await prisma.scanLog.count({ where: { scanPointId: id } });
        const conflict = dependencyConflict(
            `le point « ${point.name} »`,
            [{ count: logs, one: "passage enregistré", many: "passages enregistrés" }],
            "Désactivez-le : son journal reste consultable.",
        );
        if (conflict) return conflict;
        await prisma.scanPoint.delete({ where: { id } });
        await createAuditLog({
            userId: session.user.id, action: "SCAN_POINT_DELETED", entity: "ScanPoint", entityId: id, schoolId: point.schoolId,
            oldValues: { name: point.name, type: point.type },
        });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: WRITE_ROLES },
);
