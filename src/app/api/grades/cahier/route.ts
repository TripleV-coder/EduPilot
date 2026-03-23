import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { Prisma } from "@prisma/client";

/**
 * GET /api/grades/cahier
 * Returns all evaluations with grades for a given class, with optional filters.
 * Query params: classId (required), periodId, classSubjectId, typeId
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const classId = searchParams.get("classId");
        const periodId = searchParams.get("periodId");
        const classSubjectId = searchParams.get("classSubjectId");
        const typeId = searchParams.get("typeId");

        if (!classId) {
            return NextResponse.json({ error: "classId est requis" }, { status: 400 });
        }

        const classAccess = await assertModelAccess(session, "class", classId, "Classe introuvable");
        if (classAccess) return classAccess;

        // Build dynamic where clause for evaluations
        const evaluationWhere: Prisma.EvaluationWhereInput = {};
        if (periodId) evaluationWhere.periodId = periodId;
        if (classSubjectId) evaluationWhere.classSubjectId = classSubjectId;
        if (typeId) evaluationWhere.typeId = typeId;

        // First get the class subjects for this class
        const classSubjects = await prisma.classSubject.findMany({
            where: { classId },
            include: {
                subject: true,
                teacher: { include: { user: { select: { firstName: true, lastName: true } } } }
            }
        });

        const classSubjectIds = classSubjects.map(cs => cs.id);

        // Find all evaluations for these class subjects with optional filters
        const evaluations = await prisma.evaluation.findMany({
            where: {
                classSubjectId: classSubjectId ? classSubjectId : { in: classSubjectIds },
                ...evaluationWhere
            },
            include: {
                classSubject: {
                    include: { subject: true }
                },
                type: true,
                period: true,
                grades: {
                    include: {
                        student: {
                            include: {
                                user: { select: { firstName: true, lastName: true } }
                            }
                        }
                    },
                    orderBy: {
                        student: { user: { lastName: "asc" } }
                    }
                }
            },
            orderBy: [
                { period: { sequence: "asc" } },
                { date: "asc" }
            ]
        });

        // Get enrolled students for the class
        const enrollments = await prisma.enrollment.findMany({
            where: { classId, status: "ACTIVE" },
            include: {
                student: {
                    include: {
                        user: { select: { firstName: true, lastName: true } }
                    }
                }
            },
            orderBy: { student: { user: { lastName: "asc" } } }
        });

        const students = enrollments.map(e => ({
            id: e.student.id,
            matricule: e.student.matricule,
            firstName: e.student.user.firstName,
            lastName: e.student.user.lastName,
        }));

        const formattedEvaluations = evaluations.map(ev => {
            // Build a grade map by student ID for easy lookup
            const gradeMap: Record<string, { value: number | null; isAbsent: boolean; isExcused: boolean; comment: string | null }> = {};
            ev.grades.forEach(g => {
                gradeMap[g.studentId] = {
                    value: g.value !== null ? Number(g.value) : null,
                    isAbsent: g.isAbsent,
                    isExcused: g.isExcused,
                    comment: g.comment,
                };
            });

            // Compute stats
            const numericGrades = ev.grades.filter(g => g.value !== null && !g.isAbsent).map(g => Number(g.value));
            const avg = numericGrades.length > 0 ? numericGrades.reduce((a, b) => a + b, 0) / numericGrades.length : null;
            const min = numericGrades.length > 0 ? Math.min(...numericGrades) : null;
            const max = numericGrades.length > 0 ? Math.max(...numericGrades) : null;

            return {
                id: ev.id,
                title: ev.title,
                date: ev.date,
                maxGrade: Number(ev.maxGrade),
                coefficient: Number(ev.coefficient),
                subject: ev.classSubject.subject.name,
                classSubjectId: ev.classSubjectId,
                type: ev.type.name,
                typeId: ev.typeId,
                period: ev.period.name,
                periodId: ev.periodId,
                stats: { average: avg ? Number(avg.toFixed(2)) : null, min, max, graded: numericGrades.length, total: students.length },
                grades: gradeMap
            };
        });

        // Also compute summary by subject for this class
        const subjectSummary = classSubjects.map(cs => {
            const subjectEvals = formattedEvaluations.filter(e => e.classSubjectId === cs.id);
            return {
                id: cs.id,
                name: cs.subject.name,
                teacher: cs.teacher ? `${cs.teacher.user.lastName} ${cs.teacher.user.firstName}` : null,
                evaluationCount: subjectEvals.length,
            };
        });

        return NextResponse.json({
            students,
            evaluations: formattedEvaluations,
            subjects: subjectSummary,
        });
    } catch (error) {
        logger.error("Error fetching cahier de notes:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
