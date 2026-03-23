/**
 * AI Predictive Service — Failure Risk Prediction
 * Predicts student failure risk using a multi-factor scoring model.
 */

import prisma from "@/lib/prisma";
import { CONFIG, type CausalFactor } from "./types";
import { linearRegression } from "./algorithms/regression";
import { temporalWeightedAverage } from "./algorithms/statistics";

/**
 * Prédit le risque d'échec d'un élève en utilisant un modèle de scoring AMÉLIORÉ
 * Avec causalité explicite et pondération dynamique
 */
export async function predictFailureRisk(studentId: string): Promise<{
    probability: number;
    level: "TRÈS FAIBLE" | "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" | "TRÈS ÉLEVÉ";
    factors: string[];
    recommendations: string[];
    causalFactors: CausalFactor[];
}> {
    // Récupérer les données historiques
    const [studentAnalytics, attendances, incidents, homeworks] = await Promise.all([
        // Analytics des 3 dernières périodes
        prisma.studentAnalytics.findMany({
            where: { studentId },
            orderBy: { createdAt: "desc" },
            take: 3,
            include: {
                period: true,
                subjectPerformances: {
                    include: { subject: true },
                },
            },
        }),

        // Assiduité des 90 derniers jours
        prisma.attendance.findMany({
            where: {
                studentId,
                date: {
                    gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                },
            },
        }),

        // Incidents comportementaux
        prisma.behaviorIncident.findMany({
            where: {
                studentId,
                date: {
                    gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
                },
            },
        }),

        // Devoirs rendus
        prisma.homeworkSubmission.findMany({
            where: {
                studentId,
                createdAt: {
                    gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                },
            },
            include: { homework: true },
        }),
    ]);

    const causalFactors: CausalFactor[] = [];
    const factors: string[] = [];
    const recommendations: string[] = [];

    // Scores par catégorie (normalisés 0-100)
    let academicScore = 0;
    let attendanceScore = 0;
    let behaviorScore = 0;
    let homeworkScore = 0;
    let weakSubjectsScore = 0;

    // 1. Analyse de la tendance des notes (AMÉLIORÉ avec causalité)
    if (studentAnalytics.length >= 2) {
        const grades = studentAnalytics.map(sa => Number(sa.generalAverage || 0));
        const latestAvg = grades[0];

        // Utiliser moyenne pondérée temporellement
        const _weightedAvg = temporalWeightedAverage(grades.reverse());

        // Calcul de la tendance avec régression
        const gradePoints = grades.map((g, i) => ({ x: i + 1, y: g }));
        const trendModel = linearRegression(gradePoints);
        const trend = trendModel.slope;

        // Score académique basé sur niveau absolu et tendance
        if (latestAvg < 8) {
            academicScore = 100;
            factors.push(`Moyenne critique: ${latestAvg.toFixed(2)}/20`);
            recommendations.push("Mise en place urgente d'un soutien scolaire renforcé");
            causalFactors.push({
                factor: "moyenne_critique",
                weight: CONFIG.RISK_WEIGHTS.academicPerformance,
                contribution: 100,
                description: "La moyenne est en dessous du seuil critique de 8/20",
            });
        } else if (latestAvg < 10) {
            academicScore = 70;
            factors.push(`Moyenne insuffisante: ${latestAvg.toFixed(2)}/20`);
            recommendations.push("Soutien scolaire recommandé");
            causalFactors.push({
                factor: "moyenne_insuffisante",
                weight: CONFIG.RISK_WEIGHTS.academicPerformance,
                contribution: 70,
                description: "La moyenne est en dessous de 10/20",
            });
        } else if (latestAvg < 12) {
            academicScore = 30;
        }

        // Analyse de la tendance
        if (trend < -1) {
            const trendPenalty = Math.min(30, Math.abs(trend) * 15);
            academicScore = Math.min(100, academicScore + trendPenalty);
            factors.push(`Tendance à la baisse: ${trend.toFixed(2)} points/période`);
            recommendations.push("Identifier les causes de la baisse et y remédier rapidement");
            causalFactors.push({
                factor: "tendance_baisse",
                weight: 0.15,
                contribution: trendPenalty,
                description: `La tendance montre une baisse de ${Math.abs(trend).toFixed(2)} points par période`,
            });
        }
    } else if (studentAnalytics.length === 1) {
        const latestAvg = Number(studentAnalytics[0].generalAverage || 10);
        if (latestAvg < 10) {
            academicScore = (10 - latestAvg) * 10; // 0-100 scale
            factors.push(`Données limitées - Moyenne actuelle: ${latestAvg.toFixed(2)}/20`);
        }
    }

    // 2. Analyse de l'assiduité (AMÉLIORÉ)
    if (attendances.length > 0) {
        const presentCount = attendances.filter(
            (a) => a.status === "PRESENT" || a.status === "LATE"
        ).length;
        const attendanceRate = (presentCount / attendances.length) * 100;

        // Score d'assiduité inversé (100% présence = 0 risque)
        attendanceScore = Math.max(0, (100 - attendanceRate) * 1.2);
        attendanceScore = Math.min(100, attendanceScore);

        if (attendanceRate < 70) {
            attendanceScore = 100;
            factors.push(`Assiduité critique: ${attendanceRate.toFixed(0)}%`);
            recommendations.push("Convocation urgente des parents pour absentéisme");
            causalFactors.push({
                factor: "assiduite_critique",
                weight: CONFIG.RISK_WEIGHTS.attendance,
                contribution: 100,
                description: `Taux de présence de ${attendanceRate.toFixed(0)}% (seuil critique: 70%)`,
            });
        } else if (attendanceRate < 85) {
            factors.push(`Assiduité faible: ${attendanceRate.toFixed(0)}%`);
            recommendations.push("Rencontre avec les parents pour améliorer l'assiduité");
            causalFactors.push({
                factor: "assiduite_faible",
                weight: CONFIG.RISK_WEIGHTS.attendance,
                contribution: attendanceScore,
                description: `Taux de présence de ${attendanceRate.toFixed(0)}% (recommandé: >85%)`,
            });
        }
    }

    // 3. Analyse du comportement (AMÉLIORÉ avec pondération par gravité)
    const criticalIncidents = incidents.filter((i) => i.severity === "CRITICAL").length;
    const highIncidents = incidents.filter((i) => i.severity === "HIGH").length;
    const mediumIncidents = incidents.filter((i) => i.severity === "MEDIUM").length;

    // Score comportemental pondéré
    behaviorScore = Math.min(100,
        criticalIncidents * 40 +
        highIncidents * 20 +
        mediumIncidents * 5 +
        incidents.length * 2
    );

    if (criticalIncidents > 0) {
        factors.push(`${criticalIncidents} incident(s) critique(s)`);
        recommendations.push("Suivi comportemental immédiat avec le conseiller d'éducation");
        causalFactors.push({
            factor: "incidents_critiques",
            weight: CONFIG.RISK_WEIGHTS.behavior,
            contribution: criticalIncidents * 40,
            description: `${criticalIncidents} incident(s) de gravité critique enregistré(s)`,
        });
    } else if (highIncidents > 2) {
        factors.push(`${highIncidents} incidents graves`);
        recommendations.push("Mise en place d'un contrat comportemental");
        causalFactors.push({
            factor: "incidents_graves",
            weight: CONFIG.RISK_WEIGHTS.behavior,
            contribution: highIncidents * 20,
            description: `${highIncidents} incidents de gravité haute`,
        });
    } else if (incidents.length > 5) {
        factors.push(`${incidents.length} incidents comportementaux`);
        recommendations.push("Sensibilisation sur le respect des règles");
    }

    // 4. Analyse des devoirs (AMÉLIORÉ)
    const totalHomeworks = await prisma.homework.count({
        where: {
            dueDate: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                lte: new Date(),
            },
            isPublished: true,
            classSubject: {
                class: {
                    enrollments: {
                        some: {
                            studentId,
                            status: "ACTIVE",
                        },
                    },
                },
            },
        },
    });

    if (totalHomeworks > 0) {
        const submissionRate = (homeworks.length / totalHomeworks) * 100;
        homeworkScore = Math.max(0, (100 - submissionRate));

        if (submissionRate < 50) {
            homeworkScore = 100;
            factors.push(`Très peu de devoirs rendus: ${submissionRate.toFixed(0)}%`);
            recommendations.push("Renforcer le suivi des devoirs à la maison");
            causalFactors.push({
                factor: "devoirs_non_rendus",
                weight: CONFIG.RISK_WEIGHTS.homework,
                contribution: 100,
                description: `Seulement ${submissionRate.toFixed(0)}% des devoirs rendus (seuil: 50%)`,
            });
        } else if (submissionRate < 70) {
            factors.push(`Devoirs souvent non rendus: ${submissionRate.toFixed(0)}%`);
            recommendations.push("Encourager à rendre tous les devoirs");
            causalFactors.push({
                factor: "devoirs_irreguliers",
                weight: CONFIG.RISK_WEIGHTS.homework,
                contribution: homeworkScore,
                description: `${submissionRate.toFixed(0)}% des devoirs rendus (recommandé: >70%)`,
            });
        }
    }

    // 5. Analyse des matières faibles (AMÉLIORÉ)
    if (studentAnalytics.length > 0) {
        const weakSubjects = studentAnalytics[0].subjectPerformances.filter(
            (sp) => sp.isWeakness
        );

        weakSubjectsScore = Math.min(100, weakSubjects.length * 20);

        if (weakSubjects.length >= 3) {
            factors.push(`${weakSubjects.length} matières en difficulté`);
            recommendations.push(
                `Soutien ciblé en: ${weakSubjects.map((s) => s.subject.name).join(", ")}`
            );
            causalFactors.push({
                factor: "matieres_faibles",
                weight: CONFIG.RISK_WEIGHTS.weakSubjects,
                contribution: weakSubjectsScore,
                description: `${weakSubjects.length} matières identifiées comme points faibles`,
            });
        } else if (weakSubjects.length > 0) {
            factors.push(`Difficultés dans certaines matières`);
        }
    }

    // CALCUL FINAL - Probabilité pondérée avec causalité explicite
    const probability = Math.min(100, Math.round(
        academicScore * CONFIG.RISK_WEIGHTS.academicPerformance * 100 +
        attendanceScore * CONFIG.RISK_WEIGHTS.attendance * 100 +
        behaviorScore * CONFIG.RISK_WEIGHTS.behavior * 100 +
        homeworkScore * CONFIG.RISK_WEIGHTS.homework * 100 +
        weakSubjectsScore * CONFIG.RISK_WEIGHTS.weakSubjects * 100
    ) / 100);

    // Déterminer le niveau de risque avec seuils calibrés
    let level: "TRÈS FAIBLE" | "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" | "TRÈS ÉLEVÉ";
    if (probability >= 75) level = "TRÈS ÉLEVÉ";
    else if (probability >= 55) level = "ÉLEVÉ";
    else if (probability >= 35) level = "MODÉRÉ";
    else if (probability >= 15) level = "FAIBLE";
    else level = "TRÈS FAIBLE";

    // Ajouter des recommandations générales si aucune spécifique
    if (recommendations.length === 0) {
        recommendations.push("Continuer le suivi régulier de l'élève");
        recommendations.push("Encourager les bonnes pratiques actuelles");
    }

    // Trier les facteurs causaux par contribution
    causalFactors.sort((a, b) => b.contribution - a.contribution);

    return {
        probability,
        level,
        factors,
        recommendations,
        causalFactors,
    };
}
