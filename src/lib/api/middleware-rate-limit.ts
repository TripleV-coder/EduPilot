import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, apiLimiter, authLimiter, strictLimiter } from "@/lib/rate-limit";

/**
 * Get rate limiter based on route type
 */
export function getLimiterForRoute(pathname: string): typeof apiLimiter | typeof authLimiter | typeof strictLimiter | null {
  // Auth routes need stricter rate limiting
  if (pathname.includes("/api/auth/login") ||
    pathname.includes("/api/auth/forgot-password")) {
    return authLimiter;
  }

  // Sensitive operations need stricter rate limiting
  const sensitiveRoutes = [
    "/api/payments",
    "/api/grades",
    "/api/users",
    "/api/schools",
    "/api/upload",
  ];

  if (sensitiveRoutes.some((route) => pathname.startsWith(route))) {
    return strictLimiter;
  }

  // Default API routes
  if (pathname.startsWith("/api/")) {
    return apiLimiter;
  }

  return null;
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback for server-side requests
  return "server";
}

/**
 * Rate limiting middleware for Next.js
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for non-API routes
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  // Skip rate limiting for public API routes
  const publicApiRoutes = ["/api/auth/", "/api/health"];
  if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
    return null;
  }

  const limiter = getLimiterForRoute(pathname);
  if (!limiter) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const result = await checkRateLimit(limiter, identifier);

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset.getTime() - Date.now()) / 1000);

    return NextResponse.json(
      {
        error: "Trop de requêtes. Veuillez réessayer plus tard.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": result.reset.toISOString(),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", "100");
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set("X-RateLimit-Reset", result.reset.toISOString());

  return response;
}

const middlewareRateLimit = {
  getLimiterForRoute,
  getClientIdentifier,
  rateLimitMiddleware,
};

export default middlewareRateLimit;
