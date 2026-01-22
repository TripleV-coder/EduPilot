"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "./use-api";

export interface StudentDashboardData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  enrollment: {
    className: string;
    classLevel: string;
    academicYear: string;
  };
  stats: {
    average: number;
    rank: number;
    totalStudents: number;
    attendance: number;
    trend: {
      value: number;
      isPositive: boolean;
    };
  };
  grades: Array<{
    id: string;
    subjectName: string;
    grade: number;
    coefficient: number;
    color: string;
  }>;
  schedule: Array<{
    id: string;
    subject: string;
    startTime: string;
    endTime: string;
    room: string;
    status: "ongoing" | "upcoming" | "completed";
  }>;
  homework: Array<{
    id: string;
    subject: string;
    title: string;
    dueDate: string;
    priority: "low" | "medium" | "high";
  }>;
  prediction?: {
    estimatedNextGrade: number;
    confidence: number;
    recommendation: string;
  };
}

// Student data fetch
function useStudentProfile() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user ? `/api/profile` : null
  );
}

// Student grades fetch
function useStudentGrades() {
  const { data: session } = useSession();
  const studentId = session?.user?.id;

  return useApiQuery<any>(
    studentId ? `/api/grades?studentId=${studentId}` : null
  );
}

// Student attendance fetch
function useStudentAttendance() {
  const { data: session } = useSession();
  const studentId = session?.user?.id;

  return useApiQuery<any>(
    studentId ? `/api/attendance?studentId=${studentId}` : null
  );
}

// Student homework fetch
function useStudentHomework() {
  const { data: session } = useSession();
  const studentId = session?.user?.id;

  return useApiQuery<any>(
    studentId ? `/api/homework?studentId=${studentId}` : null
  );
}

// Student schedule fetch
function useStudentSchedule() {
  const { data: session } = useSession();
  const studentId = session?.user?.id;

  return useApiQuery<any>(
    studentId ? `/api/schedules?studentId=${studentId}` : null
  );
}

// Student predictions fetch
function useStudentPredictions() {
  const { data: session } = useSession();
  const studentId = session?.user?.id;

  return useApiQuery<any>(
    studentId ? `/api/ai/predictions/student?studentId=${studentId}` : null
  );
}

// Combined hook for dashboard
export function useStudentDashboard(): {
  data?: StudentDashboardData;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
} {
  const profileQuery = useStudentProfile();
  const gradesQuery = useStudentGrades();
  const attendanceQuery = useStudentAttendance();
  const homeworkQuery = useStudentHomework();
  const scheduleQuery = useStudentSchedule();
  const predictionsQuery = useStudentPredictions();

  const isLoading =
    profileQuery.isPending ||
    gradesQuery.isPending ||
    attendanceQuery.isPending ||
    homeworkQuery.isPending ||
    scheduleQuery.isPending ||
    predictionsQuery.isPending;

  const error =
    profileQuery.error ||
    gradesQuery.error ||
    attendanceQuery.error ||
    homeworkQuery.error ||
    scheduleQuery.error ||
    predictionsQuery.error;

  const isError = !!error;

  // Transform and combine data when all queries are ready
  const data =
    profileQuery.data &&
      gradesQuery.data &&
      attendanceQuery.data &&
      homeworkQuery.data &&
      scheduleQuery.data
      ? {
        student: {
          id: profileQuery.data.id,
          firstName: profileQuery.data.firstName,
          lastName: profileQuery.data.lastName,
          email: profileQuery.data.email,
          avatar: profileQuery.data.avatar,
        },
        enrollment: {
          className: profileQuery.data.enrollment?.class?.name || "Non assigné",
          classLevel: profileQuery.data.enrollment?.class?.level?.name || "",
          academicYear: profileQuery.data.enrollment?.academicYear?.name || "",
        },
        stats: {
          average: gradesQuery.data.average || 0,
          rank: gradesQuery.data.rank || 0,
          totalStudents: gradesQuery.data.totalStudents || 0,
          attendance: attendanceQuery.data.percentage || 0,
          trend: {
            value: gradesQuery.data.trend || 0,
            isPositive: (gradesQuery.data.trend || 0) > 0,
          },
        },
        grades: gradesQuery.data.grades || [],
        schedule: scheduleQuery.data.schedule || [],
        homework: homeworkQuery.data.homework || [],
        prediction: predictionsQuery.data?.prediction,
      }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
