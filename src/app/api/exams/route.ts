import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";

export const dynamic = "force-dynamic";

const createExamSchema = z.object({
    title: z.string().min(1, "Le titre est requis").max(200),
    classSubjectId: z.string().cuid("classSubjectId invalide"),
    totalPoints: z.number().int().min(1).default(20),
    duration: z.number().int().min(1).default(60),
    isPublished: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const activeSchoolId = getActiveSchoolId(session);

    try {
        const whereClause: Prisma.ExamTemplateWhereInput = {};

        // Si l'utilisateur a une école (pas SUPER_ADMIN global), filtrer par l'école
        if (activeSchoolId) {
            whereClause.classSubject = {
                class: {
                    schoolId: activeSchoolId
                }
            };
        }

        // Si l'utilisateur est un prof, on pourrait filtrer par ses classSubjects
        if (session.user.role === "TEACHER") {
            const teacherProfile = await prisma.teacherProfile.findUnique({
                where: { userId: session.user.id },
                select: { id: true },
            });
            if (teacherProfile) {
                whereClause.classSubject = {
                    ...(whereClause.classSubject as any),
                    teacherId: teacherProfile.id,
                };
            }
        }

        const exams = await prisma.examTemplate.findMany({
            where: whereClause,
            include: {
                _count: {
                    select: { questions: true }
                },
                classSubject: {
                    include: {
                        subject: { select: { name: true } },
                        class: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ exams });
    } catch (error) {
        logger.error("Error fetching exams", error as Error, { module: "api/exams" });
        return NextResponse.json(
            { error: "Erreur lors de la récupération des examens" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const validatedData = createExamSchema.parse(body);

        // Verify classSubject exists
        const classSubject = await prisma.classSubject.findUnique({
            where: { id: validatedData.classSubjectId },
            include: {
                class: { select: { schoolId: true } },
                teacher: { select: { userId: true } },
            },
        });

        if (!classSubject) {
            return NextResponse.json({ error: "Matière/Classe non trouvée" }, { status: 404 });
        }

        // Verify same school if user has a school
        if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, classSubject.class.schoolId)) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }

        if (session.user.role === "TEACHER" && classSubject.teacher?.userId !== session.user.id) {
            return NextResponse.json({ error: "Vous ne pouvez créer des examens que pour vos propres matières" }, { status: 403 });
        }

        const exam = await prisma.examTemplate.create({
            data: {
                title: validatedData.title,
                classSubjectId: validatedData.classSubjectId,
                totalPoints: validatedData.totalPoints,
                duration: validatedData.duration,
                isPublished: validatedData.isPublished,
                createdById: session.user.id,
            },
            include: {
                _count: { select: { questions: true } },
                classSubject: {
                    include: {
                        subject: { select: { name: true } },
                        class: { select: { name: true } },
                    },
                },
            },
        });

        return NextResponse.json(exam, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }
        logger.error("Error creating exam", error as Error, { module: "api/exams" });
        return NextResponse.json(
            { error: "Erreur lors de la création de l'examen" },
            { status: 500 }
        );
    }
}
