"use client";

import { useSession } from "next-auth/react";
import { useApiQuery, useApiMutation, queryKeys } from "./use-api";
import { toast } from "sonner";

export interface GradeEntry {
  id: string;
  studentId: string;
  studentName: string;
  evaluationId: string;
  evaluationType: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade?: string;
  date: string;
  notes?: string;
}

export interface EvaluationSession {
  id: string;
  subject: string;
  subjectId: string;
  classId: string;
  className: string;
  evaluationType: string;
  evaluationTypeId: string;
  maxScore: number;
  totalStudents: number;
  gradedStudents: number;
  gradeDate: string;
  status: "draft" | "active" | "closed";
  grades: GradeEntry[];
}

export function useTeacherClasses() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/teachers/${teacherId}/classes` : null
  );
}

export function useClassEvaluations(classId: string | null) {
  return useApiQuery<any>(
    classId ? `/api/evaluations?classId=${classId}` : null
  );
}

export function useEvaluationDetails(evaluationId: string | null) {
  return useApiQuery<any>(
    evaluationId ? `/api/evaluations/${evaluationId}` : null
  );
}

export function useClassGrades(classId: string | null) {
  return useApiQuery<any>(
    classId ? `/api/grades?classId=${classId}` : null
  );
}

// Mutation for creating/updating grades
export function useCreateGradeMutation() {
  return useApiMutation<any, any>(
    `/api/grades`,
    "POST",
    {
      invalidateKeys: [queryKeys.grades],
      onSuccess: () => {
        toast.success("Note enregistrée avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

export function useUpdateGradeMutation() {
  return useApiMutation<any, any>(
    `/api/grades`,
    "PUT",
    {
      invalidateKeys: [queryKeys.grades],
      onSuccess: () => {
        toast.success("Note mise à jour avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

// Bulk grade import
export function useBulkImportGrades() {
  return useApiMutation<any, any>(
    `/api/grades/bulk-import`,
    "POST",
    {
      invalidateKeys: [queryKeys.grades],
      onSuccess: () => {
        toast.success("Notes importées avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

// Comprehensive hook for grades management page
export function useGradesManagement() {
  const classesQuery = useTeacherClasses();

  const isLoading = classesQuery.isPending;
  const error = classesQuery.error;
  const isError = !!error;

  const data = classesQuery.data?.classes || [];

  return {
    classes: data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}

// Hook for single evaluation page
export function useEvaluationGrades(evaluationId: string | null) {
  const detailsQuery = useEvaluationDetails(evaluationId);
  const gradesQuery = useClassGrades(
    evaluationId ? detailsQuery.data?.classId : null
  );

  const isLoading = detailsQuery.isPending || gradesQuery.isPending;
  const error = detailsQuery.error || gradesQuery.error;
  const isError = !!error;

  const data =
    detailsQuery.data && gradesQuery.data
      ? {
          evaluation: {
            id: detailsQuery.data.id,
            subject: detailsQuery.data.subject?.name,
            classId: detailsQuery.data.classId,
            className: detailsQuery.data.class?.name,
            evaluationType: detailsQuery.data.type,
            maxScore: detailsQuery.data.maxScore || 20,
            totalStudents: gradesQuery.data.students?.length || 0,
            gradedStudents: gradesQuery.data.grades?.length || 0,
            gradeDate: detailsQuery.data.date,
            status: detailsQuery.data.status || "active",
          },
          grades: gradesQuery.data.grades || [],
        }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
