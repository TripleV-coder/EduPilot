/**
 * AI Predictive Service — Student & Class Prediction Orchestrators
 * High-level functions that combine all prediction modules.
 */

import prisma from "@/lib/prisma";
import type { StudentPrediction, ClassPrediction } from "./types";
import { assessDataQuality } from "./algorithms/statistics";
import { predictFailureRisk } from "./predict-failure";
import { predictNextPeriodGrade } from "./predict-grade";
import { predictBehaviorRisk } from "./predict-behavior";

/**
 * Génère toutes les prédictions pour un élève
 * Version AMÉLIORÉE avec évaluation de la qualité des données
 */
export async function generateStudentPredictions(
    studentId: string
): Promise<StudentPrediction> {
    const [failureRisk, nextGrade, behaviorRisk] = await Promise.all([
        predictFailureRisk(studentId),
        predictNextPeriodGrade(studentId),
        predictBehaviorRisk(studentId),
    ]);

    // Prédiction d'orientation (basée sur les analytics existantes)
    const latestAnalytics = await prisma.studentAnalytics.findFirst({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        include: {
            subjectPerformances: {
                include: { subject: true },
            },
        },
    });

    const orientationFit = {
        series: [] as string[],
        scores: [] as number[],
        reasoning: "Analyse basée sur les performances actuelles",
    };

    if (latestAnalytics) {
        const strengths = latestAnalytics.subjectPerformances.filter(
            (sp) => sp.isStrength
        );

        // Logique améliorée de recommandation avec scores pondérés
        const hasScience = strengths.some((s) =>
            ["mathématiques", "physique", "chimie", "svt", "sciences"].some((kw) =>
                s.subject.name.toLowerCase().includes(kw)
            )
        );
        const hasLiterature = strengths.some((s) =>
            ["français", "philosophie", "histoire", "littérature"].some((kw) =>
                s.subject.name.toLowerCase().includes(kw)
            )
        );
        const hasEconomics = strengths.some((s) =>
            ["économie", "gestion", "comptabilité", "commerce"].some((kw) =>
                s.subject.name.toLowerCase().includes(kw)
            )
        );

        // Calcul des scores basé sur les moyennes des matières
        const sciencePerfs = latestAnalytics.subjectPerformances.filter((sp) =>
            ["mathématiques", "physique", "chimie", "svt", "sciences"].some((kw) =>
                sp.subject.name.toLowerCase().includes(kw)
            )
        );
        const litPerfs = latestAnalytics.subjectPerformances.filter((sp) =>
            ["français", "philosophie", "histoire", "littérature"].some((kw) =>
                sp.subject.name.toLowerCase().includes(kw)
            )
        );

        if (hasScience && sciencePerfs.length > 0) {
            const scienceAvg = sciencePerfs.reduce((sum, sp) => sum + Number(sp.average || 0), 0) / sciencePerfs.length;
            const scienceScore = Math.min(95, Math.round(scienceAvg * 5)); // Score sur 100
            orientationFit.series.push("Série C", "Série D");
            orientationFit.scores.push(scienceScore, scienceScore - 5);
        }
        if (hasLiterature && litPerfs.length > 0) {
            const litAvg = litPerfs.reduce((sum, sp) => sum + Number(sp.average || 0), 0) / litPerfs.length;
            const litScore = Math.min(95, Math.round(litAvg * 5));
            orientationFit.series.push("Série A");
            orientationFit.scores.push(litScore);
        }
        if (hasEconomics) {
            orientationFit.series.push("Série G");
            orientationFit.scores.push(75);
        }

        // Si aucune force détectée, recommander série générale
        if (orientationFit.series.length === 0) {
            orientationFit.series.push("Série A", "Série D");
            orientationFit.scores.push(60, 60);
            orientationFit.reasoning = "Profil polyvalent - plusieurs options possibles";
        }
    }

    // Évaluation de la qualité des données
    const dataPoints = latestAnalytics ? latestAnalytics.subjectPerformances.length : 0;
    const dataQuality = assessDataQuality(dataPoints);

    // Confiance globale (moyenne pondérée)
    const confidence = Math.round(
        nextGrade.confidence * 0.6 +
        (100 - failureRisk.probability) * 0.2 +
        (100 - behaviorRisk.probability) * 0.2
    );

    return {
        studentId,
        predictions: {
            failureRisk: {
                ...failureRisk,
                causalFactors: failureRisk.causalFactors,
            },
            nextPeriodGrade: {
                predicted: nextGrade.predicted,
                confidence: nextGrade.confidence,
                range: nextGrade.range,
                warning: nextGrade.warning,
                modelUsed: nextGrade.modelUsed,
            },
            orientationFit,
            behaviorRisk,
        },
        confidence,
        dataQuality,
        generatedAt: new Date(),
    };
}

/**
 * Génère des prédictions pour toute une classe
 */
export async function generateClassPredictions(
    classId: string
): Promise<ClassPrediction> {
    const enrollments = await prisma.enrollment.findMany({
        where: {
            classId,
            status: "ACTIVE",
        },
        select: {
            studentId: true,
        },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    if (studentIds.length === 0) {
        return {
            classId,
            predictions: {
                averageNextPeriod: 0,
                studentsAtRisk: 0,
                studentsAtRiskIds: [],
                dropoutRisk: 0,
                recommendations: [
                    "Aucun élève actif trouvé pour cette classe",
                ],
            },
        };
    }

    // Prédictions pour tous les élèves
    const predictions = await Promise.all(
        studentIds.map((id) => predictNextPeriodGrade(id))
    );

    const averageNextPeriod =
        predictions.reduce((sum, p) => sum + p.predicted, 0) / predictions.length;

    // Élèves à risque
    const risksAssessments = await Promise.all(
        studentIds.map((id) => predictFailureRisk(id))
    );

    const studentsAtRiskIds = studentIds.filter((id, index) => {
        return risksAssessments[index].probability >= 50; // Risque élevé ou très élevé
    });

    const dropoutRisk =
        (studentsAtRiskIds.length / studentIds.length) * 100;

    const recommendations: string[] = [];
    if (dropoutRisk > 30) {
        recommendations.push(
            "Taux de risque d'échec élevé dans la classe - Intervention urgente nécessaire"
        );
        recommendations.push(
            "Organiser des séances de soutien scolaire renforcées"
        );
    } else if (dropoutRisk > 15) {
        recommendations.push("Surveiller attentivement les élèves à risque");
        recommendations.push("Proposer du tutorat personnalisé");
    } else {
        recommendations.push("Continuer le suivi habituel de la classe");
    }

    if (averageNextPeriod < 10) {
        recommendations.push(
            "Moyenne de classe prédite faible - Revoir les méthodes pédagogiques"
        );
    }

    return {
        classId,
        predictions: {
            averageNextPeriod: Math.round(averageNextPeriod * 100) / 100,
            studentsAtRisk: studentsAtRiskIds.length,
            studentsAtRiskIds,
            dropoutRisk: Math.round(dropoutRisk * 100) / 100,
            recommendations,
        },
    };
}
