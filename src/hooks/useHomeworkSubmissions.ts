"use client";

import { useApiQuery } from "./use-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  content?: string | null;
  fileUrl?: string | null;
  submittedAt: Date;
  grade?: number | null;
  feedback?: string | null;
  gradedAt?: Date | null;
  gradedById?: string | null;
  student: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  homework: {
    id: string;
    title: string;
    maxGrade?: number | null;
  };
  gradedBy?: {
    firstName: string;
    lastName: string;
  } | null;
}

export interface GradeSubmissionInput {
  grade: number;
  feedback?: string;
}

/**
 * Hook to fetch submissions for a homework
 */
export function useHomeworkSubmissions(homeworkId: string | null) {
  return useApiQuery<HomeworkSubmission[]>(
    homeworkId ? `/api/homework/${homeworkId}/submissions` : null,
    ["homework-submissions", homeworkId],
    {
      enabled: !!homeworkId,
    }
  );
}

/**
 * Hook to grade a submission
 */
export function useGradeSubmission(submissionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GradeSubmissionInput) => {
      const response = await fetch(`/api/homework/submissions/${submissionId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la notation");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate submissions queries
      queryClient.invalidateQueries({ queryKey: ["homework-submissions"] });
      // Also invalidate teacher dashboard (pending homework count)
      queryClient.invalidateQueries({ queryKey: ["teacher-dashboard"] });
    },
  });
}

/**
 * Calculate statistics for a list of submissions
 */
export function calculateSubmissionStats(submissions: HomeworkSubmission[]) {
  const total = submissions.length;
  const graded = submissions.filter(s => s.grade !== null && s.grade !== undefined).length;
  const pending = total - graded;

  const grades = submissions
    .filter(s => s.grade !== null && s.grade !== undefined)
    .map(s => s.grade!);

  const average = grades.length > 0
    ? grades.reduce((sum, g) => sum + g, 0) / grades.length
    : 0;

  return {
    total,
    graded,
    pending,
    average: Math.round(average * 10) / 10,
  };
}
