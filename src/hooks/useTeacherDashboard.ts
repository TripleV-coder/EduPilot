"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "./use-api";

export interface TeacherDashboardData {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    specialization?: string;
  };
  classes: Array<{
    id: string;
    name: string;
    level: string;
    studentCount: number;
    averageGrade: number;
  }>;
  stats: {
    totalClasses: number;
    totalStudents: number;
    averageClassGrade: number;
    pendingHomework: number;
    upcomingAppointments: number;
  };
  pendingHomework: Array<{
    id: string;
    title: string;
    className: string;
    submittedCount: number;
    totalCount: number;
    dueDate: string;
  }>;
  schedule: Array<{
    id: string;
    subject: string;
    className: string;
    startTime: string;
    endTime: string;
    room: string;
  }>;
  appointments: Array<{
    id: string;
    parentName: string;
    studentName: string;
    dateTime: string;
    status: "pending" | "confirmed" | "completed";
  }>;
  riskStudents?: Array<{
    id: string;
    name: string;
    className: string;
    riskLevel: "low" | "medium" | "high";
    reason: string;
  }>;
}

function useTeacherProfile() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user ? `/api/profile` : null
  );
}

function useTeacherClasses() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/teachers/${teacherId}/classes` : null
  );
}

function useTeacherStats() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/teachers/${teacherId}/stats` : null
  );
}

function useTeacherHomework() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/homework?teacherId=${teacherId}` : null
  );
}

function useTeacherSchedule() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/schedules?teacherId=${teacherId}` : null
  );
}

function useTeacherAppointments() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/appointments?teacherId=${teacherId}` : null
  );
}

function useTeacherRiskStudents() {
  const { data: session } = useSession();
  const teacherId = session?.user?.id;

  return useApiQuery<any>(
    teacherId ? `/api/ai/predictions/class?teacherId=${teacherId}` : null
  );
}

export function useTeacherDashboard(): {
  data?: TeacherDashboardData;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
} {
  const profileQuery = useTeacherProfile();
  const classesQuery = useTeacherClasses();
  const statsQuery = useTeacherStats();
  const homeworkQuery = useTeacherHomework();
  const scheduleQuery = useTeacherSchedule();
  const appointmentsQuery = useTeacherAppointments();
  const riskStudentsQuery = useTeacherRiskStudents();

  const isLoading =
    profileQuery.isPending ||
    classesQuery.isPending ||
    statsQuery.isPending ||
    homeworkQuery.isPending ||
    scheduleQuery.isPending ||
    appointmentsQuery.isPending;

  const error =
    profileQuery.error ||
    classesQuery.error ||
    statsQuery.error ||
    homeworkQuery.error ||
    scheduleQuery.error ||
    appointmentsQuery.error;

  const isError = !!error;

  const data =
    profileQuery.data &&
    classesQuery.data &&
    statsQuery.data &&
    homeworkQuery.data &&
    scheduleQuery.data &&
    appointmentsQuery.data
      ? {
          teacher: {
            id: profileQuery.data.id,
            firstName: profileQuery.data.firstName,
            lastName: profileQuery.data.lastName,
            email: profileQuery.data.email,
            avatar: profileQuery.data.avatar,
            specialization: profileQuery.data.teacherProfile?.specialization,
          },
          classes: classesQuery.data.classes || [],
          stats: {
            totalClasses: statsQuery.data.totalClasses || 0,
            totalStudents: statsQuery.data.totalStudents || 0,
            averageClassGrade: statsQuery.data.averageGrade || 0,
            pendingHomework: homeworkQuery.data.pending || 0,
            upcomingAppointments: appointmentsQuery.data.upcoming || 0,
          },
          pendingHomework: homeworkQuery.data.homework || [],
          schedule: scheduleQuery.data.schedule || [],
          appointments: appointmentsQuery.data.appointments || [],
          riskStudents: riskStudentsQuery.data?.riskStudents,
        }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
