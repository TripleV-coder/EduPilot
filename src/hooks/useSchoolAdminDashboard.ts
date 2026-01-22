"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "./use-api";

export interface SchoolAdminDashboardData {
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  school: {
    id: string;
    name: string;
    studentCount: number;
    teacherCount: number;
    classCount: number;
  };
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    averageAttendance: number;
    averageGrade: number;
    incidentsThisMonth: number;
    paymentsOverdue: number;
  };
  topClasses: Array<{
    id: string;
    name: string;
    level: string;
    studentCount: number;
    averageGrade: number;
  }>;
  recentIncidents: Array<{
    id: string;
    studentName: string;
    className: string;
    type: string;
    severity: "low" | "medium" | "high";
    date: string;
  }>;
  pendingPayments: Array<{
    id: string;
    studentName: string;
    className: string;
    amount: number;
    daysOverdue: number;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    date: string;
    participantCount: number;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    user: string;
    timestamp: string;
  }>;
}

function useAdminProfile() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user ? `/api/profile` : null
  );
}

function useSchoolInfo() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/schools/${session.user.schoolId}` : null
  );
}

function useSchoolStats() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/analytics/school/overview?schoolId=${session.user.schoolId}` : null
  );
}

function useSchoolClasses() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/classes?schoolId=${session.user.schoolId}` : null
  );
}

function useSchoolIncidents() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/incidents?schoolId=${session.user.schoolId}` : null
  );
}

function useSchoolPayments() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/payments?schoolId=${session.user.schoolId}&status=pending` : null
  );
}

function useSchoolEvents() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/events?schoolId=${session.user.schoolId}` : null
  );
}

function useAuditLogs() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user?.schoolId ? `/api/audit-logs?schoolId=${session.user.schoolId}&limit=10` : null
  );
}

export function useSchoolAdminDashboard(): {
  data?: SchoolAdminDashboardData;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
} {
  const profileQuery = useAdminProfile();
  const schoolQuery = useSchoolInfo();
  const statsQuery = useSchoolStats();
  const classesQuery = useSchoolClasses();
  const incidentsQuery = useSchoolIncidents();
  const paymentsQuery = useSchoolPayments();
  const eventsQuery = useSchoolEvents();
  const auditQuery = useAuditLogs();

  const isLoading =
    profileQuery.isPending ||
    schoolQuery.isPending ||
    statsQuery.isPending ||
    classesQuery.isPending ||
    incidentsQuery.isPending ||
    paymentsQuery.isPending ||
    eventsQuery.isPending ||
    auditQuery.isPending;

  const error =
    profileQuery.error ||
    schoolQuery.error ||
    statsQuery.error ||
    classesQuery.error ||
    incidentsQuery.error ||
    paymentsQuery.error ||
    eventsQuery.error ||
    auditQuery.error;

  const isError = !!error;

  const data =
    profileQuery.data &&
    schoolQuery.data &&
    statsQuery.data &&
    classesQuery.data &&
    incidentsQuery.data &&
    paymentsQuery.data
      ? {
          admin: {
            id: profileQuery.data.id,
            firstName: profileQuery.data.firstName,
            lastName: profileQuery.data.lastName,
            email: profileQuery.data.email,
            avatar: profileQuery.data.avatar,
          },
          school: {
            id: schoolQuery.data.id,
            name: schoolQuery.data.name,
            studentCount: statsQuery.data.studentCount || 0,
            teacherCount: statsQuery.data.teacherCount || 0,
            classCount: statsQuery.data.classCount || 0,
          },
          stats: {
            totalStudents: statsQuery.data.studentCount || 0,
            totalTeachers: statsQuery.data.teacherCount || 0,
            totalClasses: statsQuery.data.classCount || 0,
            averageAttendance: statsQuery.data.averageAttendance || 0,
            averageGrade: statsQuery.data.averageGrade || 0,
            incidentsThisMonth: incidentsQuery.data.count || 0,
            paymentsOverdue: paymentsQuery.data.count || 0,
          },
          topClasses: classesQuery.data.classes?.slice(0, 5) || [],
          recentIncidents: incidentsQuery.data.incidents?.slice(0, 5) || [],
          pendingPayments: paymentsQuery.data.payments?.slice(0, 5) || [],
          upcomingEvents: eventsQuery.data.events?.slice(0, 5) || [],
          recentActivities: auditQuery.data.logs?.slice(0, 10) || [],
        }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
