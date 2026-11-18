import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";

const WRITE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"];
const assignSchema = z.object({
    studentId: z.string().cuid(),
    direction: z.enum(["OUTBOUND", "RETURN", "BOTH"]).default("BOTH"),
});

async function loadLine(id: string) {
    return prisma.transportLine.findUnique({ where: { id }, select: { id: true, schoolId: true, number: true } });
}

/**
 * Élèves inscrits sur une ligne. Les lignes se créaient mais aucune route ne
 * permettait d'y inscrire un élève : le compteur lisait une table que seules
 * les données de démonstration remplissaient.
 */
export const GET = createApiHandler(
    async (_request, { params, session }) => {
        const { id } = await params;
        const line = await loadLine(id);
        if (!line || !canAccessSchool(session, line.schoolId)) {
            return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
        }
        const rows = await prisma.studentTransport.findMany({
            where: { lineId: id },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                direction: true,
                isActive: true,
                student: { select: { id: true, matricule: true, user: { select: { firstName: true, lastName: true } } } },
            },
        });
        return NextResponse.json({
            line: { id: line.id, number: line.number },
            students: rows.map((r) => ({
                id: r.student.id,
                matricule: r.student.matricule,
                name: `${r.student.user.firstName} ${r.student.user.lastName}`.trim(),
                direction: r.direction,
                isActive: r.isActive,
            })),
        });
    },
    { requireAuth: true, allowedRoles: WRITE_ROLES },
);

/** Inscrire un élève de l'école sur la ligne (aller, retour ou les deux). */
export const POST = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const line = await loadLine(id);
        if (!line || !canAccessSchool(session, line.schoolId)) {
            return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
        }
        const data = assignSchema.parse(await request.json());
        const student = await prisma.studentProfile.findFirst({
            where: { id: data.studentId, schoolId: line.schoolId },
            select: { id: true, user: { select: { firstName: true, lastName: true } } },
        });
        if (!student) return NextResponse.json({ error: "Élève introuvable dans cet établissement." }, { status: 404 });

        const existing = await prisma.studentTransport.findUnique({ where: { studentId_lineId: { studentId: student.id, lineId: id } } });
        if (existing) return NextResponse.json({ error: "Cet élève est déjà inscrit sur cette ligne." }, { status: 409 });

        const row = await prisma.studentTransport.create({ data: { studentId: student.id, lineId: id, direction: data.direction } });
        await createAuditLog({
            userId: session.user.id,
            action: "TRANSPORT_STUDENT_ADDED",
            entity: "StudentTransport",
            entityId: row.id,
            schoolId: line.schoolId,
            newValues: { lineId: id, studentId: student.id, direction: data.direction },
        });
        return NextResponse.json({ id: row.id }, { status: 201 });
    },
    { requireAuth: true, allowedRoles: WRITE_ROLES },
);

/** Retirer un élève de la ligne. */
export const DELETE = createApiHandler(
    async (request, { params, session }) => {
        const { id } = await params;
        const line = await loadLine(id);
        if (!line || !canAccessSchool(session, line.schoolId)) {
            return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
        }
        const studentId = new URL(request.url).searchParams.get("studentId");
        if (!studentId) return NextResponse.json({ error: "Indiquez l'élève." }, { status: 400 });
        const { count } = await prisma.studentTransport.deleteMany({ where: { lineId: id, studentId } });
        if (count === 0) return NextResponse.json({ error: "Cet élève n'est pas inscrit sur cette ligne." }, { status: 404 });
        await createAuditLog({
            userId: session.user.id,
            action: "TRANSPORT_STUDENT_REMOVED",
            entity: "StudentTransport",
            entityId: `${id}:${studentId}`,
            schoolId: line.schoolId,
            oldValues: { lineId: id, studentId },
        });
        return NextResponse.json({ success: true });
    },
    { requireAuth: true, allowedRoles: WRITE_ROLES },
);
