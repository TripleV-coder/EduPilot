import { z } from "zod";

// ============================================
// SCHOOL HOLIDAYS
// ============================================

export const schoolHolidaySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum([
    "CHRISTMAS",
    "NEW_YEAR",
    "EASTER",
    "SUMMER",
    "FEBRUARY",
    "SPRING",
    "TOUSSAINT",
    "OTHER",
  ]),
  academicYearId: z.string().min(1, "L'année scolaire est requise"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  description: z.string().optional(),
});

export type SchoolHolidayInput = z.infer<typeof schoolHolidaySchema>;

// ============================================
// PUBLIC HOLIDAYS
// ============================================

export const publicHolidaySchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["NATIONAL", "RELIGIOUS", "INTERNATIONAL", "LOCAL"]),
  date: z.string().or(z.date()),
  isRecurring: z.boolean().default(true),
  description: z.string().optional(),
});

export type PublicHolidayInput = z.infer<typeof publicHolidaySchema>;

// ============================================
// CALENDAR EVENTS
// ============================================

export const calendarEventSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum([
    "PRE_RENTREE",
    "RENTREE",
    "FIN_TRIMESTRE",
    "FIN_SEMESTRE",
    "CONSEIL_CLASSE",
    "REUNION_PARENTS",
    "EXAMEN",
    "COMPOSITION",
    "REMISE_BULLETINS",
    "CEREMONIE",
    "JOURNEE_PEDAGOGIQUE",
    "FORMATION",
    "FIN_ANNEE",
    "OTHER",
  ]),
  academicYearId: z.string().min(1, "L'année scolaire est requise"),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional(),
  isAllDay: z.boolean().default(true),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
  targetRoles: z.array(z.string()).default([]),
});

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;
