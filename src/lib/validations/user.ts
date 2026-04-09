import { z } from "zod";
import { strongPasswordSchema } from "./auth";

// Phone number validation for Benin (+229)
const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => !val || /^(\+229)?[0-9]{8,10}$/.test(val.replace(/\s/g, "")),
    { message: "Numéro de téléphone invalide" }
  );

export const userSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim(),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
  phone: phoneSchema,
  role: z.enum(["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT"]),
  schoolId: z.string().cuid().optional().nullable(),
  password: strongPasswordSchema,
});

export const teacherProfileSchema = z.object({
  userId: z.string().cuid(),
  matricule: z.string().optional(),
  specialization: z.string().max(100).optional(),
  hireDate: z.coerce.date().optional(),
});

export const studentProfileSchema = z.object({
  userId: z.string().cuid(),
  matricule: z.string().min(1, "Le matricule est obligatoire").max(50),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  birthPlace: z.string().max(100).optional(),
  nationality: z.string().max(50).default("Beninoise"),
  address: z.string().max(255).optional(),
});

export const studentCreateSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim(),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
  phone: phoneSchema,
  password: strongPasswordSchema,
  matricule: z.string().min(1, "Le matricule est obligatoire").max(50),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  birthPlace: z.string().max(100).optional(),
  nationality: z.string().max(50).default("Beninoise"),
  address: z.string().max(255).optional(),
  classId: z.string().cuid("ID de classe invalide"),
  academicYearId: z.string().cuid("ID d'année scolaire invalide"),
});

export const teacherCreateSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim(),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
  phone: phoneSchema,
  password: strongPasswordSchema,
  matricule: z.string().max(50).optional(),
  specialization: z.string().max(100).optional(),
  hireDate: z.coerce.date().optional(),
  schoolId: z.string().cuid().optional(),
  primarySchoolId: z.string().cuid().optional(),
  additionalSchoolIds: z.array(z.string().cuid()).max(20).optional().default([]),
});

export const teacherUpdateSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim().optional(),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim().optional(),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim().optional(),
  phone: phoneSchema,
  matricule: z.string().max(50).optional().nullable(),
  specialization: z.string().max(100).optional().nullable(),
  hireDate: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
  schoolId: z.string().cuid().optional(),
  primarySchoolId: z.string().cuid().optional(),
  additionalSchoolIds: z.array(z.string().cuid()).max(20).optional().default([]),
});

export const parentProfileSchema = z.object({
  userId: z.string().cuid(),
  profession: z.string().max(100).optional(),
});

export const enrollmentSchema = z.object({
  studentId: z.string().cuid("ID étudiant invalide"),
  classId: z.string().cuid("ID classe invalide"),
  academicYearId: z.string().cuid("ID année scolaire invalide"),
  status: z.enum(["ACTIVE", "TRANSFERRED", "GRADUATED", "DROPPED", "SUSPENDED"]).default("ACTIVE"),
});

export const studentUpdateSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim().optional(),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim().optional(),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim().optional(),
  phone: phoneSchema,
  matricule: z.string().min(1, "Le matricule est obligatoire").max(50).optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  birthPlace: z.string().max(100).optional(),
  nationality: z.string().max(50).optional(),
  address: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

export type UserInput = z.infer<typeof userSchema>;
export type TeacherProfileInput = z.infer<typeof teacherProfileSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type TeacherCreateInput = z.infer<typeof teacherCreateSchema>;
export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;
export type ParentProfileInput = z.infer<typeof parentProfileSchema>;
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
