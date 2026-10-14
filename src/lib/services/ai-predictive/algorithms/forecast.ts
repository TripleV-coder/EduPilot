/**
 * Prévision de la moyenne de la période suivante — méthode choisie par
 * l'expérience, pas par habitude.
 *
 * Choix (banc de 20 000 trajectoires simulées, 5 façons d'évoluer : niveau
 * stable, tendance, dérive progressive, retour vers la moyenne, rupture ; voir
 * docs/VERIFICATION_CALCULS_ET_IA.md) :
 *   - lissage exponentiel, poids 0,6 sur la dernière moyenne : écart moyen
 *     1,08 point, contre 1,16 pour « reprendre la dernière moyenne », 1,30
 *     pour une droite prolongée et 1,55 pour l'ancien mélange de modèles ;
 *   - c'est la méthode la plus sûre dans les 5 situations (aucune ne la
 *     dégrade fortement), là où une droite s'emballe et une moyenne de tout
 *     l'historique rate les évolutions.
 *
 * Fourchette CALIBRÉE : l'écart-type de l'erreur combine un a priori de 1,8
 * point (pesant comme 3 observations) et les erreurs réellement commises sur
 * l'historique de l'élève ; facteur 0,9. Mesuré sur des trajectoires jamais
 * vues au réglage : la fourchette annoncée à 95 % contient la vraie valeur
 * dans 94,4 % des cas (91 à 96 % selon la situation), celle à 80 % dans 82 %.
 *
 * « Confiance » = probabilité que la vraie moyenne soit à ±1 point de la
 * prévision (mesurée : légèrement prudente, jamais optimiste).
 */

export const FORECAST_ALPHA = 0.6;
const PRIOR_SD = 1.8;
const PRIOR_WEIGHT = 3;
const SD_FACTOR = 0.9;
const Z95 = 1.959964;
const Z80 = 1.281552;

export interface Forecast {
    /** Moyenne prévue, ramenée entre 0 et 20. */
    predicted: number;
    /** Fourchette à 95 %. */
    range95: { min: number; max: number };
    /** Fourchette à 80 %. */
    range80: { min: number; max: number };
    /** Écart-type estimé de l'erreur de prévision (points). */
    errorSd: number;
    /** Probabilité (%) que la vraie moyenne soit à ±1 point de la prévision. */
    withinOnePoint: number;
}

const clamp20 = (x: number) => Math.min(20, Math.max(0, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Fonction de répartition de la loi normale centrée réduite (erreur < 1,5e-7). */
export function normalCdf(z: number): number {
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * Prévision à partir des moyennes passées, dans l'ordre chronologique.
 * Aucune moyenne : null (pas de valeur inventée). Une seule : elle-même,
 * avec la fourchette de l'a priori seul (large, honnête).
 */
export function forecastNextAverage(history: number[]): Forecast | null {
    const values = history.filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;

    let level = values[0];
    let squaredErrors = 0;
    for (let i = 1; i < values.length; i++) {
        const error = values[i] - level;
        squaredErrors += error * error;
        level = FORECAST_ALPHA * values[i] + (1 - FORECAST_ALPHA) * level;
    }
    const observed = values.length - 1;
    const variance = (PRIOR_WEIGHT * PRIOR_SD * PRIOR_SD + squaredErrors) / (PRIOR_WEIGHT + observed);
    const errorSd = SD_FACTOR * Math.sqrt(variance);
    const predicted = clamp20(level);

    return {
        predicted: round2(predicted),
        range95: { min: round2(clamp20(predicted - Z95 * errorSd)), max: round2(clamp20(predicted + Z95 * errorSd)) },
        range80: { min: round2(clamp20(predicted - Z80 * errorSd)), max: round2(clamp20(predicted + Z80 * errorSd)) },
        errorSd: round2(errorSd),
        withinOnePoint: Math.round((2 * normalCdf(1 / errorSd) - 1) * 100),
    };
}
