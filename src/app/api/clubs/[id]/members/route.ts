import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { canManageClubs } from "@/lib/clubs/clubs";

/**
 * Élève concerné : l'élève connecté lui-même, ou — pour la direction — l'élève
 * désigné par `studentId` (de l'établissement).
 */
async function resolveStudent(
    session: { user: { id: string; role: string } },
    schoolId: string,
    requestedStudentId: string | null,
): Promise<{ studentId: string } | { error: string; status: number }> {
    if (session.user.role === "STUDENT") {
        const self = await prisma.studentProfile.findFirst({ where: { userId: session.user.id, schoolId }, select: { id: true } });
        return self ? { studentId: self.id } : { error: "Profil élève introuvable", status: 404 };
    }
    if (!canManageClubs(session.user.role)) return { error: "Accès refusé", status: 403 };
    if (!requestedStudentId) return { error: "Élève à préciser", status: 400 };
    const student = await prisma.studentProfile.findFirst({ where: { id: requestedStudentId, schoolId }, select: { id: true } });
    return student ? { studentId: student.id } : { error: "Élève introuvable dans l'établissement", status: 404 };
}

async function loadClub(id: string, schoolId: string) {
    return prisma.club.findFirst({
        where: { id, schoolId, isActive: true },
        select: { id: true, capacity: true, _count: { select: { memberships: true } } },
    });
}

/** POST /api/clubs/[id]/members — rejoindre (élève) ou inscrire un élève (direction). */
export const POST = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const { session } = context;
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        const club = await loadClub(id, schoolId);
        if (!club) return NextResponse.json({ error: "Club introuvable" }, { status: 404 });

        const body = (await request.json().catch(() => ({}))) as { studentId?: string };
        const resolved = await resolveStudent(session, schoolId, body.studentId ?? null);
        if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        const student = { id: resolved.studentId };

        const already = await prisma.clubMembership.findUnique({
            where: { clubId_studentId: { clubId: club.id, studentId: student.id } },
            select: { id: true },
        });
        if (already) return NextResponse.json({ success: true, alreadyMember: true });
        if (club.capacity !== null && club._count.memberships >= club.capacity) {
            return NextResponse.json({ error: "Ce club est complet" }, { status: 409 });
        }
        await prisma.clubMembership.create({ data: { clubId: club.id, studentId: student.id } });
        return NextResponse.json({ success: true }, { status: 201 });
    },
    { requireAuth: true },
);

/** DELETE /api/clubs/[id]/members?studentId= — quitter (élève) ou retirer un élève (direction). */
export const DELETE = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const { session } = context;
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        const club = await loadClub(id, schoolId);
        if (!club) return NextResponse.json({ error: "Club introuvable" }, { status: 404 });

        const studentId = new URL(request.url).searchParams.get("studentId");
        const resolved = await resolveStudent(session, schoolId, studentId);
        if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        const student = { id: resolved.studentId };

        await prisma.clubMembership.deleteMany({ where: { clubId: club.id, studentId: student.id } });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true },
);
