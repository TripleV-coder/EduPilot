import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { isBadgeCode, parseScannedMatricule } from "@/lib/access-control/badge";

const scanSchema = z.object({
    code: z.string().min(1, "Code scanné requis").trim(),
    scanPointId: z.string().optional().nullable(),
    action: z.enum(["ENTRY", "EXIT"]).default("ENTRY"),
});

/**
 * POST /api/access-control/scan
 * Enregistre un passage de badge. Résout l'élève par code de badge opaque ou
 * par matricule (QR `EDUPILOT:STUDENT:<matricule>`). Journalise OK/REFUSED.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const parsed = scanSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { code, scanPointId, action } = parsed.data;

        // Le point de scan, s'il est fourni, doit appartenir à l'école active.
        if (scanPointId) {
            const sp = await prisma.scanPoint.findUnique({ where: { id: scanPointId }, select: { schoolId: true } });
            if (!sp || sp.schoolId !== schoolId) {
                return NextResponse.json({ error: "Point de scan invalide" }, { status: 400 });
            }
        }

        // Résolution de l'élève.
        let student: { id: string; matricule: string; user: { firstName: string; lastName: string } } | null = null;
        let matricule: string | null = null;

        if (isBadgeCode(code)) {
            const badge = await prisma.badge.findUnique({
                where: { code },
                include: { student: { select: { id: true, schoolId: true, matricule: true, deletedAt: true, user: { select: { firstName: true, lastName: true } } } } },
            });
            if (badge && !badge.revokedAt && badge.student.schoolId === schoolId && !badge.student.deletedAt) {
                student = { id: badge.student.id, matricule: badge.student.matricule, user: badge.student.user };
            }
        } else {
            matricule = parseScannedMatricule(code);
            const found = await prisma.studentProfile.findFirst({
                where: { matricule, schoolId, deletedAt: null },
                select: { id: true, matricule: true, user: { select: { firstName: true, lastName: true } } },
            });
            if (found) student = found;
        }

        const result = student ? "OK" : "REFUSED";
        const reason = student ? null : "Badge ou matricule non reconnu";

        const log = await prisma.scanLog.create({
            data: {
                schoolId,
                scanPointId: scanPointId || null,
                studentId: student?.id ?? null,
                matricule: student?.matricule ?? matricule,
                action,
                result,
                reason,
            },
        });

        return NextResponse.json({
            result,
            reason,
            logId: log.id,
            student: student
                ? { id: student.id, name: `${student.user.firstName} ${student.user.lastName}`, matricule: student.matricule }
                : null,
        });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.SCHOOL_READ],
    }
);
