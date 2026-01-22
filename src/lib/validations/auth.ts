import { z } from "zod";

// Password validation regex patterns
const hasUpperCase = /[A-Z]/;
const hasLowerCase = /[a-z]/;
const hasNumber = /\d/;
const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;

/**
 * Strong password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const strongPasswordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères")
  .refine((val) => hasUpperCase.test(val), {
    message: "Le mot de passe doit contenir au moins une majuscule",
  })
  .refine((val) => hasLowerCase.test(val), {
    message: "Le mot de passe doit contenir au moins une minuscule",
  })
  .refine((val) => hasNumber.test(val), {
    message: "Le mot de passe doit contenir au moins un chiffre",
  });

/**
 * Very strong password validation (for admin accounts)
 * Adds requirement for special characters
 */
export const veryStrongPasswordSchema = strongPasswordSchema.refine(
  (val) => hasSpecialChar.test(val),
  {
    message: "Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)",
  }
);

export const loginSchema = z.object({
  email: z.string().email("Email invalide").toLowerCase().trim(),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const registerSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").trim(),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères").trim(),
  email: z.string().email("Email invalide").toLowerCase().trim(),
  password: strongPasswordSchema,
  confirmPassword: z.string(),
  role: z.enum(["DIRECTOR", "TEACHER", "STUDENT", "PARENT", "SCHOOL_ADMIN"]).optional().default("STUDENT"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
