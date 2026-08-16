/**
 * Helpers partagés des tests d'intégration API.
 *
 * Convention : chaque fichier de test mocke `@/lib/auth` et `@/lib/prisma`
 * (vi.mock est hoisté par fichier) ; ces helpers fournissent les requêtes
 * simulées et les sessions typées par rôle.
 */
import type { Session } from "next-auth";
import type { NextRequest } from "next/server";

/** CUID synthétique valide (regex ^c[a-z0-9]{24}$ d'api-helpers et z.cuid()). */
export function cuid(seed: string): string {
  const normalized = seed.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `c${normalized.padEnd(24, "0").slice(0, 24)}`;
}

let requestCounter = 0;

/**
 * Requête simulée compatible avec les handlers Next (url, nextUrl, headers,
 * json). Chaque requête reçoit une IP unique pour isoler le rate limiting
 * in-memory de createApiHandler entre les tests.
 */
export function makeRequest(
  url: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> }
) {
  requestCounter += 1;
  const parsedUrl = new URL(url);
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-forwarded-for": `10.0.${Math.floor(requestCounter / 256)}.${requestCounter % 256}`,
    ...init?.headers,
  });
  return {
    url,
    method: init?.method || "GET",
    headers,
    json: () => Promise.resolve(init?.body ?? {}),
    nextUrl: parsedUrl,
     
  } as unknown as NextRequest;
}

interface SessionOverrides {
  id?: string;
  schoolId?: string | null;
  accessibleSchoolIds?: string[];
}

export function makeSession(role: string, overrides: SessionOverrides = {}): Session {
  const schoolId = overrides.schoolId === undefined ? cuid("schoola") : overrides.schoolId;
  return {
    user: {
      id: overrides.id ?? cuid(`user${role}`),
      role,
      schoolId,
      accessibleSchoolIds: overrides.accessibleSchoolIds ?? (schoolId ? [schoolId] : []),
      isTwoFactorEnabled: false,
      isTwoFactorAuthenticated: false,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
     
  } as unknown as Session;
}

/** IDs de référence partagés entre les fixtures. */
export const FIXTURES = {
  schoolA: cuid("schoola"),
  schoolB: cuid("schoolb"),
  studentA: cuid("studenta"),
  studentB: cuid("studentb"),
  feeA: cuid("feea"),
  feeB: cuid("feeb"),
} as const;
