/**
 * Configuration Bénin - Matières Standards et Coefficients
 * Tout est configurable par école via les paramètres système
 */

// Matières Standard Primaire (CI - CM2) - Tous coefficients = 1 au primaire
export const primarySubjects = [
    { code: "FRA", name: "Français", category: "FONDAMENTAL", defaultCoefficient: 1, description: "Lecture, Écriture, Vocabulaire, Grammaire, Orthographe" },
    { code: "MAT", name: "Mathématiques", category: "FONDAMENTAL", defaultCoefficient: 1, description: "Numération, Calcul, Géométrie, Mesures" },
    { code: "SDM", name: "Sciences et Découverte du Monde", category: "EVEIL", defaultCoefficient: 1, description: "Corps humain, Animaux, Plantes, Environnement" },
    { code: "ECM", name: "Éducation Civique et Morale", category: "EVEIL", defaultCoefficient: 1, description: "Citoyenneté, Droits, Devoirs" },
    { code: "EPS", name: "Éducation Physique et Sportive", category: "PRATIQUE", defaultCoefficient: 1, description: "Sport, Activités motrices" },
    { code: "EAR", name: "Éducation Artistique", category: "PRATIQUE", defaultCoefficient: 1, description: "Dessin, Musique, Arts plastiques" },
    { code: "HGE", name: "Histoire-Géographie", category: "EVEIL", defaultCoefficient: 1, description: "Histoire du Bénin, Géographie" },
];

// Matières BEPC avec coefficients
export const bepcSubjects = [
    { code: "FRA", name: "Français", defaultCoefficient: 2, isPractical: false },
    { code: "MAT", name: "Mathématiques", defaultCoefficient: 3, isPractical: false },
    { code: "ANG", name: "Anglais", defaultCoefficient: 2, isPractical: false },
    { code: "SVT", name: "SVT", defaultCoefficient: 2, isPractical: false },
    { code: "PCT", name: "Physique-Chimie", defaultCoefficient: 2, isPractical: false },
    { code: "HGE", name: "Histoire-Géographie", defaultCoefficient: 2, isPractical: false },
    { code: "EPS", name: "Éducation Physique", defaultCoefficient: 1, isPractical: true },
];

// Matières CEP avec coefficients
export const cepSubjects = [
    { code: "FRA", name: "Français", defaultCoefficient: 3, isPractical: false },
    { code: "MAT", name: "Mathématiques", defaultCoefficient: 3, isPractical: false },
    { code: "SDM", name: "Sciences", defaultCoefficient: 2, isPractical: false },
    { code: "EPS", name: "Éducation Physique", defaultCoefficient: 1, isPractical: true },
    { code: "EAR", name: "Éducation Artistique", defaultCoefficient: 1, isPractical: true },
];

// Matières Standard Collège (6ème - 3ème) - Réforme 2021
export const collegeSubjects = [
    { code: "FRA", name: "Français", category: "LITTERAIRE", defaultCoefficient: 2, description: "Langue, Littérature, Expression" },
    { code: "MAT", name: "Mathématiques", category: "SCIENTIFIQUE", defaultCoefficient: 3, description: "Algèbre, Géométrie, Statistiques" },
    { code: "ANG", name: "Anglais", category: "LANGUE", defaultCoefficient: 2, description: "Langue vivante 1" },
    { code: "SVT", name: "Sciences de la Vie et de la Terre", category: "SCIENTIFIQUE", defaultCoefficient: 2, description: "Biologie, Géologie" },
    { code: "PCT", name: "Physique-Chimie-Technologie", category: "SCIENTIFIQUE", defaultCoefficient: 2, description: "Sciences physiques" },
    { code: "HGE", name: "Histoire-Géographie", category: "LITTERAIRE", defaultCoefficient: 2, description: "Histoire, Géographie, EMC" },
    { code: "EPS", name: "Éducation Physique et Sportive", category: "PRATIQUE", defaultCoefficient: 1, description: "Sport" },
    { code: "ESP", name: "Espagnol", category: "LANGUE", defaultCoefficient: 2, description: "Langue vivante 2 (option)" },
    { code: "ALL", name: "Allemand", category: "LANGUE", defaultCoefficient: 2, description: "Langue vivante 2 (option)" },
];

// Système de Mentions Béninoises (configurable)
export const gradeMentions = [
    { code: "ECHEC", label: "Échec", minScore: 0, maxScore: 9.99, color: "#EF4444" },
    { code: "PASSABLE", label: "Passable", minScore: 10, maxScore: 11.99, color: "#F59E0B" },
    { code: "ASSEZ_BIEN", label: "Assez Bien", minScore: 12, maxScore: 13.99, color: "#84CC16" },
    { code: "BIEN", label: "Bien", minScore: 14, maxScore: 15.99, color: "#22C55E" },
    { code: "TRES_BIEN", label: "Très Bien", minScore: 16, maxScore: 17.99, color: "#3B82F6" },
    { code: "EXCELLENT", label: "Excellent", minScore: 18, maxScore: 20, color: "#8B5CF6" },
];

// Mention d'une moyenne, en tranches semi-ouvertes [min ; min suivant[ :
// aucune moyenne entre 9,99 et 10 (ou 11,99 et 12…) ne reste sans mention.
export function getMention(average: number): typeof gradeMentions[0] | null {
    if (!Number.isFinite(average) || average < 0 || average > 20) return null;
    return [...gradeMentions].reverse().find((m) => average >= m.minScore) ?? null;
}

// Matières BAC (Exemple Série D - Très courante au Bénin)
export const bacSubjects = [
    { code: "FRA", name: "Français", defaultCoefficient: 2, isPractical: false },
    { code: "MAT", name: "Mathématiques", defaultCoefficient: 4, isPractical: false },
    { code: "SVT", name: "SVT", defaultCoefficient: 5, isPractical: false },
    { code: "PCT", name: "Physique-Chimie", defaultCoefficient: 4, isPractical: false },
    { code: "ANG", name: "Anglais", defaultCoefficient: 2, isPractical: false },
    { code: "HGE", name: "Histoire-Géographie", defaultCoefficient: 2, isPractical: false },
    { code: "PHI", name: "Philosophie", defaultCoefficient: 2, isPractical: false },
    { code: "EPS", name: "Éducation Physique", defaultCoefficient: 1, isPractical: true },
];

// Configuration par niveau scolaire
export const levelConfig = {
    PRIMARY: {
        levels: ["CI", "CP", "CE1", "CE2", "CM1", "CM2"],
        subjects: primarySubjects,
        finalExam: "CEP",
    },
    COLLEGE: {
        levels: ["6EME", "5EME", "4EME", "3EME"],
        subjects: collegeSubjects,
        finalExam: "BEPC",
    },
    SECONDARY_LYCEE: {
        levels: ["2NDE", "1ERE", "TLE"],
        subjects: bacSubjects,
        finalExam: "BAC",
    },
};
