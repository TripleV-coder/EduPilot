import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { canManageClubs, clubInputSchema } from "@/lib/clubs/clubs";

async function findClub(id: string, schoolId: string | null | undefined) {
    if (!schoolId) return null;
    return prisma.club.findFirst({ where: { id, schoolId, isActive: true }, select: { id: true } });
}

/** PATCH /api/clubs/[id] — modifie un club (direction). */
export const PATCH = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const { session } = context;
        if (!canManageClubs(session.user.role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        const schoolId = getActiveSchoolId(session);
        if (!(await findClub(id, schoolId))) return NextResponse.json({ error: "Club introuvable" }, { status: 404 });

        const parsed = clubInputSchema.partial().safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
        }
        if (parsed.data.supervisorId) {
            const teacher = await prisma.teacherProfile.findFirst({
                where: { id: parsed.data.supervisorId, schoolId: schoolId as string },
                select: { id: true },
            });
            if (!teacher) return NextResponse.json({ error: "Responsable introuvable dans l'établissement" }, { status: 400 });
        }
        const club = await prisma.club.update({ where: { id }, data: parsed.data });
        return NextResponse.json({ club });
    },
    { requireAuth: true },
);

/** DELETE /api/clubs/[id] — archive le club (les adhésions restent en historique). */
export const DELETE = createApiHandler(
    async (_request, context) => {
        const { id } = await context.params;
        const { session } = context;
        if (!canManageClubs(session.user.role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        if (!(await findClub(id, getActiveSchoolId(session)))) {
            return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
        }
        await prisma.club.update({ where: { id }, data: { isActive: false } });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true },
);
