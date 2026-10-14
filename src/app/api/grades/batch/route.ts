import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bulkGradeSchema } from "@/lib/validations/evaluation";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";
import { guardPeriodWritable } from "@/lib/academic/year-lock";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { assertNotCouncilLocked, assertSubjectTeacher, checkGradeValues, logGradeChanges } from "@/lib/academic/grade-write-guard";
import { getGradingSettings } from "@/lib/academic/grading-settings";

export const POST = createApiHandler(
    async (request, { session }, t) => {
        const body = await request.json();
        const validatedData = bulkGradeSchema.parse(body);

        // Verify evaluation exists and is accessible
        const evaluation = await prisma.evaluation.findUnique({
            where: { id: validatedData.evaluationId },
            include: {
                classSubject: {
                    include: {
                        class: { select: { schoolId: true } },
                        teacher: { select: { userId: true } },
                    },
                },
                period: { select: { endDate: true, name: true } },
                },
                });

                if (!evaluation) {
                return NextResponse.json(
                translateError({ error: "Évaluation non trouvée", key: "api.issues.not_found", params: { resource: "Évaluation" } }, t),
                { status: 404 }
                );
                }

        const yearLock = await guardPeriodWritable(evaluation.periodId);
        if (yearLock) return yearLock;

        if (!canAccessSchool(session, evaluation.classSubject.class.schoolId)) {
            return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }
        // Seul l'enseignant de la matière saisit ses notes (il est maître de sa matière)
        const notTeacher = assertSubjectTeacher(session, evaluation.classSubject);
        if (notTeacher) return notTeacher;
        // Après le conseil de classe, la période est figée (réclamation obligatoire).
        // Remplace l'ancien blocage à la date de fin de période, qui empêchait la
        // saisie des compositions corrigées après cette date et les rattrapages.
        const councilLock = await assertNotCouncilLocked(evaluation.classSubject.classId, evaluation.periodId);
        if (councilLock) return councilLock;

        // Valeurs : barème, pas de saisie et motif d'absence selon les règles de l'école
        const schoolRules = await getGradingSettings(evaluation.classSubject.class.schoolId);
        const invalidValues = checkGradeValues(validatedData.grades, Number(evaluation.maxGrade), schoolRules);
        if (invalidValues) return invalidValues;

        // Anti-Fraud / IDOR Check: Ensure all submitted students are actually enrolled in the class
        const classId = evaluation.classSubject.classId;
        const uniqueStudentIds = [...new Set(validatedData.grades.map(g => g.studentId))];

        const validEnrollmentsCount = await prisma.enrollment.count({
            where: {
                studentId: { in: uniqueStudentIds },
                classId: classId,
                status: "ACTIVE"
            }
        });

        if (validEnrollmentsCount !== uniqueStudentIds.length) {
            return NextResponse.json(
                { error: "Opération bloquée: Tentative d'attribuer une note à des étudiants non inscrits dans la classe de cette évaluation." },
                { status: 400 }
            );
        }

        // État avant modification (historique des changements)
        const before = await prisma.grade.findMany({
            where: { evaluationId: validatedData.evaluationId, studentId: { in: uniqueStudentIds } },
            select: { id: true, studentId: true, value: true, isAbsent: true, isExcused: true, excuseReason: true, deletedAt: true },
        });
        const beforeByStudent = new Map(before.map((g) => [g.studentId, g]));

        // Upsert all grades in a transaction
        const results = await prisma.$transaction(
            validatedData.grades.map(gradeInput =>
                prisma.grade.upsert({
                    where: {
                        evaluationId_studentId: {
                            evaluationId: validatedData.evaluationId,
                            studentId: gradeInput.studentId,
                        }
                    },
                    // Absence : jamais de valeur (non justifiée = 0 au calcul, justifiée = exclue).
                    // L'élève qui recompose : on saisit la note et on retire l'absence.
                    update: {
                        value: gradeInput.isAbsent ? null : gradeInput.value,
                        isAbsent: gradeInput.isAbsent,
                        isExcused: gradeInput.isExcused,
                        excuseReason: gradeInput.isExcused ? gradeInput.excuseReason?.trim() ?? null : null,
                        comment: gradeInput.comment,
                        deletedAt: null,
                    },
                    create: {
                        evaluationId: validatedData.evaluationId,
                        studentId: gradeInput.studentId,
                        value: gradeInput.isAbsent ? null : gradeInput.value,
                        isAbsent: gradeInput.isAbsent,
                        isExcused: gradeInput.isExcused,
                        excuseReason: gradeInput.isExcused ? gradeInput.excuseReason?.trim() ?? null : null,
                        comment: gradeInput.comment
                    }
                })
            )
        );

        // Historique : visible du personnel ayant les permissions sur les notes
        await logGradeChanges({
            userId: session.user.id,
            schoolId: evaluation.classSubject.class.schoolId,
            evaluationId: validatedData.evaluationId,
            changes: results.map((g) => {
                const prev = beforeByStudent.get(g.studentId);
                return {
                    studentId: g.studentId,
                    gradeId: g.id,
                    before: prev && !prev.deletedAt ? prev : null,
                    after: g,
                };
            }),
        });

        await syncAnalyticsAfterGradeChange(
            validatedData.evaluationId,
            validatedData.grades.map((grade) => grade.studentId)
        );
        await Promise.all([
            invalidateByPath(CACHE_PATHS.grades),
            invalidateByPath("/api/analytics"),
            invalidateByPath("/api/grades/statistics"),
            invalidateByPath("/api/grades/report-cards"),
        ]);

        return NextResponse.json({ success: true, count: results.length }, { status: 201 });
    },
    {
        requireAuth: true,
        // Seul l'enseignant de la matière saisit ses notes
        allowedRoles: ["TEACHER"]
    }
);
