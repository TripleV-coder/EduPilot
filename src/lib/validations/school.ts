import { z } from "zod";

export const schoolSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  code: z.string().min(2, "Le code doit contenir au moins 2 caractères").max(20),
  type: z.enum(["PUBLIC", "PRIVATE", "RELIGIOUS", "INTERNATIONAL"]),
  level: z.enum(["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE", "MIXED"]),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().nullable().or(z.literal("")),
});

export const academicConfigSchema = z.object({
  periodType: z.enum(["TRIMESTER", "SEMESTER", "HYBRID"]),
  periodsCount: z.coerce.number().min(1).max(4),
  maxGrade: z.coerce.number().min(1).max(100),
  passingGrade: z.coerce.number().min(0),
});

export const academicYearSchema = z.object({
  name: z.string().min(4, "Format attendu: 2024-2025"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().default(false),
});

export const periodSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["TRIMESTER", "SEMESTER", "HYBRID"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  sequence: z.coerce.number().min(1),
});

export const classLevelSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(10),
  level: z.enum(["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE", "MIXED"]),
  sequence: z.coerce.number().min(1),
});

export const classSchema = z.object({
  name: z.string().min(1),
  classLevelId: z.string().cuid(),
  capacity: z.coerce.number().min(1).optional(),
  mainTeacherId: z.string().cuid().optional().nullable(),
});

export type SchoolInput = z.infer<typeof schoolSchema>;
export type AcademicConfigInput = z.infer<typeof academicConfigSchema>;
export type AcademicYearInput = z.infer<typeof academicYearSchema>;
export type PeriodInput = z.infer<typeof periodSchema>;
export type ClassLevelInput = z.infer<typeof classLevelSchema>;
export type ClassInput = z.infer<typeof classSchema>;
