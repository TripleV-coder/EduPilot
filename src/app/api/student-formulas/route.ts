/**
 * Calcul adapté pour UN élève, dans une matière et une période.
 *
 * Exemple : l'élève a manqué un devoir pour une raison valable ; au lieu de
 * (MI + D1 + D2) ÷ 3, l'enseignant écrit (MI + D1) ÷ 2 pour lui seul. Les notes
 * de l'élève sont nommées I1, I2… D1, D2… C1… (par famille et par date).
 *
 * GET : calculs adaptés d'une matière pour une période (équipe pédagogique).
 * PUT : { classSubjectId, periodId, studentId, formula, reason } — formula null
 *       pour revenir au calcul normal. Réservé à l'enseignant de la matière, si
 *       l'école le permet, avant la validation du conseil de classe ; la formule
 *       est vérifiée comme toutes les autres et chaque changement est tracé.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { assertNotCouncilLocked, assertSubjectTeacher } from "@/lib/academic/grade-write-guard";
import { getGradingSettings } from "@/lib/academic/grading-settings";
import { validateFormula } from "@/lib/academic/formula";
import { syncAnalyticsForClassPeriod } from "@/lib/services/analytics-sync";
import { logger } from "@/lib/utils/logger";

const READ_ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

const putSchema = z.object({
    classSubjectId: z.string().min(1),
    periodId: z.string().min(1),
    studentId: z.string().min(1),
    formula: z.string().max(300).nullable(),
    reason: z.string().trim().max(300).optional(),
});

async function loadSubject(id: string) {
    return prisma.classSubject.findUnique({
        where: { id },
        select: {
            id: true,
            classId: true,
            subject: { select: { name: true } },
            class: { select: { schoolId: true, name: true } },
            teacher: { select: { userId: true } },
        },
    });
}

export const GET = createApiHandler(
    async (request, { session }) => {
        const { searchParams } = new URL(request.url);
        const classSubjectId = searchParams.get("classSubjectId") ?? "";
        const periodId = searchParams.get("periodId") ?? "";
        const classId = searchParams.get("classId") ?? "";

        // Toute une classe (toutes matières, toutes périodes) : pour les écrans qui
        // recalculent les moyennes, afin d'afficher exactement celles du bulletin
        if (classId && !classSubjectId) {
            const klass = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
            if (!klass) return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
            if (!canAccessSchool(session, klass.schoolId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
            const rows = await prisma.studentFormula.findMany({
                where: { classSubject: { classId } },
                select: { classSubjectId: true, periodId: true, studentId: true, formula: true },
            });
            return NextResponse.json({ data: rows });
        }

        if (!classSubjectId || !periodId) {
            return NextResponse.json({ error: "classSubjectId et periodId sont requis" }, { status: 400 });
        }
        const cs = await loadSubject(classSubjectId);
        if (!cs) return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
        if (!canAccessSchool(session, cs.class.schoolId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

        const rows = await prisma.studentFormula.findMany({
            where: { classSubjectId, periodId },
            select: { studentId: true, formula: true, reason: true, updatedAt: true },
        });
        const settings = await getGradingSettings(cs.class.schoolId);
        return NextResponse.json({
            data: rows,
            canEdit: settings.studentAdjustments && session.user.role === "TEACHER" && cs.teacher?.userId === session.user.id,
            studentAdjustments: settings.studentAdjustments,
        });
    },
    { allowedRoles: READ_ROLES },
);

export const PUT = createApiHandler(
    async (request, { session }) => {
        const parsed = putSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
        const { classSubjectId, periodId, studentId, reason } = parsed.data;

        const cs = await loadSubject(classSubjectId);
        if (!cs) return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
        if (!canAccessSchool(session, cs.class.schoolId)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

        // Seul l'enseignant de la matière adapte le calcul de ses élèves
        const notTeacher = assertSubjectTeacher(session, cs);
        if (notTeacher) return notTeacher;

        const settings = await getGradingSettings(cs.class.schoolId);
        if (!settings.studentAdjustments) {
            return NextResponse.json(
                { error: "L'établissement ne permet pas d'adapter le calcul pour un élève.", code: "STUDENT_ADJUSTMENTS_DISABLED" },
                { status: 403 },
            );
        }

        // La période doit être celle de l'établissement, et pas encore figée par le conseil
        const period = await prisma.period.findUnique({
            where: { id: periodId },
            select: { id: true, academicYearId: true, academicYear: { select: { schoolId: true } } },
        });
        if (!period || period.academicYear.schoolId !== cs.class.schoolId) {
            return NextResponse.json({ error: "Période introuvable" }, { status: 404 });
        }
        const locked = await assertNotCouncilLocked(cs.classId, periodId);
        if (locked) return locked;

        // L'élève doit avoir été inscrit dans la classe
        const enrolled = await prisma.enrollment.findFirst({
            where: { studentId, classId: cs.classId },
            select: { id: true },
        });
        if (!enrolled) return NextResponse.json({ error: "Cet élève n'est pas dans la classe." }, { status: 400 });

        const raw = parsed.data.formula?.trim() ?? "";
        let formula: string | null = null;
        if (raw) {
            const check = validateFormula(raw, "SUBJECT");
            if (!check.ok) return NextResponse.json({ error: check.error, code: "FORMULA_INVALID" }, { status: 400 });
            if (!reason) {
                return NextResponse.json(
                    { error: "Indiquez pourquoi le calcul est adapté pour cet élève.", code: "REASON_REQUIRED" },
                    { status: 400 },
                );
            }
            formula = check.text;
        }

        const key = { classSubjectId_periodId_studentId: { classSubjectId, periodId, studentId } };
        const before = await prisma.studentFormula.findUnique({ where: key, select: { formula: true, reason: true } });

        await prisma.$transaction([
            formula
                ? prisma.studentFormula.upsert({
                      where: key,
                      create: { classSubjectId, periodId, studentId, formula, reason: reason!, createdById: session.user.id },
                      update: { formula, reason: reason!, createdById: session.user.id },
                  })
                : prisma.studentFormula.deleteMany({ where: { classSubjectId, periodId, studentId } }),
            prisma.auditLog.create({
                data: {
                    userId: session.user.id,
                    schoolId: cs.class.schoolId,
                    action: "STUDENT_FORMULA_CHANGED",
                    entity: "StudentFormula",
                    entityId: `${classSubjectId}:${periodId}:${studentId}`,
                    oldValues: { formula: before?.formula ?? null, reason: before?.reason ?? null, subject: cs.subject.name },
                    newValues: { formula, reason: formula ? reason ?? null : null, subject: cs.subject.name, studentId, periodId },
                },
            }),
        ]);

        void syncAnalyticsForClassPeriod(cs.classId, periodId, period.academicYearId).catch((error: unknown) =>
            logger.error("Recalcul après calcul adapté", error as Error, { classSubjectId, studentId }),
        );

        return NextResponse.json({ studentId, formula, reason: formula ? reason ?? null : null });
    },
    { allowedRoles: ["TEACHER"] },
);
