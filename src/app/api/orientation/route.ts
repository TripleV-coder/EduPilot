import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { studentOrientationSchema } from "@/lib/validations/orientation";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getOwnStudentIds } from "@/lib/auth/family-scope";

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");

        const where: Prisma.StudentOrientationWhereInput = {};
        // Famille : ses propres dossiers seulement ; ?studentId s'y ajoute sans
        // jamais l'élargir (tout compte de l'école listait ceux de tous les élèves)
        const ownIds = await getOwnStudentIds(session.user.role, session.user.id);
        if (ownIds) {
            where.AND = [{ studentId: { in: ownIds } }, ...(studentId ? [{ studentId }] : [])];
        } else if (studentId) {
            where.studentId = studentId;
        }

        // Limiter aux écoles de l'utilisateur
        if (session.user.role !== "SUPER_ADMIN" && getActiveSchoolId(session)) {
            where.student = {
                enrollments: {
                    some: {
                        class: { schoolId: getActiveSchoolId(session) }
                    }
                }
            };
        }

        const orientations = await prisma.studentOrientation.findMany({
            where,
            include: {
                // Nom de l'élève seulement, jamais sa fiche ni son e-mail
                student: {
                    select: {
                        id: true,
                        user: { select: { firstName: true, lastName: true } }
                    }
                },
                academicYear: true,
                classLevel: true,
                recommendations: {
                    orderBy: { rank: "asc" }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(orientations);
    
    } catch (error) {
        logger.error(" fetching orientations:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

}, {
    // Mêmes rôles que la page Orientation (PageGuard) ; comptabilité et personnel exclus
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"],
});

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const body = await request.json();
        const data = studentOrientationSchema.parse(body);

        const orientation = await prisma.studentOrientation.create({
            data: {
                studentId: data.studentId,
                academicYearId: data.academicYearId,
                classLevelId: data.classLevelId,
                status: "PENDING"
            },
            include: {
                student: { include: { user: true } },
                academicYear: true,
                classLevel: true,
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: "CREATE",
                entity: "StudentOrientation",
                entityId: orientation.id,
                newValues: data
            }
        });

        return NextResponse.json(orientation, { status: 201 });
    
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
        }
        logger.error(" creating orientation:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] });

