/**
 * Règles du découpage de l'année : la moyenne annuelle en dépend
 * ((S1 + S2) / 2 en semestres, (T1 + T2 + T3) / 3 en trimestres).
 *
 * Une année ne mélange pas les systèmes, compte exactement 2 semestres ou
 * 3 trimestres, et ses périodes ne se chevauchent pas.
 */
import type { PeriodType } from "@prisma/client";

/** Nombre de périodes imposé par le système (null = système libre). */
export function periodsCountFor(type: PeriodType): number | null {
    if (type === "SEMESTER") return 2;
    if (type === "TRIMESTER") return 3;
    return null;
}

/** Erreur si le nombre de périodes ne correspond pas au système, sinon null. */
export function checkPeriodsCount(type: PeriodType, count: number): string | null {
    const expected = periodsCountFor(type);
    if (expected !== null && count !== expected) {
        return type === "SEMESTER"
            ? "Une année en semestres compte exactement 2 périodes."
            : "Une année en trimestres compte exactement 3 périodes.";
    }
    return null;
}

interface PeriodSlot {
    id?: string;
    type: PeriodType;
    sequence: number;
    startDate: Date;
    endDate: Date;
}

/**
 * Vérifie qu'une période (créée ou modifiée) s'insère dans l'année :
 * même système que les autres, numéro dans la limite du système, dates
 * cohérentes, incluses dans l'année et sans chevauchement.
 */
export function checkPeriodPlan(
    candidate: PeriodSlot,
    others: PeriodSlot[],
    year: { startDate: Date; endDate: Date },
): string | null {
    if (candidate.endDate.getTime() <= candidate.startDate.getTime()) {
        return "La date de fin doit être postérieure à la date de début.";
    }
    if (candidate.startDate < year.startDate || candidate.endDate > year.endDate) {
        return "La période doit être comprise dans l'année scolaire.";
    }
    const siblings = others.filter((p) => p.id === undefined || p.id !== candidate.id);
    if (siblings.some((p) => p.type !== candidate.type)) {
        return "Une année ne mélange pas trimestres et semestres : toutes ses périodes ont le même type.";
    }
    const expected = periodsCountFor(candidate.type);
    if (expected !== null && candidate.sequence > expected) {
        return candidate.type === "SEMESTER"
            ? "Une année en semestres n'a que 2 périodes (numéros 1 et 2)."
            : "Une année en trimestres n'a que 3 périodes (numéros 1 à 3).";
    }
    const overlap = siblings.find(
        (p) => candidate.startDate <= p.endDate && p.startDate <= candidate.endDate,
    );
    if (overlap) return "Cette période chevauche une autre période de l'année.";
    return null;
}
