import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";

/** Session courante renvoyée par le mock de `@/lib/auth` (voir setup.ts). */
const sessionState = globalThis as unknown as { __integrationSession?: Session | null };

export function actAs(session: Session | null): void {
  sessionState.__integrationSession = session;
}

export function sessionFor(role: UserRole, schoolId: string | null, userId?: string): Session {
  return {
    user: {
      id: userId ?? `it-${role.toLowerCase()}-${schoolId ?? "global"}`,
      email: `${role.toLowerCase()}@integration.test`,
      role,
      primaryOrganizationId: null,
      primarySchoolId: schoolId,
      schoolId,
      accessibleSchoolIds: schoolId ? [schoolId] : [],
      firstName: "Test",
      lastName: role,
      isTwoFactorEnabled: false,
      isTwoFactorAuthenticated: false,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

/** Suffixe unique : la base de CI peut être réutilisée entre deux exécutions. */
export function uniqueCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createSchool(prefix: string) {
  const code = uniqueCode(prefix);
  return prisma.school.create({
    data: { name: `École ${code}`, code, level: "PRIMARY" },
  });
}

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/** Appelle un vrai handler de route (createApiHandler compris) et lit sa réponse. */
export async function callRoute(
  handler: RouteHandler,
  options: {
    method?: string;
    path: string;
    params?: Record<string, string>;
    body?: unknown;
    /** Corps envoyé tel quel (JSON invalide, très gros corps, webhook signé…). */
    rawBody?: string;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; body: unknown }> {
  const payload = options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
  const request = new NextRequest(new URL(options.path, "http://localhost:3000"), {
    method: options.method ?? "GET",
    headers: {
      ...(payload !== undefined ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    body: payload,
  });

  const response = await handler(request, { params: Promise.resolve(options.params ?? {}) });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // corps non JSON : conservé tel quel
  }
  return { status: response.status, body };
}
