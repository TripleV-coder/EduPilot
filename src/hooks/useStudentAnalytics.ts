/**
 * Hook pour gérer les analytics d'un élève
 */

import { useState, useEffect, useCallback } from "react";
import { StudentAnalytics } from "@/lib/types/analytics";
import { toast } from "sonner";

interface UseStudentAnalyticsOptions {
  studentId: string | null;
  periodId?: string | null;
  academicYearId?: string | null;
  autoFetch?: boolean;
}

export function useStudentAnalytics({
  studentId,
  periodId,
  academicYearId,
  autoFetch = true,
}: UseStudentAnalyticsOptions) {
  const [analytics, setAnalytics] = useState<StudentAnalytics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!studentId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ studentId });
      if (periodId) params.append("periodId", periodId);
      if (academicYearId) params.append("academicYearId", academicYearId);

      const response = await fetch(`/api/analytics/students?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur de chargement");
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [studentId, periodId, academicYearId]);

  const generateAnalytics = useCallback(async () => {
    if (!studentId || !periodId || !academicYearId) {
      toast.error("Paramètres manquants");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/analytics/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, periodId, academicYearId }),
      });

      if (!response.ok) throw new Error("Erreur de génération");

      const data = await response.json();
      setAnalytics([data]);
      toast.success("Analytics générées");
    } catch (_err) {
      toast.error("Erreur de génération");
    } finally {
      setLoading(false);
    }
  }, [studentId, periodId, academicYearId]);

  useEffect(() => {
    if (autoFetch) fetchAnalytics();
  }, [autoFetch, fetchAnalytics]);

  return { analytics, loading, error, fetchAnalytics, generateAnalytics };
}
