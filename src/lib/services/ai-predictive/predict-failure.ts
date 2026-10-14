/**
 * AI Predictive Service — Failure Risk Prediction
 * Predicts student failure risk using a multi-factor scoring model.
 */

import prisma from "@/lib/prisma";
import { type CausalFactor } from "./types";
import { getSchoolParametersForStudent } from "@/lib/schools/school-parameters-store";
import { passingGradeForStudent } from "@/lib/academic/grading-settings";
import { linearRegression } from "./algorithms/regression";

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
    // Paramètres de l'école : fenêtres d'observation, seuils, poids, niveaux
    const params = await getSchoolParametersForStudent(studentId);
    const passingGrade = await passingGradeForStudent(studentId);
    const A = params.analysis;
    const F = params.followUp;
    const W = {
        academicPerformance: A.failureWeightResults / 100,
        attendance: A.failureWeightAttendance / 100,
        behavior: A.failureWeightBehavior / 100,
        homework: A.failureWeightHomework / 100,
        weakSubjects: A.failureWeightWeakSubjects / 100,
    };
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Récupérer les données historiques
    const [studentAnalytics, attendances, incidents, homeworks] = await Promise.all([
        // Analytics des 3 dernières périodes AYANT une moyenne : une période pas
        // encore évaluée n'est pas une moyenne de 0 (sinon « moyenne critique » à tort)
        prisma.studentAnalytics.findMany({
            where: { studentId, generalAverage: { not: null } },
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
                    gte: daysAgo(A.attendanceWindowDays),
                },
            },
        }),

        // Incidents comportementaux
        prisma.behaviorIncident.findMany({
            where: {
                studentId,
                date: {
                    gte: daysAgo(A.behaviorWindowDays),
                },
            },
        }),

        // Devoirs rendus
        prisma.homeworkSubmission.findMany({
            where: {
                studentId,
                createdAt: {
                    gte: daysAgo(A.attendanceWindowDays),
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
        const grades = studentAnalytics.map(sa => Number(sa.generalAverage));
        const latestAvg = grades[0];

        // Régression sur l'ordre chronologique (du plus ancien au plus récent) :
        // la requête trie par date décroissante.
        const chronological = [...grades].reverse();
        const gradePoints = chronological.map((g, i) => ({ x: i + 1, y: g }));
        const trendModel = linearRegression(gradePoints);
        const trend = trendModel.slope;

        // Score académique basé sur niveau absolu et tendance
        if (latestAvg < F.averageCritical) {
            academicScore = 100;
            factors.push(`Moyenne critique: ${latestAvg.toFixed(2)}/20`);
            recommendations.push("Mise en place urgente d'un soutien scolaire renforcé");
            causalFactors.push({
                factor: "moyenne_critique",
                weight: W.academicPerformance,
                contribution: 100,
                description: `La moyenne est en dessous du seuil critique de ${F.averageCritical}/20`,
            });
        } else if (latestAvg < passingGrade) {
            academicScore = 70;
            factors.push(`Moyenne insuffisante: ${latestAvg.toFixed(2)}/20`);
            recommendations.push("Soutien scolaire recommandé");
            causalFactors.push({
                factor: "moyenne_insuffisante",
                weight: W.academicPerformance,
                contribution: 70,
                description: `La moyenne est en dessous du seuil de réussite (${passingGrade}/20)`,
            });
        } else if (latestAvg < params.performance.goodFrom) {
            academicScore = 30;
        }

        // Analyse de la tendance
        if (trend < -A.trendDropPoints) {
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
        const latestAvg = Number(studentAnalytics[0].generalAverage);
        if (latestAvg < passingGrade) {
            academicScore = Math.min(100, ((passingGrade - latestAvg) / Math.max(passingGrade, 1)) * 100); // 0-100
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

        if (attendanceRate < F.attendanceCritical) {
            attendanceScore = 100;
            factors.push(`Assiduité critique: ${attendanceRate.toFixed(0)}%`);
            recommendations.push("Convocation urgente des parents pour absentéisme");
            causalFactors.push({
                factor: "assiduite_critique",
                weight: W.attendance,
                contribution: 100,
                description: `Taux de présence de ${attendanceRate.toFixed(0)}% (seuil critique: ${F.attendanceCritical}%)`,
            });
        } else if (attendanceRate < F.attendanceWarning) {
            factors.push(`Assiduité faible: ${attendanceRate.toFixed(0)}%`);
            recommendations.push("Rencontre avec les parents pour améliorer l'assiduité");
            causalFactors.push({
                factor: "assiduite_faible",
                weight: W.attendance,
                contribution: attendanceScore,
                description: `Taux de présence de ${attendanceRate.toFixed(0)}% (recommandé: >${F.attendanceWarning}%)`,
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
            weight: W.behavior,
            contribution: criticalIncidents * 40,
            description: `${criticalIncidents} incident(s) de gravité critique enregistré(s)`,
        });
    } else if (highIncidents > 2) {
        factors.push(`${highIncidents} incidents graves`);
        recommendations.push("Mise en place d'un contrat comportemental");
        causalFactors.push({
            factor: "incidents_graves",
            weight: W.behavior,
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
                gte: daysAgo(A.homeworkWindowDays),
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

        if (submissionRate < A.homeworkCriticalBelow) {
            homeworkScore = 100;
            factors.push(`Très peu de devoirs rendus: ${submissionRate.toFixed(0)}%`);
            recommendations.push("Renforcer le suivi des devoirs à la maison");
            causalFactors.push({
                factor: "devoirs_non_rendus",
                weight: W.homework,
                contribution: 100,
                description: `Seulement ${submissionRate.toFixed(0)}% des devoirs rendus (seuil: ${A.homeworkCriticalBelow}%)`,
            });
        } else if (submissionRate < A.homeworkWarningBelow) {
            factors.push(`Devoirs souvent non rendus: ${submissionRate.toFixed(0)}%`);
            recommendations.push("Encourager à rendre tous les devoirs");
            causalFactors.push({
                factor: "devoirs_irreguliers",
                weight: W.homework,
                contribution: homeworkScore,
                description: `${submissionRate.toFixed(0)}% des devoirs rendus (recommandé: >${A.homeworkWarningBelow}%)`,
            });
        }
    }

    // 5. Analyse des matières faibles (AMÉLIORÉ)
    if (studentAnalytics.length > 0) {
        const weakSubjects = studentAnalytics[0].subjectPerformances.filter(
            (sp) => sp.isWeakness
        );

        weakSubjectsScore = Math.min(100, weakSubjects.length * 20);

        if (weakSubjects.length >= A.weakSubjectsAlert) {
            factors.push(`${weakSubjects.length} matières en difficulté`);
            recommendations.push(
                `Soutien ciblé en: ${weakSubjects.map((s) => s.subject.name).join(", ")}`
            );
            causalFactors.push({
                factor: "matieres_faibles",
                weight: W.weakSubjects,
                contribution: weakSubjectsScore,
                description: `${weakSubjects.length} matières identifiées comme points faibles`,
            });
        } else if (weakSubjects.length > 0) {
            factors.push(`Difficultés dans certaines matières`);
        }
    }

    // CALCUL FINAL - Probabilité pondérée avec causalité explicite
    const probability = Math.min(100, Math.round(
        academicScore * W.academicPerformance * 100 +
        attendanceScore * W.attendance * 100 +
        behaviorScore * W.behavior * 100 +
        homeworkScore * W.homework * 100 +
        weakSubjectsScore * W.weakSubjects * 100
    ) / 100);

    // Déterminer le niveau de risque avec seuils calibrés
    let level: "TRÈS FAIBLE" | "FAIBLE" | "MODÉRÉ" | "ÉLEVÉ" | "TRÈS ÉLEVÉ";
    if (probability >= A.levelVeryHigh) level = "TRÈS ÉLEVÉ";
    else if (probability >= A.levelHigh) level = "ÉLEVÉ";
    else if (probability >= A.levelModerate) level = "MODÉRÉ";
    else if (probability >= A.levelLow) level = "FAIBLE";
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
