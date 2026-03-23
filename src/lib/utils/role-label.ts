const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: "Super administrateur",
    SCHOOL_ADMIN: "Administrateur établissement",
    DIRECTOR: "Direction",
    TEACHER: "Enseignant",
    STUDENT: "Élève",
    PARENT: "Parent",
    ACCOUNTANT: "Comptable",
    SECRETARY: "Secrétaire",
    SECRETAIRE: "Secrétaire",
    SYSTEM: "Système",
    USER: "Utilisateur",
};

export function formatUserRoleLabel(role?: string | null): string {
    const normalized = String(role || "").trim();
    if (!normalized) return ROLE_LABELS.USER;
    if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];

    const sentence = normalized.replace(/[_-]+/g, " ").toLowerCase();
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
