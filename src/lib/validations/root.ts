import { z } from "zod";
import { veryStrongPasswordSchema } from "./auth";

export const schoolDeploymentSchema = z.object({
  name: z.string().min(3, "Le nom de l'établissement doit contenir au moins 3 caractères"),
  type: z.enum(["PUBLIC", "PRIVATE", "RELIGIOUS", "INTERNATIONAL"]).default("PRIVATE"),
  level: z.enum(["PRIMARY", "SECONDARY_COLLEGE", "SECONDARY_LYCEE", "MIXED"]).default("SECONDARY_COLLEGE"),
  city: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email invalide").optional().nullable().or(z.literal("")),
  logo: z.string().url("URL du logo invalide").optional().nullable().or(z.literal("")),
  parentSchoolId: z.string().cuid().optional().nullable().or(z.literal("")),
  organizationMode: z.enum(["NONE", "CREATE", "EXISTING"]).default("NONE"),
  organizationId: z.string().cuid().optional().nullable().or(z.literal("")),
  organizationName: z.string().optional().nullable(),
  organizationDescription: z.string().optional().nullable(),
  assignAdminAsOrganizationManager: z.boolean().optional().default(false),
  adminFirstName: z.string().min(2, "Prénom trop court"),
  adminLastName: z.string().min(2, "Nom trop court"),
  adminEmail: z.string().email("Email admin invalide"),
  adminPassword: veryStrongPasswordSchema, // P13: Strong password validation for admin accounts
}).superRefine((data, ctx) => {
  if (data.organizationMode === "CREATE" && !data.organizationName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["organizationName"],
      message: "Le nom de l'organisation est requis.",
    });
  }

  if (data.organizationMode === "EXISTING" && !data.organizationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["organizationId"],
      message: "Sélectionnez une organisation existante.",
    });
  }
});

export const schoolQuotaUpdateSchema = z.object({
  id: z.string().cuid(),
  planId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional(),
});
