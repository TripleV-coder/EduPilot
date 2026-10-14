/**
 * Décision du directeur des études sur une correction proposée par
 * l'enseignant (voir ../route.ts). Approuver applique la nouvelle note — seule
 * écriture possible dans une période figée par le conseil — et la trace dans
 * l'historique des notes ; refuser laisse la note inchangée.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logGradeChanges } from "@/lib/academic/grade-write-guard";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { syncAnalyticsAfterGradeChange } from "@/lib/services/analytics-sync";

const decisionSchema = z.object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reviewNote: z.string().trim().max(1000).optional(),
});

export const PATCH = createApiHandler(
    async (request, { session, params }) => {
        const { id } = await params;
        const parsed = decisionSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: "Décision invalide" }, { status: 400 });
        const { decision, reviewNote } = parsed.data;
        if (decision === "REJECT" && !reviewNote) {
            return NextResponse.json({ error: "Indiquez la raison du refus." }, { status: 400 });
        }

        const correction = await prisma.gradeCorrectionRequest.findUnique({
            where: { id },
            include: {
                evaluation: { select: { id: true, classSubject: { select: { class: { select: { schoolId: true } } } } } },
            },
        });
        if (!correction) return NextResponse.json({ error: "Réclamation introuvable" }, { status: 404 });
        const schoolId = correction.evaluation.classSubject.class.schoolId;
        if (!canAccessSchool(session, schoolId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        if (correction.requestedById === session.user.id) {
            return NextResponse.json({ error: "La personne qui propose la correction ne peut pas l'approuver." }, { status: 403 });
        }

        const now = new Date();
        const outcome = await prisma.$transaction(async (tx) => {
            // Décision unique : seule une réclamation encore en attente est traitée
            const claimed = await tx.gradeCorrectionRequest.updateMany({
                where: { id, status: "PENDING" },
                data: {
                    status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
                    reviewedById: session.user.id,
                    reviewedAt: now,
                    reviewNote: reviewNote ?? null,
                },
            });
            if (claimed.count === 0) return "ALREADY_DECIDED" as const;

            if (decision === "REJECT") {
                await tx.auditLog.create({
                    data: {
                        userId: session.user.id,
                        schoolId,
                        action: "GRADE_CORRECTION_REJECTED",
                        entity: "GradeCorrectionRequest",
                        entityId: id,
                        newValues: { reviewNote: reviewNote ?? null },
                    },
                });
                return "REJECTED" as const;
            }

            const before = await tx.grade.findUnique({
                where: { evaluationId_studentId: { evaluationId: correction.evaluationId, studentId: correction.studentId } },
            });
            const next = {
                value: correction.proposedAbsent ? null : correction.proposedValue,
                isAbsent: correction.proposedAbsent,
                isExcused: correction.proposedExcused,
                excuseReason: correction.proposedExcused ? correction.excuseReason : null,
            };
            const after = await tx.grade.upsert({
                where: { evaluationId_studentId: { evaluationId: correction.evaluationId, studentId: correction.studentId } },
                update: { ...next, deletedAt: null },
                create: { evaluationId: correction.evaluationId, studentId: correction.studentId, ...next },
            });
            await logGradeChanges({
                userId: session.user.id,
                schoolId,
                evaluationId: correction.evaluationId,
                action: "GRADE_CORRECTION_APPROVED",
                changes: [
                    {
                        studentId: correction.studentId,
                        gradeId: after.id,
                        before: before && !before.deletedAt ? before : null,
                        after,
                        reason: correction.reason,
                    },
                ],
                tx,
            });
            return "APPROVED" as const;
        });

        if (outcome === "ALREADY_DECIDED") {
            return NextResponse.json({ error: "Cette réclamation a déjà été traitée.", code: "ALREADY_DECIDED" }, { status: 409 });
        }
        if (outcome === "APPROVED") {
            await syncAnalyticsAfterGradeChange(correction.evaluationId, [correction.studentId]);
            await Promise.all([
                invalidateByPath(CACHE_PATHS.grades),
                invalidateByPath("/api/analytics"),
                invalidateByPath("/api/grades/statistics"),
                invalidateByPath("/api/grades/report-cards"),
            ]);
        }
        return NextResponse.json({ id, status: outcome });
    },
    // Le directeur des études (DIRECTOR) et la direction de l'établissement
    { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);
