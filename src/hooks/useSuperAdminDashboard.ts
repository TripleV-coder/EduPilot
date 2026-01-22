"use client";

import { useSession } from "next-auth/react";
import { useApiQuery } from "./use-api";

export interface SuperAdminDashboardData {
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  stats: {
    totalSchools: number;
    totalStudents: number;
    totalTeachers: number;
    activeSchools: number;
    totalRevenue: number;
    systemHealth: number;
  };
  schools: Array<{
    id: string;
    name: string;
    studentCount: number;
    teacherCount: number;
    averageGrade: number;
    status: "active" | "inactive";
    createdAt: string;
  }>;
  systemAlerts: Array<{
    id: string;
    type: "error" | "warning" | "info";
    message: string;
    severity: "low" | "medium" | "high";
    timestamp: string;
  }>;
  recentLogins: Array<{
    id: string;
    userName: string;
    school: string;
    role: string;
    timestamp: string;
  }>;
  backupStatus: Array<{
    id: string;
    school: string;
    lastBackup: string;
    status: "success" | "failed" | "pending";
    size: string;
  }>;
  userStats: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    superAdmins: number;
    schoolAdmins: number;
    teachers: number;
    students: number;
    parents: number;
  };
}

function useSuperAdminProfile() {
  const { data: session } = useSession();

  return useApiQuery<any>(
    session?.user ? `/api/profile` : null
  );
}

function useSystemStats() {
  return useApiQuery<any>(`/api/admin/system/info`);
}

function useAllSchools() {
  return useApiQuery<any>(`/api/schools?limit=100`);
}

function useSystemAlerts() {
  return useApiQuery<any>(`/api/audit-logs?type=error&limit=10`);
}

function useRecentLogins() {
  return useApiQuery<any>(`/api/audit-logs?type=login&limit=20`);
}

function useBackupStatus() {
  return useApiQuery<any>(`/api/system/backup?status=true`);
}

export function useSuperAdminDashboard(): {
  data?: SuperAdminDashboardData;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
} {
  const profileQuery = useSuperAdminProfile();
  const systemQuery = useSystemStats();
  const schoolsQuery = useAllSchools();
  const alertsQuery = useSystemAlerts();
  const loginsQuery = useRecentLogins();
  const backupQuery = useBackupStatus();

  const isLoading =
    profileQuery.isPending ||
    systemQuery.isPending ||
    schoolsQuery.isPending ||
    alertsQuery.isPending ||
    loginsQuery.isPending ||
    backupQuery.isPending;

  const error =
    profileQuery.error ||
    systemQuery.error ||
    schoolsQuery.error ||
    alertsQuery.error ||
    loginsQuery.error ||
    backupQuery.error;

  const isError = !!error;

  const data =
    profileQuery.data &&
    systemQuery.data &&
    schoolsQuery.data &&
    alertsQuery.data
      ? {
          admin: {
            id: profileQuery.data.id,
            firstName: profileQuery.data.firstName,
            lastName: profileQuery.data.lastName,
            email: profileQuery.data.email,
            avatar: profileQuery.data.avatar,
          },
          stats: {
            totalSchools: systemQuery.data.totalSchools || 0,
            totalStudents: systemQuery.data.totalStudents || 0,
            totalTeachers: systemQuery.data.totalTeachers || 0,
            activeSchools: systemQuery.data.activeSchools || 0,
            totalRevenue: systemQuery.data.totalRevenue || 0,
            systemHealth: systemQuery.data.healthScore || 100,
          },
          schools: schoolsQuery.data.schools || [],
          systemAlerts: alertsQuery.data.logs || [],
          recentLogins: loginsQuery.data.logs || [],
          backupStatus: backupQuery.data.backups || [],
          userStats: {
            totalUsers: systemQuery.data.totalUsers || 0,
            activeUsers: systemQuery.data.activeUsers || 0,
            newUsersThisMonth: systemQuery.data.newUsers || 0,
            superAdmins: systemQuery.data.superAdmins || 0,
            schoolAdmins: systemQuery.data.schoolAdmins || 0,
            teachers: systemQuery.data.teachers || 0,
            students: systemQuery.data.students || 0,
            parents: systemQuery.data.parents || 0,
          },
        }
      : undefined;

  return {
    data,
    isLoading,
    error: error as Error | null,
    isError,
  };
}
