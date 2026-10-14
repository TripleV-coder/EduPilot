import { NextRequest, NextResponse } from 'next/server';
import { GET as AuthGET, POST as AuthPOST } from "@/lib/auth";
import { getClientIp, reserveLoginAttempt } from '@/lib/rate-limit';
import { SERVICE_UNAVAILABLE_CODE } from '@/lib/auth/login-failure';

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
 * Identifiant saisi (formulaire de next-auth/react ou JSON), lu sur une copie
 * de la requête : le corps reste intact pour NextAuth.
 */
async function submittedEmail(req: NextRequest): Promise<string | null> {
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const body = (await req.clone().json()) as { email?: unknown };
      return typeof body.email === "string" ? body.email : null;
    }
    const email = new URLSearchParams(await req.clone().text()).get("email");
    return email || null;
  } catch {
    return null;
  }
}

/**
 * POST : limite les ÉCHECS de connexion (audit H4), par compte depuis une
 * adresse (10 / 15 min) et par adresse tous comptes confondus (200 / 15 min,
 * `LOGIN_IP_FAILURES_PER_15MIN`).
 *
 * Chaque tentative est comptée avant la vérification des identifiants, puis
 * rendue si elle réussit : une rafale parallèle ne peut pas dépasser la limite,
 * et les connexions réussies ne la consomment pas. Au-delà, 429 sans vérifier
 * les identifiants ; le corps garde le champ `url` attendu par next-auth/react.
 *
 * Une salle informatique ou un routeur 4G d'école partage une seule adresse :
 * ni 30 connexions simultanées ni quelques fautes de frappe ne doivent bloquer
 * l'établissement (analyse de capacité 2026-10-01, G3).
 */
export async function POST(req: NextRequest) {
  const { pathname } = new URL(req.url);
  if (!pathname.endsWith(CREDENTIALS_CALLBACK_SUFFIX)) {
    return AuthPOST(req);
  }

  const attempt = await reserveLoginAttempt("login-failures", getClientIp(req), await submittedEmail(req));

  if (!attempt.allowed) {
    const retryAfter = Math.max(1, Math.ceil((attempt.reset.getTime() - Date.now()) / 1000));
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
  // Ni une connexion réussie, ni une panne technique (M10) ne comptent comme
  // un échec : sinon une école entière resterait bloquée après la panne.
  if (issuedSession(response) || (await reportsServiceUnavailable(response))) {
    await attempt.release();
  }
  return response;
}

/** La réponse NextAuth porte `code=service_unavailable` (redirection ou JSON `{ url }`). */
async function reportsServiceUnavailable(response: Response): Promise<boolean> {
  const marker = `code=${SERVICE_UNAVAILABLE_CODE}`;
  if ((response.headers.get("location") ?? "").includes(marker)) return true;
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return false;
  try {
    const { url } = (await response.clone().json()) as { url?: unknown };
    return typeof url === "string" && url.includes(marker);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  return AuthGET(req);
}
