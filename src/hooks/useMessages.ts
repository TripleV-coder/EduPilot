"use client";

import { useApiQuery } from "./use-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface MessageUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface Message {
  id: string;
  subject: string;
  content: string;
  senderId: string;
  recipientId: string;
  parentId?: string | null;
  isRead: boolean;
  isArchived: boolean;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedBySender: boolean;
  deletedByRecipient: boolean;
  sender: MessageUser;
  recipient: MessageUser;
  parent?: {
    id: string;
    subject: string;
  } | null;
  replies?: Message[];
  _count?: {
    replies: number;
  };
}

export interface MessagesResponse {
  messages: Message[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MessageFilters {
  type?: "inbox" | "sent" | "archived";
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface SendMessageInput {
  recipientId: string;
  subject: string;
  content: string;
  parentId?: string;
}

/**
 * Hook to fetch messages list with filters
 */
export function useMessages(filters: MessageFilters = {}) {
  const params = new URLSearchParams();

  if (filters.type) params.append("type", filters.type);
  if (filters.unreadOnly) params.append("unreadOnly", "true");
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.limit) params.append("limit", filters.limit.toString());

  const queryString = params.toString();
  const url = `/api/messages${queryString ? `?${queryString}` : ""}`;

  return useApiQuery<MessagesResponse>(url, ["messages", filters], {
    refetchInterval: 30000, // Refetch every 30s for new messages
  });
}

/**
 * Hook to fetch a single message with thread
 */
export function useMessage(messageId: string | null) {
  return useApiQuery<Message>(
    messageId ? `/api/messages/${messageId}` : null,
    ["message", messageId],
    {
      enabled: !!messageId,
    }
  );
}

/**
 * Hook to send a new message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SendMessageInput) => {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi du message");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate messages queries to refetch
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

/**
 * Hook to mark message as read/unread
 */
export function useMarkMessageAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, isRead }: { messageId: string; isRead: boolean }) => {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la mise à jour");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["message", variables.messageId] });
    },
  });
}

/**
 * Hook to archive/unarchive message
 */
export function useArchiveMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, isArchived }: { messageId: string; isArchived: boolean }) => {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'archivage");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate messages queries
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

/**
 * Hook to delete a message (soft delete)
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate messages queries
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

/**
 * Hook to get unread count
 */
export function useUnreadCount() {
  const { data } = useMessages({ type: "inbox", limit: 1 });
  return data?.unreadCount || 0;
}
