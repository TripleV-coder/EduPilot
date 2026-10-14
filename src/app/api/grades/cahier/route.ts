import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { meanOf, Rational, toDisplay } from "@/lib/academic/average-engine";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { getGradingSettings } from "@/lib/academic/grading-settings";
import { Prisma } from "@prisma/client";

/**
 * GET /api/grades/cahier
 * Returns all evaluations with grades for a given class, with optional filters.
 * Query params: classId (required), periodId, classSubjectId, typeId
 */
export const GET = createApiHandler(
  async (request, context) => {
    try {
    const session = context.session;
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

        // La matière demandée doit appartenir à CETTE classe : sinon le filtre
        // remplaçait la contrainte et ouvrait les notes d'une autre classe.
        if (classSubjectId && !classSubjectIds.includes(classSubjectId)) {
            return NextResponse.json({ error: "Matière introuvable dans cette classe" }, { status: 404 });
        }

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
                    where: { deletedAt: null },
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
            const gradeMap: Record<
                string,
                {
                    id: string;
                    value: number | null;
                    isAbsent: boolean;
                    isExcused: boolean;
                    excuseReason: string | null;
                    /** Motif si l'enseignant ne compte pas cette note pour l'élève. */
                    excludedReason: string | null;
                    comment: string | null;
                }
            > = {};
            ev.grades.forEach(g => {
                gradeMap[g.studentId] = {
                    id: g.id,
                    value: g.value !== null ? Number(g.value) : null,
                    isAbsent: g.isAbsent,
                    isExcused: g.isExcused,
                    excuseReason: g.excuseReason,
                    excludedReason: g.excludedReason,
                    comment: g.comment,
                };
            });

            // Statistiques de l'évaluation (sur son barème) : moyenne exacte, arrondie au centième
            const counted = ev.grades.filter(g => g.value !== null && !g.isAbsent && !g.isExcused);
            const numericGrades = counted.map(g => Number(g.value));
            const avg = toDisplay(meanOf(counted.map(g => Rational.from(g.value!))));
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
                subjectCoefficient: Number(ev.classSubject.coefficient),
                type: ev.type.name,
                typeCode: ev.type.code,
                // Rôle dans la moyenne (une compétence ne compte jamais)
                typeCategory: ev.type.category,
                typeId: ev.typeId,
                period: ev.period.name,
                periodId: ev.periodId,
                stats: { average: avg, min, max, graded: numericGrades.length, total: students.length },
                grades: gradeMap
            };
        });

        // Also compute summary by subject for this class
        // Formules en vigueur (enseignant si l'école le permet) et calculs adaptés
        // par élève : la page recalcule alors exactement les moyennes du bulletin
        const schoolId = classSubjects[0] ? (await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } }))?.schoolId : null;
        const settings = schoolId ? await getGradingSettings(schoolId) : null;
        const studentFormulas = await prisma.studentFormula.findMany({
            where: { classSubjectId: { in: classSubjectIds } },
            select: { classSubjectId: true, periodId: true, studentId: true, formula: true },
        });

        const subjectSummary = classSubjects.map(cs => {
            const subjectEvals = formattedEvaluations.filter(e => e.classSubjectId === cs.id);
            return {
                id: cs.id,
                name: cs.subject.name,
                teacher: cs.teacher ? `${cs.teacher.user.lastName} ${cs.teacher.user.firstName}` : null,
                evaluationCount: subjectEvals.length,
                formula: settings?.teacherFormulas && cs.averageFormula?.trim() ? cs.averageFormula : null,
            };
        });

        return NextResponse.json({
            students,
            evaluations: formattedEvaluations,
            studentFormulas,
            subjects: subjectSummary,
        });
    } catch (error) {
        logger.error("Error fetching cahier de notes:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }
);
