import { NextRequest, NextResponse } from "next/server";
import { edgeAuth as auth } from "@/lib/auth/edge";
import { checkRateLimit, authLimiter, apiLimiter, strictLimiter } from "@/lib/rate-limit";

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
  "/api/ai/v2/chat",
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
    return NextResponse.next();
  }

  if (isGuestOnly) {
    const session = await auth();
    if (session?.user?.id) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};

