/** Libellés FR des types et cycles d'établissement, pour la vitrine publique. */

export const SCHOOL_TYPE_LABELS: Record<string, string> = {
    PUBLIC: "Public",
    PRIVATE: "Privé",
    RELIGIOUS: "Confessionnel",
    INTERNATIONAL: "International",
};

export const SCHOOL_LEVEL_LABELS: Record<string, string> = {
    PRIMARY: "Primaire",
    SECONDARY_COLLEGE: "Collège",
    SECONDARY_LYCEE: "Lycée",
    MIXED: "Mixte",
};

export function schoolTypeLabel(type: string | null | undefined): string {
    return type ? SCHOOL_TYPE_LABELS[type] ?? type : "";
}

export function schoolLevelLabel(level: string): string {
    return SCHOOL_LEVEL_LABELS[level] ?? level;
}
