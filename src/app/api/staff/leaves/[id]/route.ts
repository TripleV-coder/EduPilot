import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { STAFF_MEMBER_ROLES, isHrManager } from "@/lib/staff/hr";

const patchSchema = z.object({
    action: z.enum(["approve", "reject", "cancel"]),
    note: z.string().max(1000).optional().nullable(),
});

/**
 * PATCH /api/staff/leaves/[id]
 * - approve / reject : réservé aux gestionnaires RH, sur une demande en attente.
 * - cancel : par le demandeur (sa propre demande en attente) ou un gestionnaire.
 */
export const PATCH = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const schoolId = getActiveSchoolId(context.session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 403 });

        const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: "Données invalides", details: parsed.error.issues }, { status: 400 });
        }
        const { action, note } = parsed.data;

        const leave = await prisma.leaveRequest.findFirst({
            where: { id, schoolId },
            select: { id: true, userId: true, status: true },
        });
        if (!leave) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

        if (leave.status !== "PENDING") {
            return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 409 });
        }

        const manager = isHrManager(context.session.user.role);
        const isOwner = leave.userId === context.session.user.id;

        if (action === "cancel") {
            if (!isOwner && !manager) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
            await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
            return NextResponse.json({ status: "CANCELLED" });
        }

        // approve / reject → gestionnaire uniquement.
        if (!manager) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        const status = action === "approve" ? "APPROVED" : "REJECTED";
        await prisma.leaveRequest.update({
            where: { id },
            data: {
                status,
                decidedById: context.session.user.id,
                decidedAt: new Date(),
                decisionNote: note?.trim() || null,
            },
        });
        return NextResponse.json({ status });
    },
    { allowedRoles: STAFF_MEMBER_ROLES },
);
