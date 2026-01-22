/**
 * Types pour les événements scolaires
 */

export type EventType =
  | "GENERAL"
  | "SPORTS"
  | "CULTURAL"
  | "ACADEMIC"
  | "FIELD_TRIP"
  | "ASSEMBLY"
  | "PARENT_MEETING"
  | "GRADUATION"
  | "COMPETITION"
  | "WORKSHOP";

export type EventParticipationStatus =
  | "REGISTERED"
  | "CONFIRMED"
  | "ATTENDED"
  | "ABSENT"
  | "CANCELED";

export interface EventParticipation {
  id: string;
  eventId: string;
  studentId: string;
  status: EventParticipationStatus;
  permissionGiven: boolean;
  permissionBy: string | null;
  paymentStatus: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SchoolEvent {
  id: string;
  schoolId: string;
  title: string;
  description: string | null;
  type: EventType;
  startDate: string;
  endDate: string | null;
  location: string | null;
  maxParticipants: number | null;
  fee: number | null;
  requiresPermission: boolean;
  isPublished: boolean;
  createdById: string;
  participations: EventParticipation[];
  createdAt: string;
}

export function getEventTypeLabel(type: EventType): string {
  const labels: Record<EventType, string> = {
    GENERAL: "Général",
    SPORTS: "Sport",
    CULTURAL: "Culturel",
    ACADEMIC: "Académique",
    FIELD_TRIP: "Sortie Scolaire",
    ASSEMBLY: "Assemblée",
    PARENT_MEETING: "Réunion Parents",
    GRADUATION: "Remise des Diplômes",
    COMPETITION: "Compétition",
    WORKSHOP: "Atelier",
  };
  return labels[type];
}
