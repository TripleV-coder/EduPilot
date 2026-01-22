import { useState, useEffect, useCallback } from 'react';

interface Prediction {
    dropoutRisk: number;
    potentialFailureSubjects: string[];
    predictedAverage: number;
    confidence: number;
}

interface UseStudentRiskResult {
    prediction: Prediction | null;
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

export function useStudentRisk(studentId: string): UseStudentRiskResult {
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRisk = useCallback(async () => {
        if (!studentId) return;

        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/ai/predict-failure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId }),
            });

            if (!res.ok) {
                throw new Error('Erreur lors de la prédiction');
            }

            const data = await res.json();
            setPrediction(data);
        } catch (err: any) {
            setError(err.message || 'Erreur inconnue');
        } finally {
            setLoading(false);
        }
    }, [studentId]);

    useEffect(() => {
        fetchRisk();
    }, [fetchRisk]);

    return { prediction, loading, error, refresh: fetchRisk };
}
