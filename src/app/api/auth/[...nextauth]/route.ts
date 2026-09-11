import { NextRequest, NextResponse } from 'next/server';
import { GET as AuthGET, POST as AuthPOST } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  createRateLimitKey,
  releaseRateLimit,
  LOGIN_FAILURE_RATE_LIMIT,
} from '@/lib/auth/rate-limiter';

/** Point d'entrée réel de la connexion par identifiants (NextAuth v5). */
const CREDENTIALS_CALLBACK_SUFFIX = "/callback/credentials";

/** Code d'erreur lu par l'écran de connexion (`@/lib/auth/login-errors`). */
export const LOGIN_RATE_LIMITED_ERROR = "RateLimited";

/**
 * Une connexion réussie — y compris l'étape « mot de passe validé, second
 * facteur attendu » — émet le cookie de session ; un échec ne l'émet pas.
 */
function issuedSession(response: Response): boolean {
  const cookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
  return cookies.some((cookie) => /(?:^|[\s;,])(?:__Secure-)?(?:authjs|next-auth)\.session-token(?:\.\d+)?=/.test(cookie));
}

/**
 * POST : limite les ÉCHECS de connexion par IP (audit H4).
 *
 * Chaque tentative est comptée avant la vérification des identifiants, puis
 * rendue si elle réussit : une rafale parallèle ne peut pas dépasser la limite,
 * et les connexions réussies ne la consomment pas. Au-delà, 429 sans vérifier
 * les identifiants ; le corps garde le champ `url` attendu par next-auth/react.
 *
 * (L'ancien filtre sur le paramètre `nextauth` ne correspondait à aucune
 * requête sous l'App Router : la connexion n'était jamais limitée.)
 */
export async function POST(req: NextRequest) {
  const { pathname } = new URL(req.url);
  if (!pathname.endsWith(CREDENTIALS_CALLBACK_SUFFIX)) {
    return AuthPOST(req);
  }

  const rateLimitKey = createRateLimitKey("login-failures", getClientIp(req));
  const attempt = await checkRateLimit(rateLimitKey, LOGIN_FAILURE_RATE_LIMIT);

  if (!attempt.allowed) {
    const retryAfter = Math.max(1, Math.ceil((attempt.resetTime - Date.now()) / 1000));
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", LOGIN_RATE_LIMITED_ERROR);
    loginUrl.searchParams.set("code", "rate_limited");

    return NextResponse.json(
      {
        error: "Trop de tentatives de connexion. Veuillez réessayer plus tard.",
        url: loginUrl.toString(),
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = await AuthPOST(req);
  if (issuedSession(response)) {
    await releaseRateLimit(rateLimitKey);
  }
  return response;
}

export async function GET(req: NextRequest) {
  return AuthGET(req);
}
