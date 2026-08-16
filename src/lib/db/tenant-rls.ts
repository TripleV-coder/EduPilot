import prisma from "@/lib/prisma";

/**
 * Exécute une transaction en injectant le tenant courant dans Postgres.
 * Les politiques RLS utilisant `app.current_tenant_id` deviennent alors actives.
 */
export async function withTenantRls<T>(
  tenantId: string | null | undefined,
  callback: (tx: typeof prisma) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    return callback(prisma);
  }

  return prisma.$transaction(async (tx) => {
    try {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        tenantId
      );
    } catch {
      // Catch safe fallback in non-Postgres environments (e.g. SQLite / unit tests)
    }
    return callback(tx as typeof prisma);
  });
}

