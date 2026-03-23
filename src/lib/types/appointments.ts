/**
 * Types pour les rendez-vous
 */

export type AppointmentType = "IN_PERSON" | "VIDEO_CALL" | "PHONE_CALL";

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";

export interface Appointment {
  id: string;
  teacherId: string;
  parentId: string;
  studentId: string;
  scheduledAt: string;
  duration: number;
  type: AppointmentType;
  status: AppointmentStatus;
  meetingLink: string | null;
  location: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdById: string;
  confirmedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getAppointmentTypeLabel(type: AppointmentType): string {
  const labels: Record<AppointmentType, string> = {
    IN_PERSON: "En Personne",
    VIDEO_CALL: "Visioconférence",
    PHONE_CALL: "Appel Téléphonique",
  };
  return labels[type];
}

export function getAppointmentStatusLabel(status: AppointmentStatus): string {
  const labels: Record<AppointmentStatus, string> = {
    PENDING: "En Attente",
    CONFIRMED: "Confirmé",
    COMPLETED: "Terminé",
    CANCELED: "Annulé",
    NO_SHOW: "Absent",
  };
  return labels[status];
}

export function getAppointmentStatusColor(status: AppointmentStatus): string {
  const colors: Record<AppointmentStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELED: "bg-gray-100 text-gray-700",
    NO_SHOW: "bg-red-100 text-red-700",
  };
  return colors[status];
}
