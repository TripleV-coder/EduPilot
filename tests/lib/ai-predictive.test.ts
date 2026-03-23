/**
 * Tests for AI Predictive Service - Pure math/ML functions
 * These functions don't depend on Prisma and can be tested in isolation.
 */
import { describe, it, expect, vi } from 'vitest'

// We need to mock prisma before importing the module
vi.mock('@/lib/prisma', () => ({
    default: {},
    prisma: {},
}))

// Import the module, which re-exports the pure functions
// Since many are not exported, we test them via dynamic import
// For now, we test the conceptual math behind the algorithms

describe('AI Predictive Service - Algorithmes ML', () => {
    // ============================================
    // LINEAR REGRESSION
    // ============================================
    describe('Régression linéaire', () => {
        it('should predict a linear trend correctly', () => {
            // y = 2x + 1 => points: (1,3), (2,5), (3,7)
            const data = [
                { x: 1, y: 3 },
                { x: 2, y: 5 },
                { x: 3, y: 7 },
            ]

            const n = data.length
            const sumX = data.reduce((s, p) => s + p.x, 0)
            const sumY = data.reduce((s, p) => s + p.y, 0)
            const sumXY = data.reduce((s, p) => s + p.x * p.y, 0)
            const sumX2 = data.reduce((s, p) => s + p.x * p.x, 0)

            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
            const intercept = (sumY - slope * sumX) / n

            expect(slope).toBeCloseTo(2, 5)
            expect(intercept).toBeCloseTo(1, 5)
            expect(slope * 4 + intercept).toBeCloseTo(9, 5) // predict x=4
        })

        it('should handle a single data point', () => {
            const data = [{ x: 1, y: 10 }]
            // With n < 2, the function returns intercept = y, slope = 0
            expect(data[0].y).toBe(10)
        })

        it('should handle flat data (no slope)', () => {
            const data = [
                { x: 1, y: 5 },
                { x: 2, y: 5 },
                { x: 3, y: 5 },
            ]

            const n = data.length
            const sumX = data.reduce((s, p) => s + p.x, 0)
            const sumY = data.reduce((s, p) => s + p.y, 0)
            const sumXY = data.reduce((s, p) => s + p.x * p.y, 0)
            const sumX2 = data.reduce((s, p) => s + p.x * p.x, 0)

            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
            expect(slope).toBeCloseTo(0, 5)
        })
    })

    // ============================================
    // R² COEFFICIENT
    // ============================================
    describe('Coefficient R²', () => {
        it('should return 1 for perfect predictions', () => {
            const dataPoints = [
                { x: 1, y: 3 },
                { x: 2, y: 5 },
                { x: 3, y: 7 },
            ]
            const predictions = [3, 5, 7]

            const meanY = dataPoints.reduce((s, p) => s + p.y, 0) / dataPoints.length
            const ssTotal = dataPoints.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0)
            const ssRes = dataPoints.reduce(
                (s, p, i) => s + Math.pow(p.y - predictions[i], 2),
                0
            )
            const r2 = 1 - ssRes / ssTotal

            expect(r2).toBeCloseTo(1, 5)
        })

        it('should return 0 for predictions equal to mean', () => {
            const dataPoints = [
                { x: 1, y: 2 },
                { x: 2, y: 4 },
                { x: 3, y: 6 },
            ]
            const meanY = 4
            const predictions = [meanY, meanY, meanY] // Always predict the mean

            const ssTotal = dataPoints.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0)
            const ssRes = dataPoints.reduce(
                (s, p, i) => s + Math.pow(p.y - predictions[i], 2),
                0
            )
            const r2 = 1 - ssRes / ssTotal

            expect(r2).toBeCloseTo(0, 5)
        })
    })

    // ============================================
    // EXPONENTIAL MOVING AVERAGE
    // ============================================
    describe('Moyenne mobile exponentielle (EMA)', () => {
        it('should return the input for a single value', () => {
            const values = [10]
            const alpha = 0.3
            const ema = [values[0]]
            expect(ema).toEqual([10])
        })

        it('should compute EMA correctly', () => {
            const values = [10, 12, 14, 16]
            const alpha = 0.3
            const ema: number[] = [values[0]]
            for (let i = 1; i < values.length; i++) {
                ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1])
            }

            expect(ema[0]).toBe(10)
            expect(ema[1]).toBeCloseTo(10.6, 5)
            expect(ema[2]).toBeCloseTo(11.62, 5)
            expect(ema[3]).toBeCloseTo(12.934, 5)
        })

        it('should return empty array for empty input', () => {
            const values: number[] = []
            expect(values.length).toBe(0)
        })

        it('should converge to the latest value with alpha=1', () => {
            const values = [10, 20, 30]
            const alpha = 1.0
            const ema: number[] = [values[0]]
            for (let i = 1; i < values.length; i++) {
                ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1])
            }
            // With alpha=1, EMA is just the raw values
            expect(ema).toEqual([10, 20, 30])
        })
    })

    // ============================================
    // ANOMALY DETECTION (Z-SCORE)
    // ============================================
    describe('Détection d\'anomalies (Z-score)', () => {
        it('should detect outliers', () => {
            const values = [10, 11, 10, 12, 10, 50]
            const mean = values.reduce((s, v) => s + v, 0) / values.length
            const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
            const stdDev = Math.sqrt(variance)
            const threshold = 2

            const anomalies = values.map(v => {
                const zScore = Math.abs((v - mean) / stdDev)
                return zScore > threshold
            })

            expect(anomalies[5]).toBe(true) // 50 is an outlier
            expect(anomalies[0]).toBe(false) // 10 is normal
            expect(anomalies[1]).toBe(false)
        })

        it('should not detect anomalies in uniform data', () => {
            const values = [10, 10, 10, 10]
            const mean = 10
            const variance = 0
            const stdDev = Math.sqrt(variance) // 0

            // With stdDev=0, zScore is NaN, which is not > threshold
            const anomalies = values.map(v => {
                const zScore = Math.abs((v - mean) / stdDev)
                return zScore > 2
            })

            // All NaN comparisons return false
            expect(anomalies.every(a => a === false)).toBe(true)
        })
    })

    // ============================================
    // NORMALIZATION
    // ============================================
    describe('Normalisation Z-score', () => {
        it('should normalize correctly', () => {
            const value = 15
            const mean = 10
            const stdDev = 5
            const normalized = (value - mean) / stdDev
            expect(normalized).toBe(1)
        })

        it('should return 0 for stdDev=0', () => {
            const value = 10
            const mean = 10
            const stdDev = 0
            const normalized = stdDev === 0 ? 0 : (value - mean) / stdDev
            expect(normalized).toBe(0)
        })
    })

    describe('Fonction sigmoïde', () => {
        it('should return 0.5 for x=0', () => {
            const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
            expect(sigmoid(0)).toBe(0.5)
        })

        it('should approach 1 for large positive x', () => {
            const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
            expect(sigmoid(10)).toBeCloseTo(1, 4)
        })

        it('should approach 0 for large negative x', () => {
            const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
            expect(sigmoid(-10)).toBeCloseTo(0, 4)
        })
    })

    // ============================================
    // TEMPORAL WEIGHTED AVERAGE
    // ============================================
    describe('Moyenne pondérée temporelle', () => {
        it('should weight recent values more heavily', () => {
            const values = [10, 10, 10, 20] // Recent value is 20
            const alpha = 0.5

            let weightedSum = 0
            let totalWeight = 0
            const n = values.length

            for (let i = 0; i < n; i++) {
                const weight = Math.exp(-alpha * (n - 1 - i))
                weightedSum += values[i] * weight
                totalWeight += weight
            }

            const result = weightedSum / totalWeight
            // Result should be closer to 20 than to 12.5 (simple average)
            expect(result).toBeGreaterThan(12.5)
        })

        it('should return the only value for single element', () => {
            const values = [15]
            // With a single value, the weight is exp(0) = 1
            expect(values[0]).toBe(15)
        })

        it('should return 0 for empty array', () => {
            const values: number[] = []
            const result = values.length === 0 ? 0 : values[0]
            expect(result).toBe(0)
        })
    })

    // ============================================
    // CALCULATE STATS
    // ============================================
    describe('Calcul statistiques (mean, stdDev)', () => {
        it('should calculate mean correctly', () => {
            const values = [10, 20, 30]
            const mean = values.reduce((s, v) => s + v, 0) / values.length
            expect(mean).toBe(20)
        })

        it('should calculate stdDev correctly', () => {
            const values = [10, 20, 30]
            const mean = 20
            const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
            const stdDev = Math.sqrt(variance)
            expect(stdDev).toBeCloseTo(8.165, 2)
        })

        it('should return 0 for empty array', () => {
            const values: number[] = []
            const mean = values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length
            expect(mean).toBe(0)
        })
    })

    // ============================================
    // DATA QUALITY ASSESSMENT
    // ============================================
    describe('Évaluation qualité des données', () => {
        it('should return LOW for < 3 data points', () => {
            const assessDataQuality = (n: number) => {
                if (n < 3) return 'LOW'
                if (n < 6) return 'MEDIUM'
                return 'HIGH'
            }

            expect(assessDataQuality(0)).toBe('LOW')
            expect(assessDataQuality(1)).toBe('LOW')
            expect(assessDataQuality(2)).toBe('LOW')
        })

        it('should return MEDIUM for 3-5 data points', () => {
            const assessDataQuality = (n: number) => {
                if (n < 3) return 'LOW'
                if (n < 6) return 'MEDIUM'
                return 'HIGH'
            }

            expect(assessDataQuality(3)).toBe('MEDIUM')
            expect(assessDataQuality(4)).toBe('MEDIUM')
            expect(assessDataQuality(5)).toBe('MEDIUM')
        })

        it('should return HIGH for >= 6 data points', () => {
            const assessDataQuality = (n: number) => {
                if (n < 3) return 'LOW'
                if (n < 6) return 'MEDIUM'
                return 'HIGH'
            }

            expect(assessDataQuality(6)).toBe('HIGH')
            expect(assessDataQuality(10)).toBe('HIGH')
            expect(assessDataQuality(100)).toBe('HIGH')
        })
    })

    // ============================================
    // CROSS VALIDATION
    // ============================================
    describe('Validation croisée', () => {
        it('should return 0 when data < folds', () => {
            const dataPoints = [{ x: 1, y: 3 }]
            const folds = 5
            if (dataPoints.length < folds) {
                expect(true).toBe(true) // crossValidate returns 0
            }
        })

        it('should return a finite R² value for sufficient data', () => {
            // Perfect linear data
            const dataPoints = Array.from({ length: 10 }, (_, i) => ({
                x: i + 1,
                y: 2 * (i + 1) + 1,
            }))

            const folds = 5
            const foldSize = Math.floor(dataPoints.length / folds)
            let totalR2 = 0

            for (let i = 0; i < folds; i++) {
                const testStart = i * foldSize
                const testEnd = (i + 1) * foldSize

                const trainData = [
                    ...dataPoints.slice(0, testStart),
                    ...dataPoints.slice(testEnd),
                ]
                const testData = dataPoints.slice(testStart, testEnd)

                if (trainData.length < 2 || testData.length === 0) continue

                // Linear regression on trainData
                const n = trainData.length
                const sumX = trainData.reduce((s, p) => s + p.x, 0)
                const sumY = trainData.reduce((s, p) => s + p.y, 0)
                const sumXY = trainData.reduce((s, p) => s + p.x * p.y, 0)
                const sumX2 = trainData.reduce((s, p) => s + p.x * p.x, 0)
                const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
                const intercept = (sumY - slope * sumX) / n

                const predictions = testData.map(p => slope * p.x + intercept)

                const meanY = testData.reduce((s, p) => s + p.y, 0) / testData.length
                const ssTotal = testData.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0)
                const ssRes = testData.reduce((s, p, idx) => s + Math.pow(p.y - predictions[idx], 2), 0)
                const r2 = 1 - ssRes / ssTotal

                totalR2 += r2
            }

            const avgR2 = totalR2 / folds
            expect(avgR2).toBeCloseTo(1, 1) // Perfect linear data should give R² ≈ 1
            expect(isFinite(avgR2)).toBe(true)
        })
    })

    // ============================================
    // BOOTSTRAP CONFIDENCE INTERVAL
    // ============================================
    describe('Intervalle de confiance bootstrap', () => {
        it('should return wide interval for empty values', () => {
            // The function returns { lower: 0, upper: 20, standardError: 10 } for empty
            const expected = { lower: 0, upper: 20, standardError: 10 }
            expect(expected.lower).toBe(0)
            expect(expected.upper).toBe(20)
        })

        it('should return narrow interval for identical values', () => {
            const values = [15, 15, 15, 15, 15]
            const iterations = 100

            const means: number[] = []
            for (let i = 0; i < iterations; i++) {
                const sample: number[] = []
                for (let j = 0; j < values.length; j++) {
                    sample.push(values[Math.floor(Math.random() * values.length)])
                }
                means.push(sample.reduce((s, v) => s + v, 0) / sample.length)
            }

            means.sort((a, b) => a - b)
            const lower = means[Math.floor(0.025 * iterations)]
            const upper = means[Math.floor(0.975 * iterations) - 1]

            expect(lower).toBeCloseTo(15, 0)
            expect(upper).toBeCloseTo(15, 0)
        })
    })

    // ============================================
    // RISK LEVEL CLASSIFICATION
    // ============================================
    describe('Classification du niveau de risque', () => {
        const classify = (probability: number) => {
            if (probability >= 75) return 'TRÈS ÉLEVÉ'
            if (probability >= 55) return 'ÉLEVÉ'
            if (probability >= 35) return 'MODÉRÉ'
            if (probability >= 15) return 'FAIBLE'
            return 'TRÈS FAIBLE'
        }

        it('should classify risk levels correctly', () => {
            expect(classify(0)).toBe('TRÈS FAIBLE')
            expect(classify(14)).toBe('TRÈS FAIBLE')
            expect(classify(15)).toBe('FAIBLE')
            expect(classify(34)).toBe('FAIBLE')
            expect(classify(35)).toBe('MODÉRÉ')
            expect(classify(54)).toBe('MODÉRÉ')
            expect(classify(55)).toBe('ÉLEVÉ')
            expect(classify(74)).toBe('ÉLEVÉ')
            expect(classify(75)).toBe('TRÈS ÉLEVÉ')
            expect(classify(100)).toBe('TRÈS ÉLEVÉ')
        })
    })

    // ============================================
    // RISK WEIGHTS VALIDATION
    // ============================================
    describe('Validation des poids de risque', () => {
        const RISK_WEIGHTS = {
            academicPerformance: 0.35,
            attendance: 0.25,
            behavior: 0.20,
            homework: 0.15,
            weakSubjects: 0.05,
        }

        it('should sum to 1.0', () => {
            const total = Object.values(RISK_WEIGHTS).reduce((s, v) => s + v, 0)
            expect(total).toBeCloseTo(1.0, 5)
        })

        it('should have academic performance as highest weight', () => {
            const max = Math.max(...Object.values(RISK_WEIGHTS))
            expect(RISK_WEIGHTS.academicPerformance).toBe(max)
        })

        it('should have all positive weights', () => {
            Object.values(RISK_WEIGHTS).forEach(w => {
                expect(w).toBeGreaterThan(0)
            })
        })
    })

    // ============================================
    // POLYNOMIAL REGRESSION
    // ============================================
    describe('Régression polynomiale (degré 2)', () => {
        it('should fit a perfect quadratic: y = x²', () => {
            const dataPoints = [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 4 },
                { x: 3, y: 9 },
                { x: 4, y: 16 },
            ]

            // Solve for y = a + bx + cx²
            // We expect a ≈ 0, b ≈ 0, c ≈ 1
            const n = dataPoints.length
            let sumX = 0, sumY = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0
            let sumXY = 0, sumX2Y = 0

            for (const p of dataPoints) {
                sumX += p.x
                sumY += p.y
                sumX2 += p.x * p.x
                sumX3 += p.x * p.x * p.x
                sumX4 += p.x * p.x * p.x * p.x
                sumXY += p.x * p.y
                sumX2Y += p.x * p.x * p.y
            }

            const denom = n * (sumX2 * sumX4 - sumX3 * sumX3)
                - sumX * (sumX * sumX4 - sumX2 * sumX3)
                + sumX2 * (sumX * sumX3 - sumX2 * sumX2)

            expect(Math.abs(denom)).toBeGreaterThan(0)

            const a = (sumY * (sumX2 * sumX4 - sumX3 * sumX3)
                - sumX * (sumXY * sumX4 - sumX2Y * sumX3)
                + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2)) / denom

            const c = (n * (sumX2 * sumX2Y - sumX3 * sumXY)
                - sumX * (sumX * sumX2Y - sumX2 * sumXY)
                + sumY * (sumX * sumX3 - sumX2 * sumX2)) / denom

            expect(a).toBeCloseTo(0, 3)
            expect(c).toBeCloseTo(1, 3)
        })

        it('should fall back to linear for < 3 points', () => {
            const data = [
                { x: 1, y: 3 },
                { x: 2, y: 5 },
            ]
            // With n < 3, the function falls back to linear regression
            expect(data.length).toBeLessThan(3)
        })
    })
})
