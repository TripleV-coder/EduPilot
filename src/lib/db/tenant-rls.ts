import prisma from "@/lib/prisma";
import { runWithDbContext, tenantContext } from "@/lib/db/db-context";

/**
 * Exécute une transaction restreinte à un seul établissement (audit M2).
 * Le contexte de la requête est déjà posé automatiquement par
 * `createApiHandler` ; ce helper le réduit à `tenantId` pour la transaction.
 */
export async function withTenantRls<T>(
  tenantId: string | null | undefined,
  callback: (tx: typeof prisma) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    return callback(prisma);
  }

  return runWithDbContext(tenantContext([tenantId]), () =>
    prisma.$transaction(async (tx) => callback(tx as typeof prisma)),
  );
}
