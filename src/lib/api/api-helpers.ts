/**
 * API Helpers
 * Provides comprehensive utilities for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Permission, hasPermission } from "@/lib/rbac/permissions";
import type { UserRole } from "@prisma/client";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";

// ============================================
// CUID VALIDATION
// ============================================

export function isValidCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/.test(id);
}

export function validateCuid(id: string | null | undefined, fieldName: string = "id"): string {
  if (!id) {
    throw new Error(`${fieldName} est requis`);
  }
  if (!isValidCuid(id)) {
    throw new Error(`${fieldName} invalide`);
  }
  return id;
}

export function validateCuids(ids: string[], fieldName: string = "ids"): string[] {
  if (!ids || ids.length === 0) {
    throw new Error(`${fieldName} sont requis`);
  }
  const invalidIds = ids.filter(id => !isValidCuid(id));
  if (invalidIds.length > 0) {
    throw new Error(`${fieldName} invalides: ${invalidIds.join(", ")}`);
  }
  return ids;
}

// ============================================
// FIND SEARCH HELPERS
// ============================================

export function getSearchParam(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  if (!search || search.trim().length === 0) {
    return null;
  }
  return search.trim();
}

export function createSearchFilter(search: string | null, fields: string[]) {
  if (!search) {
    return {};
  }
  return {
    OR: fields.map(field => ({
      [field]: { contains: search, mode: "insensitive" as const }
    }))
  };
}

// ============================================
// ERROR RESPONSE HELPERS
// ============================================

export interface ApiErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

export function createErrorResponse(
  error: string,
  details?: unknown,
  code?: string
): ApiErrorResponse {
  const response: ApiErrorResponse = { error };
  if (details) {
    response.details = details;
  }
  if (code) {
    response.code = code;
  }
  return response;
}

// ============================================
// TRANSLATION LOGIC (from @/lib/i18n)
// ============================================

import { t as defaultT, type TranslationFn } from "@/lib/i18n";
export { type TranslationFn };
export const t = defaultT;

export function translateError(error: any, t?: TranslationFn): { error: string; code?: string } {
    const translate = t || defaultT;
    if (typeof error === "string") return { error: translate(error) };
    if (error?.code === "P2002") {
        const fields = error.meta?.target?.join(", ") || "champ";
        return { error: translate(`Un enregistrement avec ce ${fields} existe déjà.`) };
    }
    if (error?.code === "P2025") return { error: translate("Enregistrement non trouvé.") };
    if (error?.code === "P2003") return { error: translate("Référence invalide : un enregistrement lié n'existe pas.") };
    if (error?.name === "ZodError") return { error: translate("Données invalides.") };
    if (error?.message) return { error: translate(error.message), code: error.code };
    return { error: translate("Erreur inattendue.") };
}

// ============================================
// PAGINATION HELPERS
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function getPaginationParams(
  request: NextRequest,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100 } = options;
  const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit)))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function createPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  const totalPages = Math.ceil(total / params.limit);
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
}

export function createPaginatedResponse<T>(
    data: T[],
    pageOrTotal: number,
    limitOrParams?: number | { page: number; limit: number; skip: number },
    totalArg?: number
) {
    // Override signature: (data, page, limit, total)
    if (typeof limitOrParams === "number" && typeof totalArg === "number") {
        const page = pageOrTotal;
        const limit = limitOrParams;
        const total = totalArg;
        const totalPages = Math.ceil(total / limit);
        return NextResponse.json({
            data,
            pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
        });
    }
    
    // Original signature: (data, total, PaginationParams)
    const total = pageOrTotal;
    const params = limitOrParams as PaginationParams;
    return NextResponse.json({
        data,
        pagination: createPaginationMeta(total, params),
    });
}

// ============================================
// ROUTE HANDLER (AUTH, RBAC, TENANT)
// ============================================

export function authorizeRoles(
    role: string,
    allowedRoles: string[]
): { authorized: boolean; response?: NextResponse } {
    if (allowedRoles.includes(role)) return { authorized: true };
    return { authorized: false, response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
}

export function authorizePermissions(
    role: string,
    requiredPermissions: Permission[]
): { authorized: boolean; response?: NextResponse } {
    const hasAll = requiredPermissions.every((perm) => hasPermission(role as UserRole, perm));
    if (hasAll) return { authorized: true };
    return { authorized: false, response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
}

interface HandlerContext { session: any; params?: any; }
interface HandlerOptions {
    requireAuth?: boolean;
    requiredPermissions?: Permission[];
    allowedRoles?: string[];
    rateLimit?: boolean;
}

type RouteHandler = (
    request: NextRequest,
    context: HandlerContext,
    t: TranslationFn
) => Promise<NextResponse | Response>;

export function createApiHandler(handler: RouteHandler, options: HandlerOptions = {}) {
    return async (request: NextRequest, routeContext?: any) => {
        const t = defaultT;
        try {
            const session = await auth();

            if (options.requireAuth !== false && !session?.user) {
                return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
            }

            // ── ISOLATION MULTI-TENANT STRICTE ──
            if (options.requireAuth !== false && session?.user) {
                const url = new URL(request.url);
                const querySchoolId = url.searchParams.get("schoolId");

                if (session.user.role !== "SUPER_ADMIN") {
                    const activeSchoolId = getActiveSchoolId(session);

                    if (!activeSchoolId) {
                        return NextResponse.json({ error: "Compte orphelin : aucun établissement associé." }, { status: 403 });
                    }

                    if (querySchoolId && !canAccessSchool(session, querySchoolId)) {
                        return NextResponse.json({ error: "Violation d'isolation : accès inter-tenant interdit." }, { status: 403 });
                    }
                }
            }

            if (options.requireAuth !== false && session?.user) {
                if (session.user.isTwoFactorEnabled && !session.user.isTwoFactorAuthenticated) {
                    return NextResponse.json({ error: "Code 2FA requis", code: "MFA_REQUIRED" }, { status: 403 });
                }
            }

            if (options.allowedRoles && options.allowedRoles.length > 0 && session?.user) {
                if (!options.allowedRoles.includes(session.user.role)) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            }

            if (options.requiredPermissions && options.requiredPermissions.length > 0 && session?.user) {
                const userRole = session.user.role;
                const hasAccess = options.requiredPermissions.every(
                    (perm: Permission) => hasPermission(userRole, perm)
                );
                if (!hasAccess) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            }

            return await handler(request, { session, params: routeContext?.params }, t);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("[API Error]", { path: request.url, error: message });
            return NextResponse.json(
                { error: "Une erreur interne est survenue. Veuillez réessayer.", code: "INTERNAL_ERROR" },
                { status: 500 }
            );
        }
    };
}
