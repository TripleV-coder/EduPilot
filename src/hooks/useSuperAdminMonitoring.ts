"use client";

import { useApiQuery } from "./use-api";

export interface SystemHealth {
  status: "healthy" | "warning" | "critical";
  uptime: string;
  uptimePercent: number;
  responseTime: string;
  responseTimeMs: number;
  dbResponseTime: string;
  dbResponseTimeMs: number;
  activeUsers: number;
  totalUsers: number;
  totalSchools: number;
  timestamp: string;
  checks: {
    database: "healthy" | "warning" | "critical";
    api: "healthy" | "warning" | "critical";
  };
}

export interface SystemActivity {
  id: string;
  action: string;
  description: string;
  user: string;
  userId: string | null;
  school: string;
  schoolId: string | null;
  timestamp: Date;
  timeAgo: string;
  icon: string;
  severity: "low" | "medium" | "high";
}

export interface SystemActivityResponse {
  activities: SystemActivity[];
  stats: {
    total: number;
    last24Hours: number;
    byAction: Array<{ action: string; _count: number }>;
  };
  timestamp: string;
}

export interface PendingAction {
  id: string;
  type: string;
  description: string;
  count: number;
  priority: "low" | "medium" | "high";
  url: string;
  icon: string;
}

export interface PendingActionsResponse {
  actions: PendingAction[];
  allActions: PendingAction[];
  summary: {
    total: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  };
  timestamp: string;
}

/**
 * Hook to fetch system health metrics
 */
export function useSystemHealth() {
  return useApiQuery<SystemHealth>("/api/system/health", undefined, {
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to fetch recent system activity
 */
export function useSystemActivity(limit: number = 10) {
  return useApiQuery<SystemActivityResponse>(
    `/api/system/activity?limit=${limit}`,
    undefined,
    {
      refetchInterval: 15000, // Refetch every 15 seconds
    }
  );
}

/**
 * Hook to fetch pending administrative actions
 */
export function usePendingActions() {
  return useApiQuery<PendingActionsResponse>("/api/admin/pending-actions", undefined, {
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Combined hook for Super Admin Dashboard
 */
export function useSuperAdminMonitoring() {
  const health = useSystemHealth();
  const activity = useSystemActivity(10);
  const pendingActions = usePendingActions();

  const isLoading = health.isPending || activity.isPending || pendingActions.isPending;
  const error = health.error || activity.error || pendingActions.error;
  const isError = health.isError || activity.isError || pendingActions.isError;

  return {
    health: health.data,
    activity: activity.data,
    pendingActions: pendingActions.data,
    isLoading,
    error,
    isError,
    refetch: () => {
      health.refetch();
      activity.refetch();
      pendingActions.refetch();
    },
  };
}
