import { PrismaClient } from "@prisma/client";
import { validateCriticalEnv } from "@/lib/env";
import { createScopedClient } from "@/lib/db/scoped-client";

// Validate environment variables before initializing Prisma
validateCriticalEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Chaque opération porte le contexte d'établissement de la requête, lu par les
// politiques RLS des tables sensibles (audit M2, `lib/db/scoped-client.ts`).
export const prisma =
  globalForPrisma.prisma ??
  createScopedClient(
    new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    }),
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
