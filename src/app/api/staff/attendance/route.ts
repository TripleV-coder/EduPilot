import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { STAFF_MEMBER_ROLES, isHrManager, summarizeAttendance } from "@/lib/staff/hr";

/** Normalise "YYYY-MM-DD" en minuit UTC (clé stable de la présence du jour). */
function parseDayUtc(value: string | null): Date {
    const s = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
    return new Date(`${s}T00:00:00.000Z`);
}

const upsertSchema = z.object({
    userId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD"),
    status: z.enum(["PRESENT", "ABSENT", "LATE", "ON_LEAVE"]),
    checkIn: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    checkOut: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    note: z.string().max(500).optional().nullable(),
});

/**
 * GET /api/staff/attendance?date=YYYY-MM-DD
 * Roster de présence du jour. Les gestionnaires RH voient tout le personnel ;
 * un employé ne voit que sa propre ligne.
 */
export const GET = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const url = new URL(request.url);
        const date = parseDayUtc(url.searchParams.get("date"));
        const manager = isHrManager(context.session.user.role);

        const staff = await prisma.user.findMany({
            where: manager
                ? { schoolId, isActive: true, role: { in: STAFF_MEMBER_ROLES } }
                : { id: context.session.user.id },
            select: { id: true, firstName: true, lastName: true, role: true },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });

        const records = await prisma.staffAttendance.findMany({
            where: { schoolId, date, userId: { in: staff.map((s) => s.id) } },
            select: { userId: true, status: true, checkIn: true, checkOut: true, note: true },
        });
        const byUser = new Map(records.map((r) => [r.userId, r]));

        const roster = staff.map((s) => {
            const rec = byUser.get(s.id);
            return {
                userId: s.id,
                name: `${s.firstName} ${s.lastName}`.trim(),
                role: s.role,
                status: rec?.status ?? null,
                checkIn: rec?.checkIn ?? null,
                checkOut: rec?.checkOut ?? null,
                note: rec?.note ?? null,
            };
        });

        return NextResponse.json({
            date: date.toISOString().slice(0, 10),
            canManage: manager,
            summary: summarizeAttendance(records),
            roster,
        });
    },
    { allowedRoles: STAFF_MEMBER_ROLES },
);

/**
 * POST /api/staff/attendance — pointe un membre du personnel pour une date.
 * Idempotent (upsert sur la clé userId+date). Gestionnaires RH uniquement.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = upsertSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { userId, date, status, checkIn, checkOut, note } = parsed.data;

        // L'agent pointé doit appartenir à l'établissement et être un membre du personnel.
        const target = await prisma.user.findFirst({
            where: { id: userId, schoolId, role: { in: STAFF_MEMBER_ROLES } },
            select: { id: true },
        });
        if (!target) {
            return NextResponse.json({ error: "Agent introuvable dans l'établissement" }, { status: 404 });
        }

        const day = parseDayUtc(date);
        const record = await prisma.staffAttendance.upsert({
            where: { userId_date: { userId, date: day } },
            update: { status, checkIn: checkIn ?? null, checkOut: checkOut ?? null, note: note ?? null, recordedById: context.session.user.id, schoolId },
            create: { schoolId, userId, date: day, status, checkIn: checkIn ?? null, checkOut: checkOut ?? null, note: note ?? null, recordedById: context.session.user.id },
        });

        return NextResponse.json({ id: record.id });
    },
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
