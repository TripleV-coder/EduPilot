/**
 * Types pour la gestion de la discipline
 */

export type IncidentType =
  | "LATE"
  | "ABSENCE_UNEXCUSED"
  | "DISRESPECT"
  | "DISRUPTION"
  | "CHEATING"
  | "BULLYING"
  | "VIOLENCE"
  | "VANDALISM"
  | "THEFT"
  | "SUBSTANCE"
  | "INAPPROPRIATE_LANGUAGE"
  | "DRESS_CODE"
  | "TECHNOLOGY_MISUSE"
  | "OTHER";

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SanctionType =
  | "WARNING"
  | "DETENTION"
  | "SUSPENSION"
  | "EXPULSION"
  | "COMMUNITY_SERVICE"
  | "LOSS_OF_PRIVILEGE"
  | "PARENT_CONFERENCE"
  | "COUNSELING"
  | "OTHER";

export interface Sanction {
  id: string;
  incidentId: string;
  type: SanctionType;
  description: string | null;
  startDate: string;
  endDate: string | null;
  isServed: boolean;
  servedAt: string | null;
  assignedById: string;
  createdAt: string;
}

export interface BehaviorIncident {
  id: string;
  studentId: string;
  reportedById: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  date: string;
  location: string | null;
  description: string;
  actionTaken: string | null;
  followUpNotes: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  sanctions: Sanction[];
  createdAt: string;
}

export function getIncidentTypeLabel(type: IncidentType): string {
  const labels: Record<IncidentType, string> = {
    LATE: "Retard",
    ABSENCE_UNEXCUSED: "Absence Non Justifiée",
    DISRESPECT: "Manque de Respect",
    DISRUPTION: "Perturbation",
    CHEATING: "Tricherie",
    BULLYING: "Harcèlement",
    VIOLENCE: "Violence",
    VANDALISM: "Vandalisme",
    THEFT: "Vol",
    SUBSTANCE: "Substance Interdite",
    INAPPROPRIATE_LANGUAGE: "Langage Inapproprié",
    DRESS_CODE: "Code Vestimentaire",
    TECHNOLOGY_MISUSE: "Mauvais Usage Technologie",
    OTHER: "Autre",
  };
  return labels[type];
}

export function getSeverityColor(severity: IncidentSeverity): string {
  const colors: Record<IncidentSeverity, string> = {
    LOW: "bg-yellow-100 text-yellow-700",
    MEDIUM: "bg-orange-100 text-orange-700",
    HIGH: "bg-red-100 text-red-700",
    CRITICAL: "bg-red-200 text-red-900",
  };
  return colors[severity];
}
