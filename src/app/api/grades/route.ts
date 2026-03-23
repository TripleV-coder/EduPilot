import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/grades
 * List grades filtered by studentId, classId, periodId, etc.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");
        const classId = searchParams.get("classId");
        const periodId = searchParams.get("periodId");
        const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200")));

        if (!studentId && !classId) {
            return NextResponse.json({ error: "studentId ou classId requis" }, { status: 400 });
        }

        // Build where clause with school isolation
        const where: Prisma.GradeWhereInput = { deletedAt: null };

        if (studentId) {
            where.studentId = studentId;
        }

        if (periodId) {
            where.evaluation = { ...where.evaluation as Prisma.EvaluationWhereInput, periodId };
        }

        // School isolation for non-super admins
        if (session.user.role !== "SUPER_ADMIN") {
            if (!session.user.schoolId) {
                return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            }
            where.student = {
                ...(where.student as Prisma.StudentProfileWhereInput),
                user: { schoolId: session.user.schoolId },
            };
        }

        // For parents, restrict to their children only
        if (session.user.role === "PARENT") {
            const parentProfile = await prisma.parentProfile.findUnique({
                where: { userId: session.user.id },
                select: {
                    parentStudents: {
                        select: { studentId: true },
                    },
                },
            });

            const childIds = parentProfile?.parentStudents.map((s: { studentId: string }) => s.studentId) || [];

            if (studentId) {
                if (!childIds.includes(studentId)) {
                    return NextResponse.json({ error: "Accès refusé: Cet élève n'est pas lié à votre compte" }, { status: 403 });
                }
            } else {
                // Force filter to all children if no specific studentId provided
                where.studentId = { in: childIds };
            }
        }

        const grades = await prisma.grade.findMany({
            where,
            include: {
                evaluation: {
                    include: {
                        classSubject: {
                            include: {
                                subject: { select: { id: true, name: true } },
                                class: { select: { id: true, name: true } },
                            },
                        },
                        period: { select: { id: true, name: true } },
                        type: { select: { id: true, name: true } },
                    },
                },
            },
            take: limit,
        });

        // Compute class averages for these evaluations
        const evaluationIds = Array.from(new Set(grades.map(g => g.evaluationId)));

        const averages = await prisma.grade.groupBy({
            by: ['evaluationId'],
            where: {
                evaluationId: { in: evaluationIds },
                value: { not: null },
                isAbsent: false,
                isExcused: false,
                deletedAt: null
            },
            _avg: {
                value: true
            }
        });

        const avgMap = new Map();
        averages.forEach(a => avgMap.set(a.evaluationId, Number(a._avg.value)));

        // Transform to the format the frontend expects
        const data = grades.map((g) => ({
            id: g.id,
            value: g.value !== null ? Number(g.value) : null,
            maxValue: Number(g.evaluation.maxGrade),
            isAbsent: g.isAbsent,
            isExcused: g.isExcused,
            comment: g.comment,
            date: g.evaluation.date.toISOString(),
            subject: g.evaluation.classSubject.subject,
            evaluationType: g.evaluation.type,
            period: g.evaluation.period,
            class: g.evaluation.classSubject.class,
            coefficient: Number(g.evaluation.coefficient),
            classAverage: avgMap.get(g.evaluationId) || null,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        logger.error("Error fetching grades", error as Error);
        return NextResponse.json({ error: "Erreur lors du chargement des notes" }, { status: 500 });
    }
}
