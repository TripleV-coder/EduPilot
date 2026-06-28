import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { generateLinkCode, hashLinkCode, linkCodeExpiry } from "@/lib/parents/link-code";

/**
 * POST /api/students/[id]/link-code
 * Émet un nouveau code de liaison parent-enfant pour cet élève. Le code en
 * clair n'est renvoyé qu'ici (une seule fois) ; il est stocké haché. Tout code
 * actif précédent pour le même élève est invalidé (un seul code valable).
 */
export const POST = createApiHandler(
    async (_request, context) => {
        const { id } = await context.params;
        const { session } = context;

        const student = await prisma.studentProfile.findUnique({
            where: { id },
            select: {
                id: true,
                schoolId: true,
                matricule: true,
                user: { select: { firstName: true, lastName: true } },
            },
        });

        if (!student) {
            return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        }

        if (!canAccessSchool(session, student.schoolId)) {
            return NextResponse.json({ error: "Accès inter-établissement interdit" }, { status: 403 });
        }

        const code = generateLinkCode();
        const codeHash = await hashLinkCode(code);
        const expiresAt = linkCodeExpiry();

        await prisma.$transaction([
            // Un seul code actif à la fois : on supprime les codes non utilisés.
            prisma.studentLinkCode.deleteMany({
                where: { studentId: student.id, usedAt: null },
            }),
            prisma.studentLinkCode.create({
                data: {
                    studentId: student.id,
                    schoolId: student.schoolId,
                    codeHash,
                    expiresAt,
                    createdById: session.user.id,
                },
            }),
        ]);

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                schoolId: student.schoolId,
                action: "CREATE",
                entity: "StudentLinkCode",
                entityId: student.id,
                newValues: { matricule: student.matricule },
            },
        });

        return NextResponse.json({
            code,
            matricule: student.matricule,
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            expiresAt: expiresAt.toISOString(),
        });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"],
        requiredPermissions: [Permission.STUDENT_UPDATE],
    }
);
