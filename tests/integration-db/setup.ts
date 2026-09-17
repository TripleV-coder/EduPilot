import { inject, vi } from "vitest";
import type { Session } from "next-auth";

// La base jetable préparée par global-setup.ts — avant tout import de Prisma.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.NEXTAUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
// Tâches planifiées (Lot 7) : le secret partagé avec le cron.
process.env.CRON_SECRET ??= "integration-cron-secret-0123456789abcdef";
// Indépendance vis-à-vis du .env du poste : un Upstash factice ou injoignable
// ajouterait ~4 s par requête (H6). Le repli mémoire est le comportement testé.
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";

/**
 * Seule la session est simulée : NextAuth dépend du runtime Next et du cookie
 * JWT. Prisma, les gardes d'accès et les handlers sont les vrais.
 */
const sessionState = globalThis as unknown as { __integrationSession?: Session | null };

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => sessionState.__integrationSession ?? null),
}));
