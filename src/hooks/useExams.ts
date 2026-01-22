import { useState, useEffect, useCallback } from "react";
import { ExamTemplate } from "@/lib/types/exams";
import { toast } from "sonner";

export function useExams(classSubjectId?: string) {
  const [exams, setExams] = useState<ExamTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const params = classSubjectId ? `?classSubjectId=${classSubjectId}` : "";
      const response = await fetch(`/api/exams${params}`);
      if (!response.ok) throw new Error("Erreur de chargement");
      const data = await response.json();
      setExams(data);
    } catch (_err) {
      toast.error("Erreur de chargement des examens");
    } finally {
      setLoading(false);
    }
  }, [classSubjectId]);

  const startExam = useCallback(async (examId: string) => {
    try {
      const response = await fetch(`/api/exams/${examId}/start`, { method: "POST" });
      if (!response.ok) throw new Error("Erreur de démarrage");
      const data = await response.json();
      toast.success("Examen démarré");
      return data;
    } catch (err) {
      toast.error("Erreur de démarrage de l'examen");
      throw err;
    }
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  return { exams, loading, fetchExams, startExam };
}
