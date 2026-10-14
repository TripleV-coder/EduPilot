/**
 * Catégories d'options gérées par un écran dédié (validation stricte + journal
 * des changements) : jamais modifiables depuis l'écran générique des options.
 */
const RESERVED_CATEGORIES = new Set(["GRADING_SETTINGS", "GRADE_SETTINGS", "NATIONAL_EXAMS", "SCHOOL_PARAMETERS"]);

export function isReservedCategory(category: string | null | undefined): boolean {
    return RESERVED_CATEGORIES.has((category ?? "").trim().toUpperCase());
}

export const RESERVED_ERROR = {
    error: "Ce réglage se modifie depuis son écran dédié (Règles de l'établissement), pas depuis les options génériques.",
    code: "RESERVED_CATEGORY",
};
