import { NextRequest, NextResponse } from "next/server";
import { edgeAuth as auth } from "@/lib/auth/edge";
import { checkRateLimit, authLimiter, apiLimiter, strictLimiter } from "@/lib/rate-limit";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy avec nonce par requête (version stricte, sans
 * 'unsafe-inline'). Next.js App Router livre son payload RSC + l'amorçage
 * d'hydratation via des <script> inline : ils sont autorisés via le nonce que
 * Next applique automatiquement à ses scripts dès qu'il le lit dans l'en-tête
 * CSP de la requête. 'strict-dynamic' propage la confiance aux chunks chargés
 * par un script déjà noncé. REQUIERT un rendu dynamique (cf. force-dynamic du
 * layout racine) — un nonce par requête ne peut pas s'appliquer à du HTML
 * prérendu statiquement.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    IS_PROD
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://res.cloudinary.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.amazonaws.com",
    "font-src 'self' data:",
    IS_PROD
      ? "connect-src 'self' https://*.upstash.io https://*.ingest.sentry.io https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com https://api.fedapay.com https://sandbox-api.fedapay.com"
      : "connect-src 'self' http://localhost:* https://*.upstash.io https://*.ingest.sentry.io https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com https://api.fedapay.com https://sandbox-api.fedapay.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Réponse de page (document HTML) avec CSP noncée. Le nonce est transmis via
 * l'en-tête de requête (lu par Next pour ses scripts) et l'en-tête de réponse
 * (appliqué par le navigateur).
 */
function pageResponse(request: NextRequest): NextResponse {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

const PUBLIC_ROUTES = new Set([
  "/",
  // Auth & onboarding
  "/login",
  "/register",
  "/first-login",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  // Informations publiques
  "/privacy",
  "/terms",
  "/explorer",
  "/disabled",
]);

const GUEST_ONLY_ROUTES = new Set([
  "/login",
  "/register",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/first-login",
]);

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/first-login",
  "/api/auth/initial-setup",
  "/api/auth/verify-email",
  "/api/setup",
  "/api/explorer",
  "/api/docs",
  "/api/system/health",
  "/api/payments/webhook",
  "/api/payments/fedapay/webhook",
  "/api/payments/momo/webhook",
  // Vitrine publique (annuaire + fiche établissement) — lecture seule, sans auth.
  "/api/public",
  "/ecoles",
  "/ecole/",
  "/.well-known",
  "/_next",
  "/favicon",
];

const STRICT_RATE_LIMIT_PREFIXES = [
  "/api/payments",
  "/api/grades",
  "/api/users",
  "/api/schools",
  "/api/upload",
  "/api/uploads",
  "/api/compliance",
  "/api/root",
];

const AUTH_RATE_LIMIT_PREFIXES = [
  "/api/auth/login",
  "/api/auth/forgot-password",
];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const isGuestOnly = GUEST_ONLY_ROUTES.has(pathname);

  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(request);
    let limiter = apiLimiter;

    if (AUTH_RATE_LIMIT_PREFIXES.some((p) => pathname.startsWith(p))) {
      limiter = authLimiter;
    } else if (STRICT_RATE_LIMIT_PREFIXES.some((p) => pathname.startsWith(p))) {
      limiter = strictLimiter;
    }

    const { success, remaining } = await checkRateLimit(limiter, ip);
    if (!success) {
      return NextResponse.json(
        { error: "Trop de requêtes. Veuillez patienter." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    if (isPublic) {
      const res = NextResponse.next();
      res.headers.set("X-RateLimit-Remaining", String(remaining));
      return res;
    }
  }

  if (isPublic && !isGuestOnly) {
    return pageResponse(request);
  }

  if (isGuestOnly) {
    const session = await auth();
    if (session?.user?.id) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return pageResponse(request);
  }

  const session = await auth();

  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!session.user.id) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Session invalide" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  if (
    (pathname.startsWith("/dashboard/root-control") ||
      pathname.startsWith("/api/root/")) &&
    !isSuperAdmin
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Accès réservé aux super-administrateurs" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return pageResponse(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};

