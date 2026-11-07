import { PrismaClient } from "@prisma/client";
import { validateCriticalEnv } from "@/lib/env";
import { createScopedClient } from "@/lib/db/scoped-client";

// Validate environment variables before initializing Prisma
validateCriticalEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaBase: PrismaClient | undefined;
};

export function withPoolLimit(url: string | undefined): string | undefined {
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  const configured = Number(process.env.DATABASE_POOL_SIZE);
  const size = Number.isInteger(configured) && configured >= 1 ? configured : 10;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=${size}`;
}

const datasourceUrl = withPoolLimit(process.env.DATABASE_URL);

/**
 * Client brut, UN par processus (rangé sur `globalThis`, y compris en
 * production) : le proxy, l'instrumentation et les routes sont des paquets
 * distincts ; sans ce partage, chacun ouvrirait son propre pool de connexions.
 */
const base =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
globalForPrisma.prismaBase = base;

// Chaque opération porte le contexte d'établissement de la requête, lu par les
// politiques RLS des tables sensibles (audit M2, `lib/db/scoped-client.ts`).
// L'enveloppe, elle, reste propre à chaque paquet : elle lit le contexte posé
// par la copie de `db-context` de CE paquet (AsyncLocalStorage locale au
// module). La partager entre paquets ferait perdre le contexte RLS.
export const prisma = globalForPrisma.prisma ?? createScopedClient(base);
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Client SANS contexte d'établissement, même pool que `prisma`. Réservé à
 * l'état technique partagé (`lib/shared-state`) : ses tables n'ont ni RLS ni
 * donnée d'école, et une requête y fait UN aller-retour au lieu de quatre
 * (transaction `set_config` + requête du client contextualisé).
 */
export const prismaBase = base;

export default prisma;
