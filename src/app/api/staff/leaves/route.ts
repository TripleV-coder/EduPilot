import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { STAFF_MEMBER_ROLES, isHrManager, isValidLeaveRange, countLeaveDays } from "@/lib/staff/hr";

function parseDayUtc(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

const createSchema = z
    .object({
        type: z.enum(["SICK", "ANNUAL", "MATERNITY", "EXCEPTIONAL", "UNPAID"]),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().max(1000).optional().nullable(),
    })
    .refine((d) => isValidLeaveRange(parseDayUtc(d.startDate), parseDayUtc(d.endDate)), {
        message: "La date de fin ne peut pas précéder la date de début.",
        path: ["endDate"],
    });

/**
 * GET /api/staff/leaves?status=PENDING
 * Les gestionnaires RH voient toutes les demandes de l'établissement ; un
 * employé ne voit que les siennes.
 */
export const GET = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const manager = isHrManager(context.session.user.role);
        const url = new URL(request.url);
        const statusFilter = url.searchParams.get("status");
        const validStatus = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(statusFilter ?? "")
            ? (statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED")
            : undefined;

        const requests = await prisma.leaveRequest.findMany({
            where: {
                schoolId,
                ...(manager ? {} : { userId: context.session.user.id }),
                ...(validStatus ? { status: validStatus } : {}),
            },
            include: {
                user: { select: { firstName: true, lastName: true, role: true } },
                decidedBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ status: "asc" }, { startDate: "desc" }],
            take: 200,
        });

        return NextResponse.json({
            canManage: manager,
            requests: requests.map((r) => ({
                id: r.id,
                userId: r.userId,
                name: `${r.user.firstName} ${r.user.lastName}`.trim(),
                role: r.user.role,
                type: r.type,
                startDate: r.startDate.toISOString().slice(0, 10),
                endDate: r.endDate.toISOString().slice(0, 10),
                days: countLeaveDays(r.startDate, r.endDate),
                reason: r.reason,
                status: r.status,
                decidedBy: r.decidedBy ? `${r.decidedBy.firstName} ${r.decidedBy.lastName}`.trim() : null,
                decisionNote: r.decisionNote,
                isMine: r.userId === context.session.user.id,
            })),
        });
    },
    { allowedRoles: STAFF_MEMBER_ROLES },
);

/**
 * POST /api/staff/leaves — un membre du personnel dépose sa propre demande.
 */
export const POST = createApiHandler(
    async (request, context) => {
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { type, startDate, endDate, reason } = parsed.data;

        const created = await prisma.leaveRequest.create({
            data: {
                schoolId,
                userId: context.session.user.id,
                type,
                startDate: parseDayUtc(startDate),
                endDate: parseDayUtc(endDate),
                reason: reason?.trim() || null,
                status: "PENDING",
            },
        });

        return NextResponse.json({ id: created.id }, { status: 201 });
    },
    { allowedRoles: STAFF_MEMBER_ROLES },
);
