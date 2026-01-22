import { z } from "zod";

// Fee Schema
export const feeSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(100),
  description: z.string().max(500).optional(),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  academicYearId: z.string().cuid("ID année scolaire invalide").optional().nullable(),
  classLevelCode: z.string().max(20).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  isRequired: z.boolean().default(true),
});

// Payment Schema
export const paymentSchema = z.object({
  studentId: z.string().cuid("ID étudiant invalide"),
  feeId: z.string().cuid("ID frais invalide"),
  amount: z.coerce.number().positive("Le montant doit être supérieur à 0"),
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER", "CHECK", "OTHER"]),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  paidAt: z.coerce.date().optional(),
});

// Payment Plan Schema
export const paymentPlanSchema = z.object({
  studentId: z.string().cuid("ID étudiant invalide"),
  feeId: z.string().cuid("ID frais invalide"),
  totalAmount: z.coerce.number().positive("Le montant total doit être supérieur à 0"),
  installments: z.coerce.number().int().min(1).max(12, "Maximum 12 échéances"),
  firstDueDate: z.coerce.date(),
});

// Scholarship Schema
export const scholarshipSchema = z.object({
  studentId: z.string().cuid("ID étudiant invalide"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(100),
  type: z.enum(["MERIT", "NEED_BASED", "SPORTS", "ACADEMIC", "OTHER"]),
  amount: z.coerce.number().positive().optional(),
  percentage: z.coerce.number().min(0).max(100).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => data.amount !== undefined || data.percentage !== undefined,
  { message: "Vous devez spécifier soit un montant, soit un pourcentage" }
);

// Payment Filter Schema
export const paymentFilterSchema = z.object({
  studentId: z.string().cuid().optional(),
  feeId: z.string().cuid().optional(),
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER", "CHECK", "OTHER"]).optional(),
  status: z.enum(["PENDING", "VERIFIED", "RECONCILED", "CANCELLED"]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(20),
});

// Reconciliation Schema
export const reconciliationSchema = z.object({
  paymentIds: z.array(z.string().cuid()),
  reconciledBy: z.string().cuid(),
  notes: z.string().max(1000).optional(),
});

// Invoice Generation Schema
export const invoiceSchema = z.object({
  paymentId: z.string().cuid("ID paiement invalide"),
  includeSchoolLogo: z.boolean().default(true),
  additionalNotes: z.string().max(500).optional(),
});

export type FeeInput = z.infer<typeof feeSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type PaymentPlanInput = z.infer<typeof paymentPlanSchema>;
export type ScholarshipInput = z.infer<typeof scholarshipSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
export type ReconciliationInput = z.infer<typeof reconciliationSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
