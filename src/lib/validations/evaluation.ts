import { z } from "zod";

export const evaluationTypeSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  code: z.string().min(1, "Le code est obligatoire").max(10),
  weight: z.coerce.number().min(0.1).max(10).default(1),
  maxCount: z.coerce.number().min(1).optional(),
});

export const evaluationSchema = z.object({
  classSubjectId: z.string().cuid(),
  periodId: z.string().cuid(),
  typeId: z.string().cuid(),
  title: z.string().optional(),
  date: z.coerce.date(),
  maxGrade: z.coerce.number().min(1).max(100).default(20),
  coefficient: z.coerce.number().min(0.1).max(10).default(1),
});

export const gradeSchema = z.object({
  evaluationId: z.string().cuid(),
  studentId: z.string().cuid(),
  value: z.coerce.number().min(0).optional().nullable(),
  isAbsent: z.boolean().default(false),
  isExcused: z.boolean().default(false),
  comment: z.string().optional(),
});

export const bulkGradeSchema = z.object({
  evaluationId: z.string().cuid(),
  grades: z.array(z.object({
    studentId: z.string().cuid(),
    value: z.coerce.number().min(0).optional().nullable(),
    isAbsent: z.boolean().default(false),
    isExcused: z.boolean().default(false),
    comment: z.string().optional(),
  })),
});

export type EvaluationTypeInput = z.infer<typeof evaluationTypeSchema>;
export type EvaluationInput = z.infer<typeof evaluationSchema>;
export type GradeInput = z.infer<typeof gradeSchema>;
export type BulkGradeInput = z.infer<typeof bulkGradeSchema>;
