/**
 * AI Predictive Service — Behavior Risk Prediction
 *
 * Modèle de risque comportemental enrichi, aligné sur le modèle d'échec :
 * fréquence pondérée par récence, gravité, tendance mois/mois, facteurs
 * causaux, recommandations, confiance et qualité des données.
 */

import prisma from "@/lib/prisma";
import type { BehaviorRisk, CausalFactor, DataQuality } from "./types";

const DAY = 24 * 60 * 60 * 1000;

// Poids de gravité (contribution par incident selon sa sévérité)
const SEVERITY_WEIGHT: Record<string, number> = {
    CRITICAL: 30,
    HIGH: 15,
    MEDIUM: 6,
    LOW: 2,
};

function recencyWeight(date: Date): number {
    // Décroissance linéaire sur 90 jours : incident du jour = 1, 90j+ = 0.2
    const ageDays = (Date.now() - new Date(date).getTime()) / DAY;
    if (ageDays <= 0) return 1;
    if (ageDays >= 90) return 0.2;
    return 1 - (ageDays / 90) * 0.8;
}

function assessBehaviorDataQuality(sampleSize: number): DataQuality {
    if (sampleSize === 0) return "LOW";
    if (sampleSize < 3) return "MEDIUM";
    return "HIGH";
}

/**
 * Prédit le risque d'incident comportemental.
 */
export async function predictBehaviorRisk(studentId: string): Promise<BehaviorRisk> {
    const incidents = await prisma.behaviorIncident.findMany({
        where: { studentId },
        orderBy: { date: "desc" },
        take: 20,
    });

    if (incidents.length === 0) {
        return {
            probability: 5,
            nextIncidentPrediction: "Aucun comportement à risque détecté",
            causalFactors: [],
            recommendations: ["Continuer le suivi habituel"],
            confidence: 60, // absence d'incident = signal plutôt fiable
            dataQuality: "LOW",
        };
    }

    const causalFactors: CausalFactor[] = [];
    const recommendations: string[] = [];

    const recentIncidents = incidents.filter(
        (i) => new Date(i.date).getTime() > Date.now() - 90 * DAY
    );

    // 1. Score de fréquence pondéré par récence et gravité
    let weightedScore = 0;
    for (const incident of recentIncidents) {
        const severity = SEVERITY_WEIGHT[incident.severity] ?? SEVERITY_WEIGHT.LOW;
        weightedScore += severity * recencyWeight(incident.date);
    }
    weightedScore = Math.min(100, Math.round(weightedScore));

    const criticalCount = recentIncidents.filter((i) => i.severity === "CRITICAL").length;
    const highCount = recentIncidents.filter((i) => i.severity === "HIGH").length;

    if (criticalCount > 0) {
        causalFactors.push({
            factor: "incidents_critiques",
            weight: 0.4,
            contribution: Math.min(100, criticalCount * 30),
            description: `${criticalCount} incident(s) critique(s) sur 90 jours`,
        });
        recommendations.push("Suivi comportemental immédiat avec le conseiller d'éducation");
    } else if (highCount > 0) {
        causalFactors.push({
            factor: "incidents_graves",
            weight: 0.25,
            contribution: Math.min(100, highCount * 15),
            description: `${highCount} incident(s) grave(s) sur 90 jours`,
        });
        recommendations.push("Mise en place d'un contrat comportemental");
    }

    // 2. Tendance mois/mois
    const lastMonth = incidents.filter(
        (i) => new Date(i.date).getTime() > Date.now() - 30 * DAY
    ).length;
    const previousMonth = incidents.filter((i) => {
        const time = new Date(i.date).getTime();
        return time > Date.now() - 60 * DAY && time <= Date.now() - 30 * DAY;
    }).length;

    let trendPenalty = 0;
    if (lastMonth > previousMonth) {
        trendPenalty = Math.min(20, (lastMonth - previousMonth) * 10);
        causalFactors.push({
            factor: "tendance_hausse",
            weight: 0.2,
            contribution: trendPenalty,
            description: `Fréquence en hausse : ${previousMonth} → ${lastMonth} incident(s)/mois`,
        });
        recommendations.push("Identifier les déclencheurs récents et impliquer les parents");
    }

    // 3. Récidive vs premier incident
    if (incidents.length === 1) {
        causalFactors.push({
            factor: "premier_incident",
            weight: 0.05,
            contribution: 5,
            description: "Incident isolé — pas de récurrence observée",
        });
    }

    const probability = Math.min(100, weightedScore + trendPenalty);

    let nextIncidentPrediction: string;
    if (probability >= 70) {
        nextIncidentPrediction = "Risque élevé d'incident dans les 30 prochains jours";
    } else if (probability >= 40) {
        nextIncidentPrediction = "Risque modéré d'incident, surveillance recommandée";
    } else if (probability >= 20) {
        nextIncidentPrediction = "Risque faible, continuer le suivi habituel";
    } else {
        nextIncidentPrediction = "Comportement stable, risque très faible";
    }

    if (recommendations.length === 0) {
        recommendations.push("Poursuivre le suivi habituel de l'élève");
    }

    // Facteurs causaux triés par contribution décroissante
    causalFactors.sort((a, b) => b.contribution - a.contribution);

    // Confiance : plus l'historique est fourni, plus l'estimation est fiable
    const confidence = Math.min(95, 40 + incidents.length * 8);

    return {
        probability,
        nextIncidentPrediction,
        causalFactors,
        recommendations,
        confidence,
        dataQuality: assessBehaviorDataQuality(incidents.length),
    };
}
