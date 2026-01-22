import { NextRequest, NextResponse } from "next/server";
import type { NextRequest as NR } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimitMiddleware } from "@/lib/api/middleware-rate-limit";

// Routes publiques accessibles sans authentification
const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/welcome", "/initial-setup", "/first-login"];

// Routes API publiques (sans authentification)
const publicApiRoutes = [
  "/api/auth/",
  "/api/health",
];

// Routes réservées au super admin
const superAdminRoutes = ["/admin"];

// Routes réservées aux admins d'établissement
const schoolAdminRoutes = ["/school"];

/**
 * Generate a cryptographically secure nonce using Web Crypto API
 * Compatible with Edge Runtime (unlike Node.js crypto module)
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate CSP nonce for this request (using Web Crypto API)
  const nonce = generateNonce();

  // Appliquer le rate limiting en premier
  const rateLimitResponse = await rateLimitMiddleware(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Ignorer les fichiers statiques (_next, favicon, etc.)
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") // fichiers avec extension
  ) {
    return NextResponse.next();
  }

  // Vérifier si c'est une route API
  const isApiRoute = pathname.startsWith("/api");

  // Si c'est une route API publique, autoriser
  if (isApiRoute && publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Si l'utilisateur n'est pas connecté
  if (!token) {
    // Autoriser l'accès aux routes publiques
    if (publicRoutes.some((route) => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Pour les routes API protégées, retourner 401
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Non authentifié", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Pour les pages, rediriger vers la connexion
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Vérifier si le compte est actif
  if (token.isActive === false) {
    // Rediriger vers une page de compte désactivé
    if (!pathname.startsWith("/disabled")) {
      return NextResponse.redirect(new URL("/disabled", request.url));
    }
    return NextResponse.next();
  }

  // Vérification MFA (2FA)
  if (token.isTwoFactorEnabled && !token.isTwoFactorAuthenticated) {
    // Autoriser la page de vérification et les APIs associées
    if (
      pathname === "/auth/verify-mfa" ||
      pathname.startsWith("/api/auth/mfa") ||
      pathname.startsWith("/api/auth/signout") // Allow logout
    ) {
      return NextResponse.next();
    }

    // Rediriger toute autre requête vers l'URL de vérification
    if (isApiRoute) {
      return NextResponse.json(
        { error: "MFA required", code: "MFA_REQUIRED" },
        { status: 403 }
      );
    }

    return NextResponse.redirect(new URL("/auth/verify-mfa", request.url));
  }

  // Si l'utilisateur est déjà vérifié mais tente d'accéder à la page de vérification
  if (pathname === "/auth/verify-mfa") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // PROTECTION MULTI-TENANT
  // Pour les routes API (sauf onboarding), un schoolId est requis pour les non-SuperAdmin
  if (isApiRoute && token.role !== "SUPER_ADMIN" && !token.schoolId) {
    // Exceptions pour l'onboarding ou les endpoints utilisateur génériques si nécessaire
    if (!pathname.startsWith("/api/onboarding")) {
      return NextResponse.json(
        { error: "Accès refusé : Aucun établissement associé", code: "NO_SCHOOL_ASSOCIATED" },
        { status: 403 }
      );
    }
  }

  // Si l'utilisateur est connecté et essaie d'accéder à une page publique
  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Vérifier les permissions pour les routes admin
  if (superAdminRoutes.some((route) => pathname.startsWith(route))) {
    if (token.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Vérifier les permissions pour les routes school admin
  if (schoolAdminRoutes.some((route) => pathname.startsWith(route))) {
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(token.role as string)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Add strict security headers with nonce
  const response = NextResponse.next();

  // Store nonce for use in HTML
  response.headers.set("x-nonce", nonce);

  // Enhanced CSP with nonce (no unsafe-eval/unsafe-inline)
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // Additional hardening
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
