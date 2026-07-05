import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { STAFF_MEMBER_ROLES } from "@/lib/staff/hr";

function parseDayUtc(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

const bulkSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    entries: z
        .array(
            z.object({
                userId: z.string().min(1),
                status: z.enum(["PRESENT", "ABSENT", "LATE", "ON_LEAVE"]),
            }),
        )
        .min(1)
        .max(500),
});

/**
 * POST /api/staff/attendance/bulk — pointe une équipe entière pour une date.
 * Gestionnaires RH uniquement. Ignore silencieusement les agents hors périmètre.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = bulkSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { date, entries } = parsed.data;
        const day = parseDayUtc(date);

        // Filtre les agents réellement rattachés à l'établissement.
        const ids = [...new Set(entries.map((e) => e.userId))];
        const validIds = new Set(
            (
                await prisma.user.findMany({
                    where: { id: { in: ids }, schoolId, role: { in: STAFF_MEMBER_ROLES } },
                    select: { id: true },
                })
            ).map((u) => u.id),
        );

        const valid = entries.filter((e) => validIds.has(e.userId));
        await prisma.$transaction(
            valid.map((e) =>
                prisma.staffAttendance.upsert({
                    where: { userId_date: { userId: e.userId, date: day } },
                    update: { status: e.status, recordedById: context.session.user.id, schoolId },
                    create: { schoolId, userId: e.userId, date: day, status: e.status, recordedById: context.session.user.id },
                }),
            ),
        );

        return NextResponse.json({ saved: valid.length, skipped: entries.length - valid.length });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
