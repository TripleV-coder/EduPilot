/**
 * Réclamations de notes (décision du 2026-10-02) :
 *   1. l'élève ou sa famille prend rendez-vous (appointment/route.ts) ;
 *   2. la copie est revue en personne avec l'enseignant et le directeur des études ;
 *   3. l'enseignant de la matière enregistre ici la correction proposée ;
 *   4. le directeur des études l'approuve ou la refuse ([id]/route.ts).
 * Une correction ne passe par ce circuit que si la période est figée par le
 * conseil de classe ; avant, l'enseignant modifie directement sa note.
 *
 * GET  : réclamations de l'établissement (l'enseignant ne voit que ses matières).
 * POST : proposition de correction, par l'enseignant de la matière uniquement.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { assertSubjectTeacher, checkGradeValues } from "@/lib/academic/grade-write-guard";
import { getGradingSettings } from "@/lib/academic/grading-settings";
import { gradeValueSchema } from "@/lib/validations/evaluation";

const READ_ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

const proposalSchema = z
    .object({
        evaluationId: z.string().min(1),
        studentId: z.string().min(1),
        proposedValue: gradeValueSchema.nullable().optional(),
        proposedAbsent: z.boolean().default(false),
        proposedExcused: z.boolean().default(false),
        excuseReason: z.string().trim().max(300).optional().nullable(),
        reason: z.string().trim().min(5, "Indiquez le motif de la correction (au moins 5 caractères).").max(1000),
    })
    .refine((d) => d.proposedAbsent || (d.proposedValue !== null && d.proposedValue !== undefined), {
        message: "Indiquez la nouvelle note, ou une absence.",
    })
    .refine((d) => !d.proposedExcused || d.proposedAbsent, { message: "Une absence justifiée est d'abord une absence." });

export const GET = createApiHandler(
    async (request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
        }
        const status = new URL(request.url).searchParams.get("status");
        const statusFilter = status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? status : undefined;

        const requests = await prisma.gradeCorrectionRequest.findMany({
            where: {
                ...(statusFilter ? { status: statusFilter } : {}),
                evaluation: {
                    classSubject: {
                        ...(schoolId ? { class: { schoolId } } : {}),
                        // L'enseignant ne voit que les réclamations de ses matières
                        ...(session.user.role === "TEACHER" ? { teacher: { userId: session.user.id } } : {}),
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
                id: true,
                status: true,
                reason: true,
                proposedValue: true,
                proposedAbsent: true,
                proposedExcused: true,
                excuseReason: true,
                reviewNote: true,
                reviewedAt: true,
                createdAt: true,
                student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
                evaluation: {
                    select: {
                        id: true,
                        title: true,
                        date: true,
                        maxGrade: true,
                        type: { select: { name: true } },
                        period: { select: { name: true } },
                        classSubject: { select: { class: { select: { name: true } }, subject: { select: { name: true } } } },
                        grades: { select: { studentId: true, value: true, isAbsent: true, isExcused: true, deletedAt: true } },
                    },
                },
            },
        });

        return NextResponse.json({
            data: requests.map((r) => {
                const current = r.evaluation.grades.find((g) => g.studentId === r.student.id && !g.deletedAt) ?? null;
                return {
                    id: r.id,
                    status: r.status,
                    reason: r.reason,
                    reviewNote: r.reviewNote,
                    reviewedAt: r.reviewedAt,
                    createdAt: r.createdAt,
                    student: { id: r.student.id, name: `${r.student.user.firstName} ${r.student.user.lastName}` },
                    evaluation: {
                        id: r.evaluation.id,
                        label: r.evaluation.title || r.evaluation.type.name,
                        date: r.evaluation.date,
                        maxGrade: Number(r.evaluation.maxGrade),
                        period: r.evaluation.period.name,
                        className: r.evaluation.classSubject.class.name,
                        subject: r.evaluation.classSubject.subject.name,
                    },
                    current: current
                        ? {
                              value: current.value === null ? null : Number(current.value),
                              isAbsent: current.isAbsent,
                              isExcused: current.isExcused,
                          }
                        : null,
                    proposed: {
                        value: r.proposedValue === null ? null : Number(r.proposedValue),
                        isAbsent: r.proposedAbsent,
                        isExcused: r.proposedExcused,
                        excuseReason: r.excuseReason,
                    },
                };
            }),
        });
    },
    { allowedRoles: READ_ROLES },
);

export const POST = createApiHandler(
    async (request, { session }) => {
        const parsed = proposalSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
        }
        const data = parsed.data;

        const evaluation = await prisma.evaluation.findUnique({
            where: { id: data.evaluationId },
            select: {
                id: true,
                periodId: true,
                maxGrade: true,
                classSubject: {
                    select: { classId: true, class: { select: { schoolId: true } }, teacher: { select: { userId: true } } },
                },
            },
        });
        if (!evaluation) return NextResponse.json({ error: "Évaluation introuvable" }, { status: 404 });
        const schoolId = evaluation.classSubject.class.schoolId;
        if (!canAccessSchool(session, schoolId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

        // Seul l'enseignant de la matière propose la correction
        const notTeacher = assertSubjectTeacher(session, evaluation.classSubject);
        if (notTeacher) return notTeacher;

        // Hors période figée, l'enseignant corrige directement sa note
        const council = await prisma.classCouncil.findUnique({
            where: { classId_periodId: { classId: evaluation.classSubject.classId, periodId: evaluation.periodId } },
            select: { validatedAt: true },
        });
        if (!council) {
            return NextResponse.json(
                {
                    error: "Le conseil de classe de cette période n'est pas validé : modifiez directement la note depuis la saisie.",
                    code: "NOT_LOCKED",
                },
                { status: 409 },
            );
        }

        // L'élève doit avoir été inscrit dans la classe
        const enrolled = await prisma.enrollment.findFirst({
            where: { studentId: data.studentId, classId: evaluation.classSubject.classId },
            select: { id: true },
        });
        if (!enrolled) return NextResponse.json({ error: "Cet élève n'est pas dans la classe de l'évaluation." }, { status: 400 });

        const settings = await getGradingSettings(schoolId);
        const invalid = checkGradeValues(
            [
                {
                    value: data.proposedAbsent ? null : data.proposedValue,
                    isAbsent: data.proposedAbsent,
                    isExcused: data.proposedExcused,
                    excuseReason: data.excuseReason,
                },
            ],
            Number(evaluation.maxGrade),
            settings,
        );
        if (invalid) return invalid;

        const pending = await prisma.gradeCorrectionRequest.findFirst({
            where: { evaluationId: data.evaluationId, studentId: data.studentId, status: "PENDING" },
            select: { id: true },
        });
        if (pending) {
            return NextResponse.json(
                { error: "Une correction est déjà en attente de validation pour cette note.", code: "ALREADY_PENDING" },
                { status: 409 },
            );
        }

        const created = await prisma.$transaction(async (tx) => {
            const correction = await tx.gradeCorrectionRequest.create({
                data: {
                    evaluationId: data.evaluationId,
                    studentId: data.studentId,
                    requestedById: session.user.id,
                    proposedValue: data.proposedAbsent ? null : data.proposedValue,
                    proposedAbsent: data.proposedAbsent,
                    proposedExcused: data.proposedExcused,
                    excuseReason: data.proposedExcused ? data.excuseReason?.trim() || null : null,
                    reason: data.reason,
                },
                select: { id: true },
            });
            await tx.auditLog.create({
                data: {
                    userId: session.user.id,
                    schoolId,
                    action: "GRADE_CORRECTION_PROPOSED",
                    entity: "GradeCorrectionRequest",
                    entityId: correction.id,
                    newValues: {
                        evaluationId: data.evaluationId,
                        studentId: data.studentId,
                        proposedValue: data.proposedAbsent ? null : data.proposedValue ?? null,
                        proposedAbsent: data.proposedAbsent,
                        proposedExcused: data.proposedExcused,
                        reason: data.reason,
                    },
                },
            });
            return correction;
        });

        return NextResponse.json({ id: created.id, status: "PENDING" }, { status: 201 });
    },
    { allowedRoles: ["TEACHER"] },
);
