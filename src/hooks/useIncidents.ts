import { useState, useEffect, useCallback } from "react";
import { BehaviorIncident } from "@/lib/types/incidents";
import { toast } from "sonner";

export function useIncidents(studentId?: string) {
  const [incidents, setIncidents] = useState<BehaviorIncident[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = studentId ? `?studentId=${studentId}` : "";
      const response = await fetch(`/api/incidents${params}`);
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setIncidents(data.incidents || data);
    } catch (_err) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  return { incidents, loading, fetchIncidents };
}
