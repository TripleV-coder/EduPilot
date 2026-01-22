"use client";

import { useSession } from "next-auth/react";
import { useApiQuery, useApiMutation, queryKeys, fetchApi } from "./use-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface HomeworkItem {
  id: string;
  title: string;
  description?: string;
  subject: string;
  subjectId: string;
  class: string;
  classId: string;
  createdBy: string;
  createdDate: string;
  dueDate: string;
  maxScore?: number;
  submissions: number;
  totalStudents: number;
  attachments?: string[];
  status: "active" | "closed" | "archived";
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  submittedDate?: string;
  status: "pending" | "submitted" | "graded" | "late";
  score?: number;
  maxScore: number;
  feedback?: string;
  attachments?: string[];
}

// Teacher Homework Hooks

export function useTeacherHomework() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/homework?teacherId=${teacherId}` : null
  );
}

export function useHomeworkDetail(homeworkId: string | null) {
  return useApiQuery<any>(
    homeworkId ? `/api/homework/${homeworkId}` : null
  );
}

export function useHomeworkSubmissions(homeworkId: string | null) {
  return useApiQuery<any>(
    homeworkId ? `/api/homework/${homeworkId}/submissions` : null
  );
}

export function useCreateHomeworkMutation() {
  return useApiMutation<any, any>(
    `/api/homework`,
    "POST",
    {
      invalidateKeys: [queryKeys.homework],
      onSuccess: () => {
        toast.success("Devoir créé avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

export function useUpdateHomeworkMutation() {
  return useApiMutation<any, any>(
    `/api/homework`,
    "PUT",
    {
      invalidateKeys: [queryKeys.homework],
      onSuccess: () => {
        toast.success("Devoir mis à jour avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

export function useDeleteHomeworkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (homeworkId: string) =>
      fetchApi<void>(`/api/homework/${homeworkId}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      toast.success("Devoir supprimé avec succès");
      queryClient.invalidateQueries({ queryKey: queryKeys.homework });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    }
  });
}

export function useGradeSubmissionMutation(homeworkId: string) {
  return useApiMutation<any, any>(
    `/api/homework/${homeworkId}/submissions`,
    "PUT",
    {
      invalidateKeys: [queryKeys.homework],
      onSuccess: () => {
        toast.success("Note ajoutée avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

// Student Homework Hooks

export function useStudentHomework() {
  const { data: session } = useSession();
  const studentId = session?.user?.id;

  return useApiQuery<any>(
    studentId ? `/api/homework?studentId=${studentId}` : null
  );
}

export function useSubmitHomeworkMutation(homeworkId: string) {
  return useApiMutation<any, any>(
    `/api/homework/${homeworkId}/submissions`,
    "POST",
    {
      invalidateKeys: [queryKeys.homework],
      onSuccess: () => {
        toast.success("Devoir soumis avec succès");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

// Combined hooks for pages

export function useTeacherHomeworkManagement() {
  const homeworkQuery = useTeacherHomework();

  const isLoading = homeworkQuery.isPending;
  const error = homeworkQuery.error;
  const isError = !!error;

  const data = {
    homework: homeworkQuery.data?.homework || [],
    pending: homeworkQuery.data?.pending || 0,
    graded: homeworkQuery.data?.graded || 0,
  };

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}

export function useStudentHomeworkView() {
  const homeworkQuery = useStudentHomework();

  const isLoading = homeworkQuery.isPending;
  const error = homeworkQuery.error;
  const isError = !!error;

  const rawHomeworks = homeworkQuery.data?.homeworks || [];

  const homework = rawHomeworks.map((hw: any) => {
    let status = "pending";
    if (hw.mySubmission) {
      if (hw.mySubmission.grade !== null && hw.mySubmission.grade !== undefined) {
        status = "graded";
      } else {
        status = "submitted";
      }
    }

    return {
      ...hw,
      status,
      score: hw.mySubmission?.grade,
      feedback: hw.mySubmission?.feedback,
      attachments: hw.attachments || [], // Homework attachments
      subject: hw.classSubject?.subject?.name || "Matière inconnue",
      description: hw.description,
      maxScore: hw.maxGrade || 20 // Ensure maxScore is mapped
    };
  });

  const pending = homework.filter((h: any) => h.status === "pending").length;
  const submitted = homework.filter((h: any) => h.status === "submitted").length;
  const graded = homework.filter((h: any) => h.status === "graded").length;

  const data = {
    homework,
    pending,
    submitted,
    graded,
  };

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
