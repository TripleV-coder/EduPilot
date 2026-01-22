import { z } from "zod";

export const subjectSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  code: z.string().min(1, "Le code est obligatoire").max(10),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const classSubjectSchema = z.object({
  classId: z.string().cuid(),
  subjectId: z.string().cuid(),
  teacherId: z.string().cuid().optional().nullable(),
  coefficient: z.coerce.number().min(0.5).max(10).default(1),
  weeklyHours: z.coerce.number().min(0.5).max(20).optional(),
});

export type SubjectInput = z.infer<typeof subjectSchema>;
export type ClassSubjectInput = z.infer<typeof classSubjectSchema>;
