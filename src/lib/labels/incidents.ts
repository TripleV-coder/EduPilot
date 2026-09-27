/**
 * Libellés français des incidents de vie scolaire (source unique pour
 * l'affichage ; les listes de saisie peuvent s'y référer).
 */
export const INCIDENT_TYPE_LABELS: Record<string, string> = {
    LATE: "Retard",
    ABSENCE_UNEXCUSED: "Absence injustifiée",
    DISRESPECT: "Manque de respect",
    DISRUPTION: "Perturbation de cours",
    CHEATING: "Tricherie ou fraude",
    BULLYING: "Harcèlement",
    VIOLENCE: "Violence physique ou verbale",
    VANDALISM: "Vandalisme",
    THEFT: "Vol",
    SUBSTANCE: "Substances illicites",
    INAPPROPRIATE_LANGUAGE: "Langage grossier",
    DRESS_CODE: "Tenue non conforme",
    TECHNOLOGY_MISUSE: "Usage interdit du téléphone",
    OTHER: "Autre",
};

export const INCIDENT_SEVERITY_LABELS: Record<string, string> = {
    LOW: "Mineur",
    MEDIUM: "Moyen",
    HIGH: "Majeur",
    CRITICAL: "Critique",
};

export const incidentTypeLabel = (type: string | null | undefined) => (type ? INCIDENT_TYPE_LABELS[type] ?? type : "—");
export const incidentSeverityLabel = (severity: string | null | undefined) =>
    severity ? INCIDENT_SEVERITY_LABELS[severity] ?? severity : "—";
