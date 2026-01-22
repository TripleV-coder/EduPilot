"use client";

import { useApiQuery, useApiMutation, queryKeys } from "./use-api";
import { toast } from "sonner";

export interface BulletinData {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  classLevel: string;
  academicYear: string;
  term: string;
  issueDate: string;
  
  subjects: Array<{
    name: string;
    coefficient: number;
    grades: number[];
    average: number;
    evaluation?: string;
  }>;
  
  statistics: {
    generalAverage: number;
    classRank: number;
    totalStudents: number;
    attendance: number;
    absences: number;
    discipline: string;
    recommendation?: string;
  };
  
  teacherComments?: string;
  parentComments?: string;
  signatures?: {
    teacher?: boolean;
    principal?: boolean;
    parent?: boolean;
  };
}

export function useStudentBulletins(studentId: string | null) {
  return useApiQuery<any>(
    studentId ? `/api/bulletins?studentId=${studentId}` : null
  );
}

export function useBulletinDetail(bulletinId: string | null) {
  return useApiQuery<any>(
    bulletinId ? `/api/bulletins/${bulletinId}` : null
  );
}

export function useGenerateBulletinPDF() {
  return useApiMutation<any, any>(
    `/api/bulletins/export-pdf`,
    "POST",
    {
      invalidateKeys: [queryKeys.grades],
      onSuccess: (data) => {
        toast.success("Bulletin généré avec succès");
        // Trigger download
        if (data.url) {
          const link = document.createElement("a");
          link.href = data.url;
          link.download = `bulletin-${data.studentName}.pdf`;
          link.click();
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

export function useDownloadBulletin() {
  return useApiMutation<any, any>(
    `/api/bulletins/:id/download`,
    "GET",
    {
      onSuccess: () => {
        toast.success("Bulletin téléchargé");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }
  );
}

// Combined hook for bulletin view page
export function useBulletinData(bulletinId: string | null) {
  const detailQuery = useBulletinDetail(bulletinId);

  const isLoading = detailQuery.isPending;
  const error = detailQuery.error;
  const isError = !!error;

  const data: BulletinData | undefined = detailQuery.data
    ? {
        id: detailQuery.data.id,
        studentId: detailQuery.data.studentId,
        studentName: detailQuery.data.studentName,
        className: detailQuery.data.className,
        classLevel: detailQuery.data.classLevel,
        academicYear: detailQuery.data.academicYear,
        term: detailQuery.data.term,
        issueDate: detailQuery.data.issueDate,
        subjects: detailQuery.data.subjects || [],
        statistics: {
          generalAverage: detailQuery.data.generalAverage || 0,
          classRank: detailQuery.data.classRank || 0,
          totalStudents: detailQuery.data.totalStudents || 0,
          attendance: detailQuery.data.attendance || 0,
          absences: detailQuery.data.absences || 0,
          discipline: detailQuery.data.discipline || "Bon",
          recommendation: detailQuery.data.recommendation,
        },
        teacherComments: detailQuery.data.teacherComments,
        parentComments: detailQuery.data.parentComments,
        signatures: detailQuery.data.signatures,
      }
    : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}

// Hook for listing bulletins
export function useStudentBulletinList(studentId: string | null) {
  const query = useStudentBulletins(studentId);

  const isLoading = query.isPending;
  const error = query.error;
  const isError = !!error;

  const data = query.data?.bulletins || [];

  return {
    bulletins: data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
