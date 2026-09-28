/**
 * Suspension d'un établissement par la plateforme (console root, `School.isActive`).
 *
 * « Suspendu (Accès bloqué) » doit fermer la porte à tous les comptes de
 * l'établissement : à la connexion (`authorize()`) et aux sessions déjà ouvertes
 * (rafraîchissement du jeton). Le super-administrateur n'est jamais bloqué :
 * c'est lui qui réactive.
 */
export const SCHOOL_SUSPENDED_CODE = "school_suspended";

export function isBlockedBySchoolSuspension(user: {
    role: string;
    school?: { isActive: boolean } | null;
}): boolean {
    if (user.role === "SUPER_ADMIN") return false;
    return user.school?.isActive === false;
}
