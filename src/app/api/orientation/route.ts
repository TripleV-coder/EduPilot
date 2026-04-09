import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { studentOrientationSchema } from "@/lib/validations/orientation";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");

        const where: Prisma.StudentOrientationWhereInput = {};
        if (studentId) where.studentId = studentId;

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
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true, email: true } }
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
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

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
}
