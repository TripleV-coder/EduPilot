/**
 * Hook pour gérer les cours LMS
 */

import { useState, useEffect, useCallback } from "react";
import { Course } from "@/lib/types/lms";
import { toast } from "sonner";

interface UseCoursesOptions {
  classSubjectId?: string;
  isPublished?: boolean;
  autoFetch?: boolean;
}

export function useCourses({ classSubjectId, isPublished, autoFetch = true }: UseCoursesOptions = {}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (classSubjectId) params.append("classSubjectId", classSubjectId);
      if (isPublished !== undefined) params.append("isPublished", isPublished.toString());

      const response = await fetch(`/api/courses?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur de chargement");
      }

      const data = await response.json();
      setCourses(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [classSubjectId, isPublished]);

  const enrollCourse = useCallback(async (courseId: string) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Erreur d'inscription");

      toast.success("Inscription réussie");
      await fetchCourses();
    } catch (_err) {
      toast.error("Erreur d'inscription");
    }
  }, [fetchCourses]);

  const unenrollCourse = useCallback(async (courseId: string) => {
    try {
      const response = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erreur de désinscription");

      toast.success("Désinscription réussie");
      await fetchCourses();
    } catch (_err) {
      toast.error("Erreur de désinscription");
    }
  }, [fetchCourses]);

  useEffect(() => {
    if (autoFetch) {
      fetchCourses();
    }
  }, [autoFetch, fetchCourses]);

  return {
    courses,
    loading,
    error,
    fetchCourses,
    enrollCourse,
    unenrollCourse,
  };
}
