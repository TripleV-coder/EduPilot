/**
 * Prévision de la moyenne générale de la période suivante.
 *
 * Méthode et fiabilité : algorithms/forecast.ts (lissage exponentiel choisi
 * par banc d'essai, fourchette calibrée). L'historique est lu dans l'ordre
 * des dates de période (plusieurs années scolaires se suivent correctement).
 */

import prisma from "@/lib/prisma";
import { CONFIG } from "./types";
import { forecastNextAverage } from "./algorithms/forecast";

export interface NextPeriodGradePrediction {
    /** Moyenne prévue ; null sans aucune moyenne passée (jamais une valeur inventée). */
    predicted: number | null;
    /** Probabilité (%) que la vraie moyenne soit à ±1 point de la prévision. */
    confidence: number;
    /** Fourchette à 95 % (null sans historique). */
    range: { min: number; max: number } | null;
    /** Fourchette à 80 % (null sans historique). */
    range80: { min: number; max: number } | null;
    /** Nombre de moyennes passées utilisées. */
    dataPoints: number;
    warning?: string;
    modelUsed: string;
}

export async function predictNextPeriodGrade(studentId: string): Promise<NextPeriodGradePrediction> {
    const gradeHistory = await prisma.gradeHistory.findMany({
        where: { studentId, subjectId: null }, // moyenne générale
        orderBy: [{ period: { startDate: "asc" } }, { period: { sequence: "asc" } }],
        select: { average: true },
    });
    const history = gradeHistory.map((row) => Number(row.average));
    const forecast = forecastNextAverage(history);

    if (!forecast) {
        return {
            predicted: null,
            confidence: 0,
            range: null,
            range80: null,
            dataPoints: 0,
            warning: "Aucune moyenne enregistrée : pas de prévision possible.",
            modelUsed: "none",
        };
    }

    const warning =
        history.length < CONFIG.MIN_DATA_POINTS
            ? `Historique court (${history.length} période${history.length > 1 ? "s" : ""}) : la fourchette est volontairement large.`
            : forecast.withinOnePoint < CONFIG.MIN_CONFIDENCE_THRESHOLD
              ? `Résultats irréguliers : seulement ${forecast.withinOnePoint} % de chances d'être à ±1 point.`
              : undefined;

    return {
        predicted: forecast.predicted,
        confidence: forecast.withinOnePoint,
        range: forecast.range95,
        range80: forecast.range80,
        dataPoints: history.length,
        warning,
        modelUsed: "exponential_smoothing",
    };
}
