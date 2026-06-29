import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { makeBadgeCode } from "@/lib/access-control/badge";

const schema = z.object({
    classId: z.string().min(1, "Classe requise"),
    validUntil: z.coerce.date().optional().nullable(),
});

/**
 * POST /api/access-control/badges/regenerate
 * (Ré)émet un badge unique pour chaque élève actif d'une classe. Idempotent :
 * un upsert par élève (nouveau code à chaque régénération).
 */
export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const body = await request.json().catch(() => ({}));
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { classId, validUntil } = parsed.data;

        const klass = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
        if (!klass || klass.schoolId !== schoolId) {
            return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
        }

        const enrollments = await prisma.enrollment.findMany({
            where: { classId, status: "ACTIVE", student: { deletedAt: null } },
            select: { studentId: true },
        });
        const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

        let count = 0;
        for (const studentId of studentIds) {
            await prisma.badge.upsert({
                where: { studentId },
                update: { code: makeBadgeCode(), validUntil: validUntil ?? null, revokedAt: null, schoolId },
                create: { schoolId, studentId, code: makeBadgeCode(), validUntil: validUntil ?? null },
            });
            count += 1;
        }

        await prisma.auditLog.create({
            data: {
                userId: context.session.user.id,
                schoolId,
                action: "UPDATE",
                entity: "Badge",
                entityId: classId,
                newValues: { classId, regenerated: count },
            },
        });

        return NextResponse.json({ regenerated: count });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
    }
);
