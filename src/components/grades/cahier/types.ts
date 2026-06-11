// Extrait de dashboard/grades/cahier/page.tsx (1349 lignes) lors de la
// découpe (P3.1, 2026-06-11). Logique inchangée.

export type Student = {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
};
export type GradeEntry = {
    value: number | null;
    isAbsent: boolean;
    isExcused: boolean;
    comment: string | null;
};
export type EvalStats = {
    average: number | null;
    min: number | null;
    max: number | null;
    graded: number;
    total: number;
};
export type EvaluationData = {
    id: string;
    title: string | null;
    date: string;
    maxGrade: number;
    coefficient: number;
    subject: string;
    classSubjectId: string;
    type: string;
    typeId: string;
    period: string;
    periodId: string;
    stats: EvalStats;
    grades: Record<string, GradeEntry>;
};
export type SubjectInfo = {
    id: string;
    name: string;
    teacher: string | null;
    evaluationCount: number;
};
export type ClassOption = { id: string; name: string };
export type PeriodOption = { id: string; name: string };
export type EvalTypeOption = { id: string; name: string };

export type ScoreVariant = "success" | "brand" | "warning" | "danger" | "neutral";

export function pickScoreVariant(score: number | null, max = 20): ScoreVariant {
    if (score === null) return "neutral";
    const normalized = (score / max) * 20;
    if (normalized >= 16) return "success";
    if (normalized >= 14) return "brand";
    if (normalized >= 10) return "warning";
    return "danger";
}

export function variantToken(variant: ScoreVariant, scale: 50 | 100 | 200 | 600 | 700 | 800): string {
    if (variant === "neutral") return `var(--eduflow-neutral-${scale})`;
    if (variant === "brand") return `var(--brand-${scale})`;
    return `var(--eduflow-${variant}-${scale})`;
}
