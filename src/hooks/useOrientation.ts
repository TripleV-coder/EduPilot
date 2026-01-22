/**
 * Hook pour gérer l'orientation scolaire
 */

import { useState, useEffect, useCallback } from "react";
import { StudentOrientation } from "@/lib/types/orientation";
import { toast } from "sonner";

interface UseOrientationOptions {
  studentId?: string | null;
  academicYearId?: string | null;
  autoFetch?: boolean;
}

export function useOrientation({
  studentId,
  academicYearId,
  autoFetch = true,
}: UseOrientationOptions) {
  const [orientations, setOrientations] = useState<StudentOrientation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrientations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (studentId) params.append("studentId", studentId);
      if (academicYearId) params.append("academicYearId", academicYearId);

      const response = await fetch(`/api/orientation?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur de chargement");
      }

      const data = await response.json();
      setOrientations(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [studentId, academicYearId]);

  const createOrientation = useCallback(
    async (data: { studentId: string; academicYearId: string; classLevelId: string }) => {
      setLoading(true);
      try {
        const response = await fetch("/api/orientation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Erreur de création");
        }

        const newOrientation = await response.json();
        setOrientations((prev) => [newOrientation, ...prev]);
        toast.success("Orientation créée avec succès");
        return newOrientation;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        toast.error(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const validateRecommendation = useCallback(async (orientationId: string, isValidated: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orientation/${orientationId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isValidated }),
      });

      if (!response.ok) throw new Error("Erreur de validation");

      toast.success("Recommandation validée");
      await fetchOrientations();
    } catch (_err) {
      toast.error("Erreur de validation");
    } finally {
      setLoading(false);
    }
  }, [fetchOrientations]);

  useEffect(() => {
    if (autoFetch) {
      fetchOrientations();
    }
  }, [autoFetch, fetchOrientations]);

  return {
    orientations,
    loading,
    error,
    fetchOrientations,
    createOrientation,
    validateRecommendation,
  };
}
