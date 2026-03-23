/**
 * EduPilot - Next.js Middleware
 * Gestion globale de la sécurité, rate limiting, et authentification
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes publiques (pas d'authentification requise)
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/setup",
  "/first-login",
  "/privacy",
  "/terms",
  "/api/auth",
  "/api/system/health",
];

// Routes API sensibles nécessitant une protection renforcée
const SENSITIVE_API_ROUTES = [
  "/api/finance",
  "/api/payments",
  "/api/users",
  "/api/admin",
  "/api/root",
  "/api/compliance",
];

/**
 * Vérifier si une route est publique
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Vérifier si une route est sensible
 */
function isSensitiveRoute(pathname: string): boolean {
  return SENSITIVE_API_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Headers de sécurité globaux
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Protection XSS
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  // Référer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // HSTS (uniquement en production HTTPS)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  return response;
}

/**
 * Middleware principal
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Ajouter les headers de sécurité à toutes les réponses
  const response = NextResponse.next();
  addSecurityHeaders(response);

  // 2. Routes publiques : laisser passer
  if (isPublicRoute(pathname)) {
    return response;
  }

  // 3. Vérifier l'authentification pour les routes protégées
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // Pas de token : rediriger vers login
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    // 4. Vérification supplémentaire pour les routes sensibles
    if (isSensitiveRoute(pathname)) {
      const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"];
      
      if (!token.role || !allowedRoles.includes(token.role as string)) {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        );
      }
    }

    // 5. Ajouter des headers personnalisés pour le debugging (dev uniquement)
    if (process.env.NODE_ENV !== "production") {
      response.headers.set("X-User-Role", token.role as string || "unknown");
      response.headers.set("X-User-Id", token.sub || "unknown");
    }

    return response;
  } catch (error) {
    console.error("[Middleware] Error:", error);
    
    // En cas d'erreur, rediriger vers login par sécurité
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

/**
 * Configuration du matcher
 * Appliquer le middleware à toutes les routes sauf les fichiers statiques
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo.png (favicon files)
     * - sw.js, workbox-* (service worker files)
     * - images, fonts (static assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.png|sw.js|workbox-.*|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp|woff|woff2|ttf|otf)).*)",
  ],
};
