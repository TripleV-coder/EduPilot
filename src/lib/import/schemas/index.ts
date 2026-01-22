import { z } from "zod";

// Shared Schemas
const phoneSchema = z.string().optional();
const _emailSchema = z.string().email("Email invalide").optional().or(z.literal(""));

// 1. Teacher Import Schema
export const importTeacherSchema = z.object({
    firstName: z.string().min(1, "Prénom requis"),
    lastName: z.string().min(1, "Nom requis"),
    email: z.string().email("Email invalide"),
    phone: phoneSchema,
    subjects: z.string().optional(), // Comma separated list of subjects
    qualification: z.string().optional(),
    type: z.enum(["PERMANENT", "CONTRACTUAL", "TEMPORARY"]).optional().default("PERMANENT"),
});

export type ImportTeacher = z.infer<typeof importTeacherSchema>;

// 2. Class Import Schema
export const importClassSchema = z.object({
    name: z.string().min(1, "Nom requis"), // e.g., "6ème A"
    level: z.string().min(1, "Niveau requis"), // e.g., "6EME"
    program: z.string().optional(), // e.g., "GENERAL", "TECHNIQUE"
    capacity: z.coerce.number().min(1).default(30),
    mainTeacherEmail: z.string().email().optional().or(z.literal("")),
});

export type ImportClass = z.infer<typeof importClassSchema>;

// 3. Parent Import Schema
export const importParentSchema = z.object({
    firstName: z.string().min(1, "Prénom requis"),
    lastName: z.string().min(1, "Nom requis"),
    email: z.string().email("Email invalide").optional().or(z.literal("")),
    phone: z.string().min(1, "Téléphone requis"),
    address: z.string().optional(),
    cin: z.string().optional(),
    job: z.string().optional(),
    childrenMatricules: z.string().optional(), // Comma separated list of student matricules
});

export type ImportParent = z.infer<typeof importParentSchema>;

// 4. Student Import Schema (Enriched)
export const importStudentSchema = z.object({
    firstName: z.string().min(1, "Prénom requis"),
    lastName: z.string().min(1, "Nom requis"),
    email: z.string().email("Email invalide").optional().or(z.literal("")),
    dateOfBirth: z.string().optional(), // DD/MM/YYYY or ISO
    gender: z.enum(["M", "F"]).optional(),
    birthPlace: z.string().optional(),
    address: z.string().optional(),
    className: z.string().optional(), // To link to a Class
    parentEmail: z.string().email().optional().or(z.literal("")), // To link to a Parent
    matricule: z.string().optional(), // If providing custom matricule
});

export type ImportStudent = z.infer<typeof importStudentSchema>;

// 5. Subject Import Schema
export const importSubjectSchema = z.object({
    name: z.string().min(1, "Nom requis"),
    code: z.string().min(1, "Code requis"),
    coefficient: z.coerce.number().min(1).default(1),
});

export type ImportSubject = z.infer<typeof importSubjectSchema>;

export interface ImportError {
    row: number;
    field?: string;
    message: string;
}
