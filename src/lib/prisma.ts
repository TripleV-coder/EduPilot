import { PrismaClient } from "@prisma/client";
import { validateCriticalEnv } from "@/lib/env";
import { createScopedClient } from "@/lib/db/scoped-client";

// Validate environment variables before initializing Prisma
validateCriticalEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Taille du pool de connexions PAR PROCESSUS (analyse de capacité 2026-10-01).
 *
 * Par défaut Prisma ouvre 2 × cœurs + 1 connexions par processus : sur une
 * machine de 12 cœurs, 25 — et 4 processus (WEB_CONCURRENCY=4) en demandaient
 * 100, le maximum de PostgreSQL : mesuré, « Too many database connections »
 * et des pages en erreur dès le passage à plusieurs processus. Une valeur
 * explicite dans l'URL (`connection_limit=`) reste prioritaire ; sinon
 * DATABASE_POOL_SIZE (défaut 10). Règle : WEB_CONCURRENCY × DATABASE_POOL_SIZE
 * × instances + autres clients (n8n, sauvegardes) < max_connections de
 * PostgreSQL — au-delà, PgBouncer (mode transaction) devant PostgreSQL.
 */
export function withPoolLimit(url: string | undefined): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  const configured = Number(process.env.DATABASE_POOL_SIZE);
  const size = Number.isInteger(configured) && configured >= 1 ? configured : 10;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${size}`;
}

const datasourceUrl = withPoolLimit(process.env.DATABASE_URL);

// Chaque opération porte le contexte d'établissement de la requête, lu par les
// politiques RLS des tables sensibles (audit M2, `lib/db/scoped-client.ts`).
export const prisma =
  globalForPrisma.prisma ??
  createScopedClient(
    new PrismaClient({
      ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    }),
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
