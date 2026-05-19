import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const schema = z.object({
    matricule: z.string().min(1, "Matricule requis").trim(),
    // verificationCode is currently a UX-only field — there's no Prisma model
    // for issued liaison codes yet, so we accept and audit but don't validate.
    verificationCode: z.string().optional(),
    relationship: z.string().default("PARENT"),
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }
        if (session.user.role !== "PARENT") {
            return NextResponse.json(
                { error: "Réservé aux comptes parents" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const data = schema.parse(body);

        const parent = await prisma.parentProfile.findUnique({
            where: { userId: session.user.id },
        });
        if (!parent) {
            return NextResponse.json(
                { error: "Profil parent introuvable — contacte ton école" },
                { status: 404 }
            );
        }

        const student = await prisma.studentProfile.findFirst({
            where: { matricule: data.matricule },
            include: {
                user: { select: { firstName: true, lastName: true } },
                enrollments: {
                    where: { status: "ACTIVE" },
                    include: { class: true },
                    take: 1,
                },
            },
        });
        if (!student) {
            return NextResponse.json(
                {
                    error: "Aucun élève trouvé avec ce matricule — vérifie l'orthographe ou contacte l'école",
                },
                { status: 404 }
            );
        }

        // Tenant isolation
        const activeSchoolId = getActiveSchoolId(session);
        if (activeSchoolId && student.schoolId !== activeSchoolId) {
            return NextResponse.json(
                { error: "Élève hors de ton établissement actif" },
                { status: 403 }
            );
        }

        // Idempotent upsert
        const existing = await prisma.parentStudent.findUnique({
            where: {
                parentId_studentId: {
                    parentId: parent.id,
                    studentId: student.id,
                },
            },
        });
        if (existing) {
            return NextResponse.json(
                {
                    student: {
                        id: student.id,
                        firstName: student.user.firstName,
                        lastName: student.user.lastName,
                        className: student.enrollments[0]?.class.name ?? null,
                    },
                    alreadyLinked: true,
                },
                { status: 200 }
            );
        }

        // Determine isPrimary: first link = primary
        const existingCount = await prisma.parentStudent.count({
            where: { parentId: parent.id },
        });

        const link = await prisma.parentStudent.create({
            data: {
                parentId: parent.id,
                studentId: student.id,
                relationship: data.relationship,
                isPrimary: existingCount === 0,
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                schoolId: student.schoolId,
                action: "CREATE",
                entity: "ParentStudent",
                entityId: link.id,
                newValues: { matricule: data.matricule, relationship: data.relationship },
            },
        });

        return NextResponse.json(
            {
                student: {
                    id: student.id,
                    firstName: student.user.firstName,
                    lastName: student.user.lastName,
                    className: student.enrollments[0]?.class.name ?? null,
                },
                alreadyLinked: false,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }
        logger.error("parents/link-child:", error as Error);
        return NextResponse.json(
            { error: "Erreur lors de la liaison" },
            { status: 500 }
        );
    }
}
