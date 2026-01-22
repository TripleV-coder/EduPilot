import { useState, useEffect, useCallback } from "react";
import { MedicalRecord } from "@/lib/types/medical";
import { toast } from "sonner";

export function useMedicalRecords(studentId?: string) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = studentId ? `?studentId=${studentId}` : "";
      const response = await fetch(`/api/medical-records${params}`);
      if (!response.ok) throw new Error("Erreur");
      const data = await response.json();
      setRecords(data);
    } catch (_err) {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  return { records, loading, fetchRecords };
}
