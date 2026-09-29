/**
 * Qui peut déposer quel type de signalement à la cellule d'écoute.
 *
 * La cellule (direction) lit et traite les dossiers ; élèves, parents et
 * personnel les déposent — nominativement ou anonymement. Un rôle ne peut pas
 * se faire passer pour un autre (un élève ne dépose pas « Enseignant »).
 */
export const WELLBEING_TAGS = ["NOMINATIF", "ANONYME", "PARENT", "ENSEIGNANT"] as const;
export type WellbeingTag = (typeof WELLBEING_TAGS)[number];

/** Cellule d'écoute : lit les dossiers et peut saisir tout type de signalement. */
export const WELLBEING_DESK_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] as const;

export function allowedWellbeingTags(role: string): readonly WellbeingTag[] {
    if ((WELLBEING_DESK_ROLES as readonly string[]).includes(role) || role === "NETWORK_ADMIN") return WELLBEING_TAGS;
    if (role === "TEACHER" || role === "STAFF") return ["ENSEIGNANT", "ANONYME"];
    if (role === "PARENT") return ["PARENT", "ANONYME"];
    if (role === "STUDENT") return ["NOMINATIF", "ANONYME"];
    return [];
}
