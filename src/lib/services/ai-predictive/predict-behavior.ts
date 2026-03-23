/**
 * AI Predictive Service — Behavior Risk Prediction
 * Predicts behavioral incident risk based on history.
 */

import prisma from "@/lib/prisma";

/**
 * Prédit le risque d'incident comportemental
 */
export async function predictBehaviorRisk(studentId: string): Promise<{
    probability: number;
    nextIncidentPrediction: string;
}> {
    const incidents = await prisma.behaviorIncident.findMany({
        where: { studentId },
        orderBy: { date: "desc" },
        take: 10,
    });

    if (incidents.length === 0) {
        return {
            probability: 5, // Risque très faible
            nextIncidentPrediction: "Aucun comportement à risque détecté",
        };
    }

    // Analyse de la fréquence
    const recentIncidents = incidents.filter(
        (i) =>
            new Date(i.date).getTime() > Date.now() - 90 * 24 * 60 * 60 * 1000
    );

    const frequency = recentIncidents.length;
    let probability = Math.min(100, frequency * 15);

    // Analyse de la gravité
    const criticalCount = recentIncidents.filter(
        (i) => i.severity === "CRITICAL"
    ).length;
    const highCount = recentIncidents.filter((i) => i.severity === "HIGH").length;

    probability += criticalCount * 20;
    probability += highCount * 10;

    // Analyse de la tendance
    const lastMonth = incidents.filter(
        (i) =>
            new Date(i.date).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    ).length;
    const previousMonth = incidents.filter(
        (i) => {
            const time = new Date(i.date).getTime();
            return (
                time > Date.now() - 60 * 24 * 60 * 60 * 1000 &&
                time <= Date.now() - 30 * 24 * 60 * 60 * 1000
            );
        }
    ).length;

    if (lastMonth > previousMonth) {
        probability += 15;
    }

    probability = Math.min(100, probability);

    let prediction = "";
    if (probability >= 70) {
        prediction = "Risque élevé d'incident dans les 30 prochains jours";
    } else if (probability >= 40) {
        prediction = "Risque modéré d'incident, surveillance recommandée";
    } else if (probability >= 20) {
        prediction = "Risque faible, continuer le suivi habituel";
    } else {
        prediction = "Comportement stable, risque très faible";
    }

    return {
        probability,
        nextIncidentPrediction: prediction,
    };
}
