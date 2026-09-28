/**
 * Questions d'un examen en ligne : validation par type, barème, droit de modification.
 *
 * Types proposés à la saisie : QCM et vrai/faux (corrigés automatiquement à la
 * soumission, voir api/exams/[id]/submit) et réponse courte (corrigée par
 * l'enseignant). ESSAY et FILL_BLANK existent dans le schéma mais n'ont pas
 * d'écran de passage : ils ne sont pas proposés.
 */
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { roleSatisfies } from "@/lib/rbac/permissions";

export const TRUE_FALSE_OPTIONS = ["Vrai", "Faux"] as const;

const base = {
    question: z.string().trim().min(1, "L'énoncé est requis").max(2_000),
    points: z.coerce.number().int().min(1, "Au moins 1 point").max(100),
    explanation: z.string().trim().max(2_000).optional(),
};

const mcq = z
    .object({
        type: z.literal("MCQ"),
        ...base,
        options: z.array(z.string().trim().min(1).max(500)).min(2, "Au moins deux choix").max(10),
        correctAnswer: z.string().trim().min(1, "Indiquez la bonne réponse"),
    })
    .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, {
        message: "Deux choix identiques",
        path: ["options"],
    })
    .refine((q) => q.options.includes(q.correctAnswer), {
        message: "La bonne réponse doit être l'un des choix",
        path: ["correctAnswer"],
    });

const trueFalse = z.object({
    type: z.literal("TRUE_FALSE"),
    ...base,
    correctAnswer: z.enum(TRUE_FALSE_OPTIONS),
});

const shortAnswer = z.object({
    type: z.literal("SHORT_ANSWER"),
    ...base,
});

const questionInputSchema = z.union([mcq, trueFalse, shortAnswer]);

export type QuestionInput = {
    type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
    question: string;
    points: number;
    options: string[];
    correctAnswer: string | null;
    explanation: string | null;
};

export function parseQuestionInput(
    raw: unknown,
): { success: true; data: QuestionInput } | { success: false; error: string } {
    const parsed = questionInputSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Question invalide" };
    }
    const q = parsed.data;
    return {
        success: true,
        data: {
            type: q.type,
            question: q.question,
            points: q.points,
            options: q.type === "MCQ" ? q.options : q.type === "TRUE_FALSE" ? [...TRUE_FALSE_OPTIONS] : [],
            correctAnswer: q.type === "SHORT_ANSWER" ? null : q.correctAnswer,
            explanation: q.explanation ?? null,
        },
    };
}

/**
 * Barème tiré des questions : total = somme des points, réussite = la moitié.
 * Évite l'examen « sur 100 » (valeur par défaut) dont 5 questions d'un point
 * ne permettaient jamais d'atteindre le seuil de 50.
 */
export function examBareme(questions: readonly { points: number }[]): { totalPoints: number; passingScore: number } {
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    return { totalPoints, passingScore: Math.ceil(totalPoints / 2) };
}

/** Auteur, enseignant de la matière ou direction. */
export function canEditExam(
    user: { id: string; role: UserRole | string },
    exam: { createdById: string | null; classSubject: { teacher: { userId: string } | null } | null },
): boolean {
    if (roleSatisfies(user.role as UserRole, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"])) return true;
    if (user.role !== "TEACHER") return false;
    return exam.createdById === user.id || exam.classSubject?.teacher?.userId === user.id;
}
