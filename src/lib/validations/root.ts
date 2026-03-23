import { z } from "zod";

export const schoolDeploymentSchema = z.object({
  name: z.string().min(3, "Le nom de l'établissement doit contenir au moins 3 caractères"),
  type: z.enum(["PUBLIC", "PRIVATE", "RELIGIOUS", "INTERNATIONAL"]).default("PRIVATE"),
  level: z.enum(["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE", "MIXED"]).default("SECONDARY_COLLEGE"),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable().or(z.literal("")),
  website: z.string().url("URL invalide").optional().nullable().or(z.literal("")),
  adminFirstName: z.string().min(2, "Prénom trop court"),
  adminLastName: z.string().min(2, "Nom trop court"),
  adminEmail: z.string().email("Email admin invalide"),
  adminPassword: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

export const schoolQuotaUpdateSchema = z.object({
  id: z.string().cuid(),
  planId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional(),
});
