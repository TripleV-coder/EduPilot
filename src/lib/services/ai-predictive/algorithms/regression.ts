/**
 * AI Predictive Service — Regression Algorithms
 * Linear and polynomial regression with R² calculation.
 */

/**
 * Régression linéaire pour prédire la note de la prochaine période
 */
export function linearRegression(dataPoints: { x: number; y: number }[]): {
    slope: number;
    intercept: number;
    predict: (x: number) => number;
} {
    const n = dataPoints.length;
    if (n < 2) {
        return {
            intercept: dataPoints[0]?.y || 0,
            predict: (_x) => dataPoints[0]?.y || 0,
            slope: 0,
        };
    }

    const sumX = dataPoints.reduce((sum, p) => sum + p.x, 0);
    const sumY = dataPoints.reduce((sum, p) => sum + p.y, 0);
    const sumXY = dataPoints.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = dataPoints.reduce((sum, p) => sum + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
        slope,
        intercept,
        predict: (x) => slope * x + intercept,
    };
}

/**
 * Calcule le coefficient de détermination R²
 */
export function calculateR2(
    dataPoints: { x: number; y: number }[],
    predictions: number[]
): number {
    if (dataPoints.length === 0 || predictions.length !== dataPoints.length) {
        return 0;
    }

    const meanY = dataPoints.reduce((sum, p) => sum + p.y, 0) / dataPoints.length;

    const ssTotal = dataPoints.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
    const ssRes = dataPoints.reduce(
        (sum, p, i) => sum + Math.pow(p.y - predictions[i], 2),
        0
    );

    if (ssTotal === 0) {
        return ssRes === 0 ? 1 : 0;
    }

    return 1 - ssRes / ssTotal;
}

/**
 * Régression polynomiale (degré 2) pour tendances non-linéaires
 */
export function polynomialRegression(dataPoints: { x: number; y: number }[]): {
    coefficients: number[];
    predict: (x: number) => number;
} {
    const n = dataPoints.length;
    if (n < 3) {
        // Fallback vers régression linéaire
        const linear = linearRegression(dataPoints);
        return {
            coefficients: [linear.intercept, linear.slope, 0],
            predict: linear.predict,
        };
    }

    // Matrices pour résolution des équations normales
    // y = a + bx + cx²
    let sumX = 0, sumY = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumXY = 0, sumX2Y = 0;

    for (const p of dataPoints) {
        sumX += p.x;
        sumY += p.y;
        sumX2 += p.x * p.x;
        sumX3 += p.x * p.x * p.x;
        sumX4 += p.x * p.x * p.x * p.x;
        sumXY += p.x * p.y;
        sumX2Y += p.x * p.x * p.y;
    }

    // Résolution du système 3x3 (méthode de Cramer simplifiée)
    const denom = n * (sumX2 * sumX4 - sumX3 * sumX3)
        - sumX * (sumX * sumX4 - sumX2 * sumX3)
        + sumX2 * (sumX * sumX3 - sumX2 * sumX2);

    if (Math.abs(denom) < 1e-10) {
        // Matrice singulière, fallback
        const linear = linearRegression(dataPoints);
        return {
            coefficients: [linear.intercept, linear.slope, 0],
            predict: linear.predict,
        };
    }

    const a = (sumY * (sumX2 * sumX4 - sumX3 * sumX3)
        - sumX * (sumXY * sumX4 - sumX2Y * sumX3)
        + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2)) / denom;

    const b = (n * (sumXY * sumX4 - sumX2Y * sumX3)
        - sumY * (sumX * sumX4 - sumX2 * sumX3)
        + sumX2 * (sumX * sumX2Y - sumXY * sumX2)) / denom;

    const c = (n * (sumX2 * sumX2Y - sumX3 * sumXY)
        - sumX * (sumX * sumX2Y - sumX2 * sumXY)
        + sumY * (sumX * sumX3 - sumX2 * sumX2)) / denom;

    return {
        coefficients: [a, b, c],
        predict: (x) => a + b * x + c * x * x,
    };
}

/**
 * Validation croisée pour évaluer la robustesse du modèle
 */
export function crossValidate(
    dataPoints: { x: number; y: number }[],
    folds: number = 5
): number {
    if (dataPoints.length < folds) return 0;

    const foldSize = Math.floor(dataPoints.length / folds);
    let totalR2 = 0;
    let evaluatedFolds = 0;

    for (let i = 0; i < folds; i++) {
        const testStart = i * foldSize;
        const testEnd = (i + 1) * foldSize;

        const trainData = [
            ...dataPoints.slice(0, testStart),
            ...dataPoints.slice(testEnd),
        ];
        const testData = dataPoints.slice(testStart, testEnd);

        if (trainData.length < 2 || testData.length === 0) continue;

        const model = linearRegression(trainData);
        const predictions = testData.map(p => model.predict(p.x));
        const r2 = calculateR2(testData, predictions);

        totalR2 += r2;
        evaluatedFolds++;
    }

    return evaluatedFolds > 0 ? totalR2 / evaluatedFolds : 0;
}
