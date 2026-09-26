import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { canManageClubs, clubInputSchema } from "@/lib/clubs/clubs";

/** GET /api/clubs — clubs actifs de l'établissement, effectifs et adhésion de l'élève connecté. */
export const GET = createApiHandler(
    async (_request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });

        const student =
            session.user.role === "STUDENT"
                ? await prisma.studentProfile.findFirst({ where: { userId: session.user.id }, select: { id: true } })
                : null;

        const clubs = await prisma.club.findMany({
            where: { schoolId, isActive: true },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                category: true,
                description: true,
                schedule: true,
                capacity: true,
                supervisor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
                _count: { select: { memberships: true } },
                ...(student ? { memberships: { where: { studentId: student.id }, select: { id: true } } } : {}),
            },
        });

        return NextResponse.json({
            canManage: canManageClubs(session.user.role),
            clubs: clubs.map((club) => ({
                id: club.id,
                name: club.name,
                category: club.category,
                description: club.description,
                schedule: club.schedule,
                capacity: club.capacity,
                supervisor: club.supervisor
                    ? { id: club.supervisor.id, name: `${club.supervisor.user.firstName} ${club.supervisor.user.lastName}` }
                    : null,
                memberCount: club._count.memberships,
                joined: "memberships" in club && Array.isArray(club.memberships) ? club.memberships.length > 0 : false,
            })),
        });
    },
    { requireAuth: true },
);

/** POST /api/clubs — crée un club (direction). */
export const POST = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        if (!canManageClubs(session.user.role)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

        const parsed = clubInputSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
        }
        const data = parsed.data;
        if (data.supervisorId) {
            const teacher = await prisma.teacherProfile.findFirst({ where: { id: data.supervisorId, schoolId }, select: { id: true } });
            if (!teacher) return NextResponse.json({ error: "Responsable introuvable dans l'établissement" }, { status: 400 });
        }
        const existing = await prisma.club.findFirst({ where: { schoolId, name: data.name }, select: { id: true } });
        if (existing) return NextResponse.json({ error: "Un club porte déjà ce nom" }, { status: 409 });

        const club = await prisma.club.create({ data: { ...data, schoolId } });
        return NextResponse.json({ club }, { status: 201 });
    },
    { requireAuth: true },
);
