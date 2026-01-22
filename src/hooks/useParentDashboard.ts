"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "./use-api";
import { useState } from "react";

export interface ParentDashboardData {
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    className: string;
    avatar?: string;
  }>;
  selectedChild: {
    id: string;
    firstName: string;
    lastName: string;
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
  alerts: Array<{
    id: string;
    type: "homework" | "incident" | "payment" | "attendance" | "grade";
    message: string;
    severity: "low" | "medium" | "high";
    timestamp: string;
  }>;
  payments: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    status: "pending" | "paid" | "overdue";
  }>;
  upcomingAppointments: Array<{
    id: string;
    teacherName: string;
    dateTime: string;
    status: "pending" | "confirmed";
  }>;
  homework: Array<{
    id: string;
    subject: string;
    title: string;
    dueDate: string;
    status: "submitted" | "pending";
  }>;
  prediction?: {
    estimatedNextGrade: number;
    confidence: number;
    recommendation: string;
  };
}

function useParentProfile() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user ? `/api/profile` : null
  );
}

function useParentChildren() {
  const { data: session } = useSession();
  const parentId = session?.user?.id;

  return useApiQuery<any>(
    parentId ? `/api/parents/${parentId}/children` : null
  );
}

function useChildStats(childId: string | null) {
  return useApiQuery<any>(
    childId ? `/api/students/${childId}/analytics` : null
  );
}

function useChildGrades(childId: string | null) {
  return useApiQuery<any>(
    childId ? `/api/grades?studentId=${childId}` : null
  );
}

function useChildAttendance(childId: string | null) {
  return useApiQuery<any>(
    childId ? `/api/attendance?studentId=${childId}` : null
  );
}

function useParentPayments(parentId: string | null) {
  return useApiQuery<any>(
    parentId ? `/api/payments?parentId=${parentId}` : null
  );
}

function useParentAppointments(parentId: string | null) {
  return useApiQuery<any>(
    parentId ? `/api/appointments?parentId=${parentId}` : null
  );
}

function useParentAlerts(parentId: string | null) {
  return useApiQuery<any>(
    parentId ? `/api/notifications?parentId=${parentId}&type=alert` : null
  );
}

function useChildPredictions(childId: string | null) {
  return useApiQuery<any>(
    childId ? `/api/ai/predictions/student?studentId=${childId}` : null
  );
}

export function useParentDashboard(): {
  data?: ParentDashboardData;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
} {
  const { data: session } = useSession();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const profileQuery = useParentProfile();
  const childrenQuery = useParentChildren();
  const statsQuery = useChildStats(selectedChildId);
  const gradesQuery = useChildGrades(selectedChildId);
  const attendanceQuery = useChildAttendance(selectedChildId);
  const paymentsQuery = useParentPayments(session?.user?.id || null);
  const appointmentsQuery = useParentAppointments(session?.user?.id || null);
  const alertsQuery = useParentAlerts(session?.user?.id || null);
  const predictionsQuery = useChildPredictions(selectedChildId);

  // Auto-select first child
  const effectiveSelectedChildId = selectedChildId || childrenQuery.data?.children?.[0]?.id || null;

  const isLoading =
    profileQuery.isPending ||
    childrenQuery.isPending ||
    statsQuery.isPending ||
    gradesQuery.isPending ||
    attendanceQuery.isPending ||
    paymentsQuery.isPending ||
    appointmentsQuery.isPending ||
    alertsQuery.isPending;

  const error =
    profileQuery.error ||
    childrenQuery.error ||
    statsQuery.error ||
    gradesQuery.error ||
    attendanceQuery.error ||
    paymentsQuery.error ||
    appointmentsQuery.error ||
    alertsQuery.error;

  const isError = !!error;

  const data =
    profileQuery.data &&
    childrenQuery.data &&
    statsQuery.data &&
    gradesQuery.data &&
    attendanceQuery.data &&
    paymentsQuery.data
      ? {
          parent: {
            id: profileQuery.data.id,
            firstName: profileQuery.data.firstName,
            lastName: profileQuery.data.lastName,
            email: profileQuery.data.email,
            avatar: profileQuery.data.avatar,
          },
          children: childrenQuery.data.children || [],
          selectedChild: {
            id: effectiveSelectedChildId || "",
            firstName: statsQuery.data.firstName || "",
            lastName: statsQuery.data.lastName || "",
            className: statsQuery.data.className || "Non assigné",
            classLevel: statsQuery.data.classLevel || "",
            academicYear: statsQuery.data.academicYear || "",
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
          alerts: alertsQuery.data?.alerts || [],
          payments: paymentsQuery.data.payments || [],
          upcomingAppointments: appointmentsQuery.data.appointments || [],
          homework: gradesQuery.data.homework || [],
          prediction: predictionsQuery.data?.prediction,
        }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
    selectedChildId: effectiveSelectedChildId,
    setSelectedChildId,
  };
}
