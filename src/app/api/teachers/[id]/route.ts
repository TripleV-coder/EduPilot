import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

/**
 * GET /api/teachers/[id]
 * Get full teacher detail: profile, classes taught, subjects, schedule
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        if (!ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const { id } = await params;

        const teacher = await prisma.teacherProfile.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        isActive: true,
                        avatar: true,
                        createdAt: true,
                    },
                },
                classSubjects: {
                    include: {
                        subject: {
                            select: { id: true, name: true, code: true, coefficient: true },
                        },
                        class: {
                            include: {
                                classLevel: { select: { id: true, name: true, level: true } },
                                _count: {
                                    select: { enrollments: { where: { status: "ACTIVE" } } },
                                },
                            },
                        },
                    },
                    orderBy: { class: { name: "asc" } },
                },
                mainClasses: {
                    select: {
                        id: true,
                        name: true,
                        classLevel: { select: { id: true, name: true } },
                        _count: {
                            select: { enrollments: { where: { status: "ACTIVE" } } },
                        },
                    },
                },
            },
        });

        if (!teacher) {
            return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
        }

        // Security: ensure same school
        if (session.user.role !== "SUPER_ADMIN" && teacher.schoolId !== session.user.schoolId) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        // Deduplicate subjects
        const seenSubjects = new Map<string, { id: string; name: string; code: string }>();
        teacher.classSubjects.forEach((cs) => {
            if (cs.subject && !seenSubjects.has(cs.subject.id)) {
                seenSubjects.set(cs.subject.id, cs.subject);
            }
        });

        // Deduplicate classes
        const seenClasses = new Map<string, any>();
        teacher.classSubjects.forEach((cs) => {
            if (cs.class && !seenClasses.has(cs.class.id)) {
                seenClasses.set(cs.class.id, {
                    id: cs.class.id,
                    name: cs.class.name,
                    classLevel: cs.class.classLevel,
                    studentCount: cs.class._count?.enrollments ?? 0,
                });
            }
        });

        // Fetch schedule for this teacher
        const schedules = await prisma.schedule.findMany({
            where: {
                classSubjectId: {
                    in: teacher.classSubjects.map((cs) => cs.id),
                },
            },
            select: {
                id: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                room: true,
                classId: true,
                classSubjectId: true,
            },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        });

        return NextResponse.json({
            ...teacher,
            subjects: Array.from(seenSubjects.values()),
            classes: Array.from(seenClasses.values()),
            schedules,
        });
    } catch (error) {
        logger.error("Error fetching teacher detail", error as Error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération de l'enseignant" },
            { status: 500 }
        );
    }
}
