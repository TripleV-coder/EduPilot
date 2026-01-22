import { z } from "zod";

// ============================================
// STUDENT ORIENTATION
// ============================================

export const studentOrientationSchema = z.object({
  studentId: z.string().min(1, "L'élève est requis"),
  academicYearId: z.string().min(1, "L'année scolaire est requise"),
  classLevelId: z.string().min(1, "Le niveau est requis"),
});

export type StudentOrientationInput = z.infer<typeof studentOrientationSchema>;

// ============================================
// ORIENTATION RECOMMENDATION
// ============================================

export const recommendationSchema = z.object({
  orientationId: z.string().min(1, "L'orientation est requise"),
  recommendedSeries: z.enum([
    "SERIE_A",
    "SERIE_B",
    "SERIE_C",
    "SERIE_D",
    "SERIE_E",
    "SERIE_F1",
    "SERIE_F2",
    "SERIE_F3",
    "SERIE_F4",
    "SERIE_G1",
    "SERIE_G2",
    "SERIE_G3",
    "FORMATION_PRO",
    "APPRENTISSAGE",
  ]),
  rank: z.number().int().min(1).default(1),
  score: z.number().min(0).max(100),
  justification: z.string().min(1, "La justification est requise"),
  strengths: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type RecommendationInput = z.infer<typeof recommendationSchema>;

// ============================================
// VALIDATION RECOMMENDATION
// ============================================

export const validateRecommendationSchema = z.object({
  isValidated: z.boolean(),
});

export type ValidateRecommendationInput = z.infer<typeof validateRecommendationSchema>;
