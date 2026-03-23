/**
 * Types pour le calendrier scolaire
 */

export type HolidayType =
  | "CHRISTMAS"
  | "NEW_YEAR"
  | "EASTER"
  | "SUMMER"
  | "FEBRUARY"
  | "SPRING"
  | "TOUSSAINT"
  | "OTHER";

export type PublicHolidayType =
  | "NATIONAL"
  | "RELIGIOUS"
  | "INTERNATIONAL"
  | "LOCAL";

export type CalendarEventType =
  | "PRE_RENTREE"
  | "RENTREE"
  | "FIN_TRIMESTRE"
  | "FIN_SEMESTRE"
  | "CONSEIL_CLASSE"
  | "REUNION_PARENTS"
  | "EXAMEN"
  | "COMPOSITION"
  | "REMISE_BULLETINS"
  | "CEREMONIE"
  | "JOURNEE_PEDAGOGIQUE"
  | "FORMATION"
  | "FIN_ANNEE"
  | "OTHER";

export interface SchoolHoliday {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  type: HolidayType;
  startDate: string;
  endDate: string;
  description: string | null;
  createdAt: string;
}

export interface PublicHoliday {
  id: string;
  schoolId: string | null;
  name: string;
  date: string;
  type: PublicHolidayType;
  isRecurring: boolean;
  description: string | null;
  createdAt: string;
}

export interface SchoolCalendarEvent {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  type: CalendarEventType;
  startDate: string;
  endDate: string | null;
  isAllDay: boolean;
  description: string | null;
  isPublic: boolean;
  targetRoles: string[];
  createdAt: string;
}

export function getCalendarEventTypeLabel(type: CalendarEventType): string {
  const labels: Record<CalendarEventType, string> = {
    PRE_RENTREE: "Pré-rentrée",
    RENTREE: "Rentrée",
    FIN_TRIMESTRE: "Fin de Trimestre",
    FIN_SEMESTRE: "Fin de Semestre",
    CONSEIL_CLASSE: "Conseil de Classe",
    REUNION_PARENTS: "Réunion Parents",
    EXAMEN: "Examens",
    COMPOSITION: "Compositions",
    REMISE_BULLETINS: "Remise des Bulletins",
    CEREMONIE: "Cérémonie",
    JOURNEE_PEDAGOGIQUE: "Journée Pédagogique",
    FORMATION: "Formation",
    FIN_ANNEE: "Fin d'Année",
    OTHER: "Autre",
  };
  return labels[type];
}
