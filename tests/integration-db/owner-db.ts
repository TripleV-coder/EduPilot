import { inject } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Client du rôle propriétaire (BYPASSRLS) : prépare les jeux de données et
 * vérifie l'état réel de la base. Le code applicatif testé, lui, passe par
 * `@/lib/prisma`, connecté avec le rôle applicatif soumis à la RLS (audit M2).
 */
const globalForOwner = globalThis as unknown as { __ownerDb?: PrismaClient };

export const ownerDb =
  globalForOwner.__ownerDb ??
  (globalForOwner.__ownerDb = new PrismaClient({ datasources: { db: { url: inject("ownerDatabaseUrl") } } }));

export default ownerDb;
