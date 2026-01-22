/**
 * Hook personnalisé pour gérer les prédictions IA des classes
 */

import { useState, useEffect, useCallback } from "react";
import { ClassPrediction } from "@/lib/types/ai-predictions";
import { toast } from "sonner";

interface UseClassPredictionsOptions {
  classId: string | null;
  autoFetch?: boolean;
}

interface UseClassPredictionsReturn {
  predictions: ClassPrediction | null;
  loading: boolean;
  error: string | null;
  fetchPredictions: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useClassPredictions({
  classId,
  autoFetch = true,
}: UseClassPredictionsOptions): UseClassPredictionsReturn {
  const [predictions, setPredictions] = useState<ClassPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async () => {
    if (!classId) {
      setError("ID classe requis");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ai/predictions/class?classId=${classId}`,
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

      const data: ClassPrediction = await response.json();
      setPredictions(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  const refresh = useCallback(async () => {
    if (!classId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/predictions/class", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération des prédictions");
      }

      const data: ClassPrediction = await response.json();
      setPredictions(data);
      toast.success("Prédictions de classe générées avec succès");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur inconnue";
      setError(errorMessage);
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (autoFetch && classId) {
      fetchPredictions();
    }
  }, [classId, autoFetch, fetchPredictions]);

  return {
    predictions,
    loading,
    error,
    fetchPredictions,
    refresh,
  };
}
