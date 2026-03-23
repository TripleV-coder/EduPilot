import prisma from "@/lib/prisma";

export type SoftDeletableModel =
  | "studentProfile"
  | "teacherProfile"
  | "class"
  | "subject"
  | "homework"
  | "resource"
  | "payment"
  | "message"
  | "announcement"
  | "grade"
  | "enrollment"
  | "mealTicket";

/**
 * Soft delete a record by setting deletedAt.
 * This never removes data physically from the database.
 */
export async function softDelete(model: SoftDeletableModel, id: string) {
  const now = new Date();
  const client = prisma as unknown as Record<string, { update: (arg: unknown) => Promise<unknown> }>;
  return client[model].update({
    where: { id },
    data: { deletedAt: now },
  });
}

/**
 * Restore a soft-deleted record (set deletedAt to null).
 * This should only be callable from highly-privileged code (root space).
 */
export async function restore(model: SoftDeletableModel, id: string) {
  const client = prisma as unknown as Record<string, { update: (arg: unknown) => Promise<unknown> }>;
  return client[model].update({
    where: { id },
    data: { deletedAt: null },
  });
}

