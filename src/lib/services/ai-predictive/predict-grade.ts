/**
 * AI Predictive Service — Grade Prediction
 * Predicts next period grade using ensemble learning (linear + polynomial + EMA).
 */

import prisma from "@/lib/prisma";
import { CONFIG } from "./types";
import { linearRegression, calculateR2, polynomialRegression, crossValidate } from "./algorithms/regression";
import { exponentialMovingAverage, detectAnomalies, bootstrapConfidenceInterval, assessDataQuality } from "./algorithms/statistics";

/**
 * Prédit la note moyenne de la prochaine période
 * Version ULTRA-AMÉLIORÉE avec:
 * - Validation stricte des données minimum
 * - Pondération temporelle
 * - Ensemble learning optimisé
 * - Intervalles de confiance corrigés
 */
export async function predictNextPeriodGrade(studentId: string): Promise<{
    predicted: number;
    confidence: number;
    range: { min: number; max: number };
    warning?: string;
    modelUsed: string;
}> {
    // Récupérer l'historique des moyennes
    const gradeHistory = await prisma.gradeHistory.findMany({
        where: {
            studentId,
            subjectId: null, // Moyenne générale
        },
        orderBy: {
            period: {
                sequence: "asc",
            },
        },
        include: {
            period: true,
        },
    });

    // Validation stricte des données minimum
    if (gradeHistory.length < CONFIG.MIN_DATA_POINTS) {
        const lastGrade = gradeHistory.length > 0
            ? Number(gradeHistory[gradeHistory.length - 1].average)
            : 10;
        const _dataQuality = assessDataQuality(gradeHistory.length);

        return {
            predicted: lastGrade,
            confidence: gradeHistory.length === 0 ? 5 : 15 * gradeHistory.length,
            range: {
                min: Math.max(0, lastGrade - 4),
                max: Math.min(20, lastGrade + 4),
            },
            warning: `Données insuffisantes (${gradeHistory.length}/${CONFIG.MIN_DATA_POINTS} minimum). Prédiction peu fiable.`,
            modelUsed: "baseline_last_value",
        };
    }

    // Préparer les données pour la régression
    const dataPoints = gradeHistory.map((gh, index) => ({
        x: index + 1, // Numéro de la période
        y: Number(gh.average),
    }));

    const values = dataPoints.map(p => p.y);

    // Détection d'anomalies (notes aberrantes)
    const anomalies = detectAnomalies(values);
    const cleanDataPoints = dataPoints.filter((_, i) => !anomalies[i]);

    // Utiliser les données nettoyées si suffisantes
    const workingData = cleanDataPoints.length >= 2 ? cleanDataPoints : dataPoints;
    const workingValues = workingData.map((point) => point.y);

    // ENSEMBLE LEARNING: Combiner plusieurs modèles

    // 1. Régression linéaire
    const linearModel = linearRegression(workingData);
    const nextPeriodNumber = gradeHistory.length + 1;
    const linearPrediction = linearModel.predict(nextPeriodNumber);
    const linearPredictions = workingData.map((p) => linearModel.predict(p.x));
    const linearR2 = calculateR2(workingData, linearPredictions);

    // 2. Régression polynomiale (si données suffisantes)
    let polyPrediction = linearPrediction;
    let polyR2 = 0;
    if (workingData.length >= 3) {
        const polyModel = polynomialRegression(workingData);
        polyPrediction = polyModel.predict(nextPeriodNumber);
        const polyPredictions = workingData.map((p) => polyModel.predict(p.x));
        polyR2 = calculateR2(workingData, polyPredictions);
    }

    // 3. Moyenne mobile exponentielle
    const emaValues = exponentialMovingAverage(workingValues);
    const emaPrediction = emaValues[emaValues.length - 1];

    // 4. Dernier point (baseline)
    const lastValue = workingValues[workingValues.length - 1];

    // Ensemble: Moyenne pondérée selon les performances
    const linearWeight = Math.max(0, linearR2);
    const polyWeight = Math.max(0, polyR2);
    const emaWeight = 0.3; // Poids fixe pour EMA
    const lastWeight = 0.2; // Poids fixe pour dernier point

    const totalWeight = linearWeight + polyWeight + emaWeight + lastWeight;

    const rawEnsemblePrediction = (
        linearPrediction * linearWeight +
        polyPrediction * polyWeight +
        emaPrediction * emaWeight +
        lastValue * lastWeight
    ) / totalWeight;
    const ensemblePrediction = Number.isFinite(rawEnsemblePrediction)
        ? rawEnsemblePrediction
        : lastValue;

    // Validation croisée pour évaluer la robustesse
    const rawCvScore = workingData.length >= 5 ? crossValidate(workingData, 5) : linearR2;
    const cvScore = Number.isFinite(rawCvScore) ? rawCvScore : 0;

    // Confiance basée sur la validation croisée
    const confidence = Math.max(0, Math.min(100, cvScore * 100));

    // Intervalle de confiance par bootstrap
    const bootstrapInterval = bootstrapConfidenceInterval(workingValues, 0.95, 1000);

    // Calcul de l'erreur résiduelle moyenne
    const errors = workingData.map((p, i) => Math.abs(p.y - linearPredictions[i]));
    const meanError = errors.reduce((sum, e) => sum + e, 0) / errors.length;

    // Intervalle final CORRIGÉ (sans inversion min/max)
    const errorMargin = Number.isFinite(meanError) && Number.isFinite(bootstrapInterval.standardError)
        ? meanError * 1.5 + bootstrapInterval.standardError
        : 2;
    const range = {
        min: Math.max(0, ensemblePrediction - errorMargin),
        max: Math.min(20, ensemblePrediction + errorMargin),
    };

    // S'assurer que min < max
    if (range.min > range.max) {
        const mid = (range.min + range.max) / 2;
        range.min = Math.max(0, mid - 2);
        range.max = Math.min(20, mid + 2);
    }

    // Déterminer le modèle principal utilisé
    let modelUsed = "ensemble_learning";
    if (polyWeight > linearWeight && polyWeight > emaWeight) {
        modelUsed = "polynomial_regression";
    } else if (linearWeight > emaWeight) {
        modelUsed = "linear_regression";
    } else {
        modelUsed = "exponential_moving_average";
    }

    // Avertissement si confiance faible
    const warning = confidence < CONFIG.MIN_CONFIDENCE_THRESHOLD
        ? `Confiance faible (${confidence.toFixed(0)}%). Les prédictions peuvent être imprécises.`
        : undefined;

    return {
        predicted: Math.max(0, Math.min(20, Math.round(ensemblePrediction * 100) / 100)),
        confidence: Math.round(confidence),
        range: {
            min: Math.round(range.min * 100) / 100,
            max: Math.round(range.max * 100) / 100,
        },
        warning,
        modelUsed,
    };
}
