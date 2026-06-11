// Extrait de dashboard/grades/entry/page.tsx (1218 lignes) lors de la
// découpe (P3.1, 2026-06-11). Logique inchangée.

export interface ClassOption {
    id: string;
    name: string;
}
export interface PeriodOption {
    id: string;
    name: string;
}
export interface EvalTypeOption {
    id: string;
    name: string;
}
export interface ClassSubjectOption {
    id: string;
    subject?: { name: string };
}
export interface StudentItem {
    id: string;
    matricule?: string;
    user?: { firstName: string; lastName: string };
}
export interface GradeCell {
    value: string;
    isAbsent: boolean;
    isExcused: boolean;
    comment: string;
}
