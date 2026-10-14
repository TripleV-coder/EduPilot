/**
 * AI Predictive Service — Student & Class Prediction Orchestrators
 * High-level functions that combine all prediction modules.
 */

import { getSchoolParameters } from "@/lib/schools/school-parameters-store";
import { getPassingGrade } from "@/lib/academic/grading-settings";
import prisma from "@/lib/prisma";
import type { StudentPrediction, ClassPrediction } from "./types";
import { assessDataQuality } from "./algorithms/statistics";
import { predictFailureRisk } from "./predict-failure";
import { predictNextPeriodGrade } from "./predict-grade";
import { predictBehaviorRisk } from "./predict-behavior";
import { predictDropoutRisk } from "./predict-dropout";
import { detectEarlyWarnings } from "./detect-early-warning";
import { computeIndicativeRecommendations } from "@/lib/services/orientation";
import { seriesShortLabel } from "@/lib/benin/series";

/**
 * Génère toutes les prédictions pour un élève
 * Version AMÉLIORÉE avec évaluation de la qualité des données
 */
export async function generateStudentPredictions(
    studentId: string
): Promise<StudentPrediction> {
    const [failureRisk, nextGrade, behaviorRisk, dropoutRisk, earlyWarnings] = await Promise.all([
        predictFailureRisk(studentId),
        predictNextPeriodGrade(studentId),
        predictBehaviorRisk(studentId),
        predictDropoutRisk(studentId),
        detectEarlyWarnings(studentId),
    ]);

    // Orientation : le calcul officiel (moyennes du bulletin, critères de
    // l'école). Sans moyenne dans une discipline déterminante, aucune série
    // n'est proposée — jamais de série « par défaut ».
    const orientationFit = {
        series: [] as string[],
        scores: [] as number[],
        reasoning: "Données insuffisantes : aucune moyenne dans une discipline déterminante.",
    };
    const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, status: "ACTIVE" },
        orderBy: { enrolledAt: "desc" },
        select: { academicYearId: true },
    });
    if (enrollment) {
        const indicative = await computeIndicativeRecommendations(studentId, enrollment.academicYearId);
        if (indicative.recommendations.length > 0) {
            orientationFit.series = indicative.recommendations.map((r) => `Série ${seriesShortLabel(r.series) ?? r.series}`);
            orientationFit.scores = indicative.recommendations.map((r) => r.score);
            orientationFit.reasoning = `Selon les moyennes de l'année et les critères d'orientation de l'établissement${
                indicative.generalAverage !== null ? ` (moyenne ${String(indicative.generalAverage).replace(".", ",")}/20)` : ""
            }. Indicatif : la décision revient au conseil de classe.`;
        }
    }

    // Qualité des données : nombre de matières évaluées (dernière analyse)
    const latestAnalytics = await prisma.studentAnalytics.findFirst({
        where: { studentId, generalAverage: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { subjectPerformances: { select: { id: true } } },
    });
    const dataPoints = latestAnalytics?.subjectPerformances.length ?? 0;
    const dataQuality = assessDataQuality(dataPoints);

    // Confiance = celle de la prévision de note (validation croisée). Avant, elle
    // mélangeait la prévision et le risque de l'élève (plus le risque était
    // faible, plus la « confiance » montait) : deux choses sans rapport.
    const confidence = nextGrade.confidence;

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
                range80: nextGrade.range80,
                dataPoints: nextGrade.dataPoints,
                warning: nextGrade.warning,
                modelUsed: nextGrade.modelUsed,
            },
            orientationFit,
            behaviorRisk,
            dropoutRisk,
            earlyWarnings,
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
                averageNextPeriod: null,
                studentsAtRisk: 0,
                studentsAtRiskIds: [],
                dropoutRisk: 0,
                studentsWithWarnings: 0,
                recommendations: [
                    "Aucun élève actif trouvé pour cette classe",
                ],
            },
        };
    }

    // Une seule passe par élève : note + risque d'échec + décrochage + alertes
    const perStudent = await Promise.all(
        studentIds.map(async (id) => {
            const [grade, failure, dropout, warnings] = await Promise.all([
                predictNextPeriodGrade(id),
                predictFailureRisk(id),
                predictDropoutRisk(id),
                detectEarlyWarnings(id),
            ]);
            return { id, grade, failure, dropout, warnings };
        })
    );

    // Seuls les élèves avec une prévision comptent (pas de 10/20 inventé pour les autres)
    const forecasts = perStudent.flatMap((p) => (p.grade.predicted === null ? [] : [p.grade.predicted]));
    const averageNextPeriod = forecasts.length > 0 ? forecasts.reduce((sum, v) => sum + v, 0) / forecasts.length : null;

    // Paramètres et seuil de réussite de l'école de la classe
    const klass = await prisma.class.findUnique({ where: { id: classId }, select: { schoolId: true } });
    const [params, passingGrade] = await Promise.all([
        getSchoolParameters(klass?.schoolId),
        klass?.schoolId ? getPassingGrade(klass.schoolId) : Promise.resolve(10),
    ]);
    const A = params.analysis;

    // Élève à risque = niveau « élevé » ou « très élevé » de l'école
    const studentsAtRiskIds = perStudent
        .filter((p) => p.failure.probability >= A.levelHigh)
        .map((p) => p.id);

    // Décrochage réel = moyenne du modèle de décrochage sur la classe
    const dropoutRisk =
        perStudent.reduce((sum, p) => sum + p.dropout.probability, 0) / perStudent.length;

    const studentsWithWarnings = perStudent.filter((p) => p.warnings.length > 0).length;

    // Part d'élèves à risque d'échec (pour calibrer les recommandations de classe)
    const riskShare = (studentsAtRiskIds.length / perStudent.length) * 100;

    const recommendations: string[] = [];
    if (riskShare > A.classRiskUrgentShare) {
        recommendations.push(
            "Taux de risque d'échec élevé dans la classe - Intervention urgente nécessaire"
        );
        recommendations.push(
            "Organiser des séances de soutien scolaire renforcées"
        );
    } else if (riskShare > A.classRiskWatchShare) {
        recommendations.push("Surveiller attentivement les élèves à risque");
        recommendations.push("Proposer du tutorat personnalisé");
    } else {
        recommendations.push("Continuer le suivi habituel de la classe");
    }

    if (studentsWithWarnings > 0) {
        recommendations.push(
            `${studentsWithWarnings} élève(s) avec alerte précoce active - Vérifier les signaux`
        );
    }

    if (averageNextPeriod !== null && averageNextPeriod < passingGrade) {
        recommendations.push(
            "Moyenne de classe prédite faible - Revoir les méthodes pédagogiques"
        );
    }

    return {
        classId,
        predictions: {
            averageNextPeriod: averageNextPeriod === null ? null : Math.round(averageNextPeriod * 100) / 100,
            studentsAtRisk: studentsAtRiskIds.length,
            studentsAtRiskIds,
            dropoutRisk: Math.round(dropoutRisk * 100) / 100,
            studentsWithWarnings,
            recommendations,
        },
    };
}
