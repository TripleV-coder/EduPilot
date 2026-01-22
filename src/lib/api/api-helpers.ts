import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, apiLimiter } from "@/lib/rate-limit";
import { sanitizeRequestBody } from "@/lib/sanitize";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { Permission, hasPermission } from "@/lib/rbac/permissions";
import { UserRole } from "@prisma/client";

/**
 * Validate path ID using Zod
 */
export function validateId(id: string, fieldName = "ID"): string {
  try {
    return z.string().cuid().parse(id);
  } catch {
    throw new Error(`${fieldName} invalide`);
  }
}

/**
 * Parse and sanitize request body
 */
export async function parseAndSanitizeBody(request: NextRequest): Promise<any> {
  const contentType = request.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return null;
  }

  try {
    const body = await request.json();
    return sanitizeRequestBody(body);
  } catch {
    return null;
  }
}

/**
 * Rate limiting wrapper for API routes
 */
export async function withRateLimit(
  request: NextRequest,
  limiter: typeof apiLimiter = apiLimiter
): Promise<{ success: boolean; remaining: number; reset: Date } | null> {
  // Skip rate limiting for public routes
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/health")) {
    return null;
  }

  const identifier = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return await checkRateLimit(limiter, identifier);
}

import { API_ERRORS } from "@/lib/constants/api-messages";

/**
 * Create rate-limited response
 */
export function createRateLimitResponse(retryAfter: number = 60) {
  return NextResponse.json(
    API_ERRORS.RATE_LIMIT_EXCEEDED,
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Authenticate request with session
 */
export async function authenticateRequest(_request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json(API_ERRORS.UNAUTHENTICATED, { status: 401 }) };
  }

  return { session };
}

/**
 * Check role authorization
 */
export function authorizeRoles(userRole: string, allowedRoles: string[]): { authorized: boolean; response?: NextResponse } {
  if (!allowedRoles.includes(userRole)) {
    return {
      authorized: false,
      response: NextResponse.json(
        API_ERRORS.FORBIDDEN,
        { status: 403 }
      ),
    };
  }
  return { authorized: true };
}

/**
 * Check permission authorization
 */
export function authorizePermissions(userRole: UserRole, requiredPermissions: Permission[]): { authorized: boolean; response?: NextResponse } {
  // Check if user has ALL required permissions
  const hasAccess = requiredPermissions.every(permission => hasPermission(userRole, permission));

  if (!hasAccess) {
    return {
      authorized: false,
      response: NextResponse.json(
        API_ERRORS.MISSING_PERMISSIONS,
        { status: 403 }
      ),
    };
  }
  return { authorized: true };
}

/**
 * Get pagination params from request
 */
export function getPaginationParams(request: NextRequest, options: { defaultLimit?: number; maxLimit?: number } = {}) {
  const { defaultLimit = 20, maxLimit = 100 } = options;
  const searchParams = request.nextUrl.searchParams;

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") || defaultLimit.toString())));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(data: T[], page: number, limit: number, total: number) {
  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  });
}

/**
 * Log API request
 */
export function logApiRequest(method: string, path: string, userId?: string, duration?: number) {
  logger.info("API Request", {
    method,
    path,
    userId,
    duration: duration ? `${duration}ms` : undefined,
  });
}

/**
 * Log API error securely
 */
export function logApiError(method: string, path: string, error: unknown, userId?: string) {
  // const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const errorCode = error instanceof Error ? error.constructor.name : "Unknown";

  logger.error(`API Error: ${method} ${path}`, undefined, {
    method,
    path,
    userId,
    errorCode,
    // Log error stack trace in development and test
    ...((process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") && error instanceof Error ? { stack: error.stack } : {}),
  });
}

/**
 * Safe async handler wrapper with error handling
 */
import { getTranslations } from "next-intl/server";

export function translateError(errorObj: any, t: any) {
  if (errorObj && typeof errorObj === 'object' && 'key' in errorObj) {
    return {
      error: t(errorObj.key, errorObj.params || {}),
      code: errorObj.code
    };
  }
  return errorObj;
}

/**
 * Safe async handler wrapper with error handling
 */
export function createApiHandler<T>(
  handler: (request: NextRequest, context?: any, t?: any) => Promise<T>,
  options: {
    methods?: string[];
    requireAuth?: boolean;
    allowedRoles?: string[];
    requiredPermissions?: Permission[];
    rateLimit?: boolean;
  } = {}
) {
  return async function (request: NextRequest, context?: any) {
    const startTime = Date.now();
    let t: any;
    try {
      t = await getTranslations('api.errors');
    } catch (_e) {
      // Fallback if getTranslations fails (e.g. edge or other issue), though it shouldn't on server
      t = (key: string) => key;
    }

    try {
      // Rate limiting
      if (options.rateLimit !== false) {
        const rateLimit = await withRateLimit(request);
        if (rateLimit && !rateLimit.success) {
          const retryAfter = Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000);
          return NextResponse.json(
            translateError(API_ERRORS.RATE_LIMIT_EXCEEDED, t),
            {
              status: 429,
              headers: {
                "Retry-After": retryAfter.toString(),
                "X-RateLimit-Limit": "100",
                "X-RateLimit-Remaining": "0",
              },
            }
          );
        }
      }

      // Authentication
      if (options.requireAuth !== false) {
        const auth = await authenticateRequest(request);
        if ("error" in auth) {
          return auth.error;
        }
        context = { ...context, session: auth.session };
      }

      // Role authorization
      if (options.allowedRoles && context.session?.user?.role) {
        const { authorized, response } = authorizeRoles(context.session.user.role, options.allowedRoles);
        if (!authorized) return response!;
      }

      // Permission authorization
      if (options.requiredPermissions && context.session?.user?.role) {
        const { authorized, response } = authorizePermissions(context.session.user.role as UserRole, options.requiredPermissions);
        if (!authorized) return response!;
      }

      // Execute handler
      const response = await handler(request, context, t);

      // Log request
      const duration = Date.now() - startTime;
      logApiRequest(request.method, request.nextUrl.pathname, context.session?.user?.id, duration);

      return response;
    } catch (error) {
      // Log error
      logApiError(request.method, request.nextUrl.pathname, error, context.session?.user?.id);

      // Return safe error response
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { ...translateError(API_ERRORS.INVALID_DATA, t), details: error.issues },
          { status: 400 }
        );
      }

      if (error instanceof Error && error.message.includes("invalide")) {
        return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: 400 });
      }

      return NextResponse.json(
        translateError(API_ERRORS.INTERNAL_ERROR, t),
        { status: 500 }
      );
    }
  };
}

/**
 * Parse boolean query param
 */
export function parseBoolean(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  return value.toLowerCase() === "true";
}

/**
 * Parse array query param
 */
export function parseArrayParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

/**
 * Build Prisma where clause from search params
 */
export function buildSearchFilter(
  searchParams: URLSearchParams,
  searchFields: string[]
): Record<string, any> {
  const search = searchParams.get("search");
  if (!search) return {};

  return {
    OR: searchFields.map((field) => ({
      [field]: { contains: search, mode: "insensitive" },
    })),
  };
}

const apiHelpers = {
  validateId,
  parseAndSanitizeBody,
  withRateLimit,
  createRateLimitResponse,
  authenticateRequest,
  authorizeRoles,
  getPaginationParams,
  createPaginatedResponse,
  logApiRequest,
  logApiError,
  createApiHandler,
  parseBoolean,
  parseArrayParam,
  buildSearchFilter,
};

export default apiHelpers;
