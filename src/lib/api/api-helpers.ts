/**
 * API Helpers - Re-export and additional utilities
 * Provides createApiHandler, translateError, and re-exports from utils/api-helpers
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Permission, hasPermission } from "@/lib/rbac/permissions";
export { getPaginationParams, validateCuid, isValidCuid, createErrorResponse } from "@/lib/utils/api-helpers";
import { createPaginatedResponse as _createPaginatedResponse } from "@/lib/utils/api-helpers";
import type { UserRole } from "@prisma/client";

/**
 * Overloaded createPaginatedResponse that accepts either:
 * - (data, total, PaginationParams) — original signature
 * - (data, page, limit, total) — convenience signature used by routes
 */
export function createPaginatedResponse<T>(
    data: T[],
    pageOrTotal: number,
    limitOrParams?: number | { page: number; limit: number; skip: number },
    totalArg?: number
) {
    if (typeof limitOrParams === "number" && typeof totalArg === "number") {
        // (data, page, limit, total)
        const page = pageOrTotal;
        const limit = limitOrParams;
        const total = totalArg;
        const totalPages = Math.ceil(total / limit);
        return NextResponse.json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        });
    }
    // (data, total, PaginationParams)
    return _createPaginatedResponse(data, pageOrTotal, limitOrParams as any);
}

/**
 * authorizeRoles — Check if a user role is in the allowed roles list
 */
export function authorizeRoles(
    role: string,
    allowedRoles: string[]
): { authorized: boolean; response?: NextResponse } {
    if (allowedRoles.includes(role)) {
        return { authorized: true };
    }
    return {
        authorized: false,
        response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    };
}

/**
 * authorizePermissions — Check if a user role has all required permissions
 */
export function authorizePermissions(
    role: string,
    requiredPermissions: Permission[]
): { authorized: boolean; response?: NextResponse } {
    const hasAll = requiredPermissions.every((perm) =>
        hasPermission(role as UserRole, perm)
    );
    if (hasAll) {
        return { authorized: true };
    }
    return {
        authorized: false,
        response: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    };
}

interface HandlerContext {
    session: any;
    params?: any;
}

interface HandlerOptions {
    requireAuth?: boolean;
    requiredPermissions?: Permission[];
    allowedRoles?: string[];
    rateLimit?: boolean;
}

// Translation logic moved to @/lib/i18n
import { t as defaultT, type TranslationFn } from "@/lib/i18n";
export { type TranslationFn };
export const t = defaultT;

type RouteHandler = (
    request: NextRequest,
    context: HandlerContext,
    t: TranslationFn
) => Promise<NextResponse | Response>;

/**
 * Create a standardized API handler with auth, RBAC, and error handling
 */
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
                const isRootApi = url.pathname.startsWith("/api/root");

                if (session.user.role === "SUPER_ADMIN") {
                    // Le SUPER_ADMIN peut naviguer sans schoolId (Plan Global)
                    // Il n'est pas bloqué par l'isolation de tenant car il gère l'infrastructure.
                    // La restriction d'accès aux données se fait au niveau des handlers spécifiques.
                } else {
                    // PLAN TENANT : SCHOOL_ADMIN, TEACHER, etc.
                    // Ils doivent impérativement avoir un schoolId lié à leur compte
                    if (!session.user.schoolId) {
                        return NextResponse.json({ error: "Compte orphelin : aucun établissement associé." }, { status: 403 });
                    }

                    // Tentative d'accès à une autre école
                    if (querySchoolId && querySchoolId !== session.user.schoolId) {
                        return NextResponse.json({ error: "Violation d'isolation : accès inter-tenant interdit." }, { status: 403 });
                    }
                }
            }

            // Check 2FA pour les routes nécessitant authentification
            if (options.requireAuth !== false && session?.user) {
                if (session.user.isTwoFactorEnabled && !session.user.isTwoFactorAuthenticated) {
                    return NextResponse.json({ error: "Code 2FA requis", code: "MFA_REQUIRED" }, { status: 403 });
                }
            }

            // Check roles if allowedRoles is specified
            if (options.allowedRoles && options.allowedRoles.length > 0 && session?.user) {
                if (!options.allowedRoles.includes(session.user.role)) {
                    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
                }
            }

            // Check permissions — logique AND : l'utilisateur doit posséder TOUTES les permissions listées.
            // Utiliser allowedRoles si vous souhaitez une logique OR (l'un ou l'autre suffit).
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
            // Log l'erreur interne sans l'exposer au client
            const message = error instanceof Error ? error.message : String(error);
            console.error("[API Error]", { path: request.url, error: message });
            return NextResponse.json(
                { error: "Une erreur interne est survenue. Veuillez réessayer.", code: "INTERNAL_ERROR" },
                { status: 500 }
            );
        }
    };
}

/**
 * Translate error messages - accepts (error, t?) for i18n-ready API responses
 */
export function translateError(error: any, t?: TranslationFn): { error: string; code?: string } {
    const translate = t || defaultT;

    if (typeof error === "string") {
        return { error: translate(error) };
    }

    if (error?.code === "P2002") {
        const fields = error.meta?.target?.join(", ") || "champ";
        return { error: translate(`Un enregistrement avec ce ${fields} existe déjà.`) };
    }
    if (error?.code === "P2025") {
        return { error: translate("Enregistrement non trouvé.") };
    }
    if (error?.code === "P2003") {
        return { error: translate("Référence invalide : un enregistrement lié n'existe pas.") };
    }
    if (error?.name === "ZodError") {
        return { error: translate("Données invalides.") };
    }

    // Handle API_ERRORS objects { message, code }
    if (error?.message) {
        return { error: translate(error.message), code: error.code };
    }

    return { error: translate("Erreur inattendue.") };
}
