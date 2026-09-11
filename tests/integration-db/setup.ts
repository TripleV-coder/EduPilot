import { inject, vi } from "vitest";
import type { Session } from "next-auth";

// La base jetable préparée par global-setup.ts — avant tout import de Prisma.
process.env.DATABASE_URL = inject("databaseUrl");
process.env.NEXTAUTH_SECRET ??= "integration-test-secret-at-least-32-characters";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

/**
 * Seule la session est simulée : NextAuth dépend du runtime Next et du cookie
 * JWT. Prisma, les gardes d'accès et les handlers sont les vrais.
 */
const sessionState = globalThis as unknown as { __integrationSession?: Session | null };

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => sessionState.__integrationSession ?? null),
}));
