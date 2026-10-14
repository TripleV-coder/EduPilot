/**
 * Règles d'écriture des notes (docs/QUESTIONS_NOTES_MOYENNES.md, G1 à G3, B5) :
 *   - seul l'enseignant de la matière saisit et modifie ses notes et ses évaluations ;
 *   - après validation du conseil de classe, la période est figée : une
 *     correction passe par une réclamation (proposée par l'enseignant,
 *     approuvée par le directeur des études) ;
 *   - une absence justifiée exige un motif (billet visé) ;
 *   - toute modification est historisée (valeur avant / après), visible du
 *     personnel ayant les permissions sur les notes.
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { GradingSettings } from "@/lib/academic/grading-settings";

type Session = { user: { id: string; role: string } };

/** 403 si l'utilisateur n'est pas l'enseignant de la matière. */
export function assertSubjectTeacher(
    session: Session,
    classSubject: { teacher: { userId: string } | null },
): NextResponse | null {
    if (session.user.role === "TEACHER" && classSubject.teacher?.userId === session.user.id) return null;
    return NextResponse.json(
        {
            error: "Seul l'enseignant de la matière peut saisir ou modifier ses notes.",
            code: "SUBJECT_TEACHER_ONLY",
        },
        { status: 403 },
    );
}

/** 409 si le conseil de classe de la période est validé (notes figées). */
export async function assertNotCouncilLocked(classId: string, periodId: string): Promise<NextResponse | null> {
    const council = await prisma.classCouncil.findUnique({
        where: { classId_periodId: { classId, periodId } },
        select: { validatedAt: true },
    });
    if (!council) return null;
    return NextResponse.json(
        {
            error:
                "Le conseil de classe de cette période est validé : les notes sont figées. Une correction passe par une réclamation, approuvée par le directeur des études.",
            code: "COUNCIL_LOCKED",
        },
        { status: 409 },
    );
}

/** Motif obligatoire pour une absence justifiée ou une dispense. */
export function missingExcuseReason(grades: Array<{ isExcused?: boolean; excuseReason?: string | null }>): boolean {
    return grades.some((g) => g.isExcused && !(g.excuseReason ?? "").trim());
}

/** Note exprimée en centièmes, ou null si elle a plus de deux décimales. */
function toHundredths(value: number): number | null {
    const scaled = Math.round(value * 100);
    return Math.abs(value * 100 - scaled) < 1e-6 ? scaled : null;
}

/**
 * Contrôle des valeurs saisies selon les règles de l'école : pas de saisie
 * (0,01 / 0,25 / 0,5 / 1), note entre 0 et le barème, motif d'absence justifiée
 * exigé si l'école l'a choisi. Renvoie la réponse 400 à retourner, ou null.
 */
export function checkGradeValues(
    grades: Array<{ value?: number | null; isAbsent?: boolean; isExcused?: boolean; excuseReason?: string | null }>,
    maxGrade: number,
    settings: Pick<GradingSettings, "gradeStep" | "excuseReasonRequired">,
): NextResponse | null {
    const step = toHundredths(Number(settings.gradeStep)) ?? 1;
    const max = toHundredths(maxGrade);
    for (const g of grades) {
        if (g.isAbsent || g.value === null || g.value === undefined) continue;
        const cents = toHundredths(g.value);
        if (cents === null || cents < 0 || (max !== null && cents > max)) {
            return NextResponse.json(
                { error: `Une note doit être comprise entre 0 et ${maxGrade}, avec au plus deux décimales.`, code: "GRADE_OUT_OF_RANGE" },
                { status: 400 },
            );
        }
        if (cents % step !== 0) {
            return NextResponse.json(
                {
                    error: `L'établissement saisit les notes par pas de ${settings.gradeStep.replace(".", ",")} : ${String(g.value).replace(".", ",")} n'est pas accepté.`,
                    code: "GRADE_STEP_MISMATCH",
                },
                { status: 400 },
            );
        }
    }
    if (settings.excuseReasonRequired && missingExcuseReason(grades)) {
        return NextResponse.json(
            { error: "Une absence justifiée exige un motif (billet visé par le directeur des études).", code: "EXCUSE_REASON_REQUIRED" },
            { status: 400 },
        );
    }
    return null;
}

export interface GradeSnapshot {
    value: number | null;
    isAbsent: boolean;
    isExcused: boolean;
    excuseReason: string | null;
    /** Motif si la note n'est pas comptée pour l'élève. */
    excludedReason: string | null;
}

type GradeState = {
    value: unknown;
    isAbsent: boolean;
    isExcused: boolean;
    excuseReason?: string | null;
    excludedReason?: string | null;
};

function snapshot(g: GradeState | null): GradeSnapshot | null {
    if (!g) return null;
    return {
        value: g.value === null || g.value === undefined ? null : Number(g.value),
        isAbsent: g.isAbsent,
        isExcused: g.isExcused,
        excuseReason: g.excuseReason ?? null,
        excludedReason: g.excludedReason ?? null,
    };
}

/**
 * Historise les changements de notes (seulement ceux qui modifient réellement
 * quelque chose) dans le journal d'audit.
 */
export async function logGradeChanges(params: {
    userId: string;
    schoolId: string | null;
    evaluationId: string;
    changes: Array<{
        studentId: string;
        gradeId?: string | null;
        before: GradeState | null;
        after: GradeState | null;
        reason?: string | null;
    }>;
    action?: string;
    tx?: Prisma.TransactionClient;
}): Promise<void> {
    const rows = params.changes
        .map((c) => ({ c, before: snapshot(c.before), after: snapshot(c.after) }))
        .filter(({ before, after }) => JSON.stringify(before) !== JSON.stringify(after))
        .map(({ c, before, after }) => ({
            userId: params.userId,
            schoolId: params.schoolId,
            action: params.action ?? "GRADE_CHANGED",
            entity: "Grade",
            entityId: c.gradeId ?? null,
            oldValues: before
                ? ({ ...before, evaluationId: params.evaluationId, studentId: c.studentId } as Prisma.InputJsonValue)
                : undefined,
            newValues: after
                ? ({ ...after, evaluationId: params.evaluationId, studentId: c.studentId, reason: c.reason ?? null } as Prisma.InputJsonValue)
                : undefined,
        }));
    if (rows.length === 0) return;
    await (params.tx ?? prisma).auditLog.createMany({ data: rows });
}
