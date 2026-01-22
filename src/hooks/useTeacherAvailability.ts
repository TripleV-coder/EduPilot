"use client";

import { useApiQuery } from "./use-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface TeacherAvailabilitySlot {
  id: string;
  teacherId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookedSlot {
  scheduledAt: Date;
  duration: number; // minutes
}

export interface TeacherAvailabilityResponse {
  availabilities: TeacherAvailabilitySlot[];
  bookedSlots: BookedSlot[];
}

export interface CreateAvailabilityInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Hook to fetch teacher availability slots
 */
export function useTeacherAvailability(teacherId: string | null) {
  return useApiQuery<TeacherAvailabilityResponse>(
    teacherId ? `/api/teachers/${teacherId}/availability` : null,
    ["teacher-availability", teacherId],
    {
      enabled: !!teacherId,
    }
  );
}

/**
 * Hook to create availability slot
 */
export function useCreateAvailability(teacherId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAvailabilityInput) => {
      const response = await fetch(`/api/teachers/${teacherId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la création");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-availability", teacherId] });
    },
  });
}

/**
 * Hook to delete availability slot
 */
export function useDeleteAvailability(teacherId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slotId: string) => {
      const response = await fetch(`/api/teachers/${teacherId}/availability/${slotId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-availability", teacherId] });
    },
  });
}

/**
 * Helper to get day name in French
 */
export function getDayName(dayOfWeek: number): string {
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  return days[dayOfWeek] || "";
}

/**
 * Helper to get short day name in French
 */
export function getShortDayName(dayOfWeek: number): string {
  const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return days[dayOfWeek] || "";
}
