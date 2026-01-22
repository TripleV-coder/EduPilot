"use client";

import { toast } from "sonner";
import { useEffect } from "react";
import { useApiQuery } from "./use-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./use-socket";
import { useSession } from "next-auth/react";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date | null;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Hook to fetch notifications with real-time updates
 */
export function useNotifications(filters?: {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket({
    autoConnect: true,
    userId: session?.user?.id,
    role: session?.user?.role,
  });

  const params = new URLSearchParams();
  if (filters?.unreadOnly) params.append("unreadOnly", "true");
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.limit) params.append("limit", filters.limit.toString());

  const queryString = params.toString();
  const url = `/api/notifications${queryString ? `?${queryString}` : ""}`;

  const query = useApiQuery<NotificationsResponse>(url, ["notifications", filters], {
    refetchInterval: 30000, // Refetch every 30s as fallback
  });

  // Real-time updates via Socket.io
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewNotification = (notification: Notification) => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      // Show toast notification
      toast(notification.title, {
        description: notification.message,
      });
    };

    const handleNotificationRead = (notificationId: string) => {
      // Optimistically update cache
      queryClient.setQueryData<NotificationsResponse>(
        ["notifications", filters],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            notifications: old.notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        }
      );
    };

    socket.on("notification", handleNewNotification);
    socket.on("notification:read", handleNotificationRead);

    return () => {
      socket.off("notification", handleNewNotification);
      socket.off("notification:read", handleNotificationRead);
    };
  }, [socket, isConnected, queryClient, filters]);

  return query;
}

/**
 * Hook to get unread count only
 */
export function useUnreadNotificationsCount() {
  const { data } = useNotifications({ unreadOnly: true, limit: 1 });
  return data?.unreadCount || 0;
}

/**
 * Hook to mark notification as read
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du marquage");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du marquage");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Hook to delete notification
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
