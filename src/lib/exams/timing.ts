/**
 * Durée d'un examen en ligne, contrôlée côté serveur (TD-023).
 *
 * L'heure de départ est celle de la session créée par POST /api/exams/[id]/start ;
 * le minuteur de la page n'est qu'un affichage. Une soumission arrivée après
 * l'échéance + la marge est refusée : la marge absorbe la soumission automatique
 * à 0 s et la latence réseau, pas un dépassement volontaire.
 */

/** Marge accordée après l'échéance, en secondes. */
export const EXAM_SUBMIT_GRACE_SECONDS = 60;

/** Échéance de l'examen : départ + durée (minutes). */
export function examDeadline(startedAt: Date, durationMinutes: number): Date {
    return new Date(startedAt.getTime() + Math.max(0, durationMinutes) * 60_000);
}

/** Vrai si une soumission faite à `now` dépasse l'échéance et la marge. */
export function isSubmissionTooLate(startedAt: Date, durationMinutes: number, now: Date = new Date()): boolean {
    const limit = examDeadline(startedAt, durationMinutes).getTime() + EXAM_SUBMIT_GRACE_SECONDS * 1000;
    return now.getTime() > limit;
}

/** Secondes écoulées depuis le départ (jamais négatif). */
export function elapsedSeconds(startedAt: Date, now: Date = new Date()): number {
    return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
}

export const EXAM_TIME_EXPIRED_ERROR = {
    error: "Temps écoulé : la durée de l'examen est dépassée, la soumission n'est plus acceptée.",
    code: "EXAM_TIME_EXPIRED",
} as const;
