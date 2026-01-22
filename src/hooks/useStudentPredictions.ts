/**
 * Hook personnalisé pour gérer les prédictions IA des élèves
 */

import { useState, useEffect, useCallback } from "react";
import { StudentPrediction } from "@/lib/types/ai-predictions";
import { toast } from "sonner";

interface UseStudentPredictionsOptions {
  studentId: string | null;
  autoFetch?: boolean;
}

interface UseStudentPredictionsReturn {
  predictions: StudentPrediction | null;
  loading: boolean;
  error: string | null;
  fetchPredictions: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStudentPredictions({
  studentId,
  autoFetch = true,
}: UseStudentPredictionsOptions): UseStudentPredictionsReturn {
  const [predictions, setPredictions] = useState<StudentPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    if (!studentId) {
      setError("ID élève requis");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // GET method pour récupérer les prédictions
      const response = await fetch(
        `/api/ai/predictions/student?studentId=${studentId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la récupération des prédictions");
      }

      const data: StudentPrediction = await response.json();
      setPredictions(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const refresh = useCallback(async () => {
    if (!studentId) return;

    setLoading(true);
    setError(null);

    try {
      // POST method pour générer de nouvelles prédictions
      const response = await fetch("/api/ai/predictions/student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studentId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération des prédictions");
      }

      const data: StudentPrediction = await response.json();
      setPredictions(data);
      toast.success("Prédictions générées avec succès");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && studentId) {
      fetchPredictions();
    }
  }, [studentId, autoFetch, fetchPredictions]);

  return {
    predictions,
    loading,
    error,
    fetchPredictions,
    refresh,
  };
}
