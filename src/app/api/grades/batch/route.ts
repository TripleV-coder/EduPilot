import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { bulkGradeSchema } from "@/lib/validations/evaluation";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";

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

                if (evaluation.period.endDate < new Date()) {
            return NextResponse.json(
                {
                    error: `Impossible de modifier les notes : la période "${evaluation.period.name}" est clôturée.`,
                },
                { status: 400 }
            );
        }

        if (session.user.role !== "SUPER_ADMIN") {
            if (evaluation.classSubject.class.schoolId !== session.user.schoolId) {
                return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
            }

            if (session.user.role === "TEACHER") {
                if (evaluation.classSubject.teacher?.userId !== session.user.id) {
                    return NextResponse.json(
                        translateError({ error: "Vous ne pouvez noter que vos propres matières", key: "api.issues.teacher_own_subjects_only" }, t),
                        { status: 403 }
                    );
                }
            }
        }

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

        const invalidGrade = validatedData.grades.find(
            (gradeInput) =>
                gradeInput.value !== null &&
                gradeInput.value !== undefined &&
                gradeInput.value > Number(evaluation.maxGrade)
        );

        if (invalidGrade) {
            return NextResponse.json(
                {
                    error: `La note ne peut pas dépasser ${Number(evaluation.maxGrade)}`,
                },
                { status: 400 }
            );
        }

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
                    update: {
                        value: gradeInput.value,
                        isAbsent: gradeInput.isAbsent,
                        isExcused: gradeInput.isExcused,
                        comment: gradeInput.comment,
                        deletedAt: null,
                    },
                    create: {
                        evaluationId: validatedData.evaluationId,
                        studentId: gradeInput.studentId,
                        value: gradeInput.value,
                        isAbsent: gradeInput.isAbsent,
                        isExcused: gradeInput.isExcused,
                        comment: gradeInput.comment
                    }
                })
            )
        );

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
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]
    }
);
