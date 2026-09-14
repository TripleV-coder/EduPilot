/**
 * API Helpers
 * Provides comprehensive utilities for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Permission, hasPermission, roleSatisfies } from "@/lib/rbac/permissions";
import { Prisma } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { checkRateLimit as checkUnifiedRateLimit, API_RATE_LIMIT } from "@/lib/auth/rate-limiter";
import { getMaintenanceState, maintenanceBlocksRole } from "@/lib/system/maintenance";
import { getClientIp, UNKNOWN_IP } from "@/lib/security/client-ip";
import { isZodError } from "@/lib/is-zod-error";
import { InvalidCursorError } from "@/lib/api/pagination";
import { runWithDbContext } from "@/lib/db/db-context";
import { dbContextForSession } from "@/lib/db/session-db-context";

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

type PrismaErrorShape = { code?: string; name?: string; message?: string; error?: string; key?: string; params?: unknown; meta?: { target?: string[] } };

export function translateError(error: unknown, t?: TranslationFn): { error: string; code?: string } {
    const translate = t || defaultT;
    if (typeof error === "string") return { error: translate(error) };
    const e = (error ?? {}) as PrismaErrorShape;
    if (e.code === "P2002") {
        const fields = e.meta?.target?.join(", ") || "champ";
        return { error: translate(`Un enregistrement avec ce ${fields} existe déjà.`) };
    }
    if (e.code === "P2025") return { error: translate("Enregistrement non trouvé.") };
    if (e.code === "P2003") return { error: translate("Référence invalide : un enregistrement lié n'existe pas.") };
    if (e.name === "ZodError") return { error: translate("Données invalides.") };
    if (e.key) return { error: translate(e.key, e.params as Record<string, unknown> | undefined), code: e.code };
    if (e.message) return { error: translate(e.message), code: e.code };
    if (e.error) return { error: translate(String(e.error)), code: e.code };
    return { error: translate("Erreur inattendue.") };
}

// ============================================
// PRISMA ERROR HANDLING
// ============================================

export function handlePrismaError(error: unknown): { status: number; body: { error: string; code?: string } } {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case "P2002": {
                const fields = (error.meta?.target as string[])?.join(", ") || "champ";
                return { status: 409, body: { error: `Un enregistrement avec ce ${fields} existe déjà.`, code: "DUPLICATE" } };
            }
            case "P2025":
                return { status: 404, body: { error: "Enregistrement non trouvé.", code: "NOT_FOUND" } };
            case "P2003": {
                const field = (error.meta?.field_name as string) || "référence";
                return { status: 400, body: { error: `Référence invalide : ${field} n'existe pas.`, code: "INVALID_REFERENCE" } };
            }
            case "P2014":
                return { status: 400, body: { error: "Violation de contrainte relationnelle.", code: "RELATION_VIOLATION" } };
            default:
                return { status: 500, body: { error: "Erreur de base de données.", code: error.code } };
        }
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
        return { status: 400, body: { error: "Données invalides pour la requête.", code: "VALIDATION_ERROR" } };
    }
    return { status: 500, body: { error: "Erreur inattendue." } };
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

/** Entier ≥ 1 ; valeur par défaut si absent ou non numérique (audit N16 : NaN → 500). */
function parsePositiveInt(raw: string | null, fallback: number): number {
  const value = Number.parseInt(raw ?? "", 10);
  return Number.isNaN(value) ? fallback : Math.max(1, value);
}

export function getPaginationParams(
  request: NextRequest,
  options: { defaultLimit?: number; maxLimit?: number; limitParam?: string } = {}
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100, limitParam = "limit" } = options;
  const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = Math.min(maxLimit, parsePositiveInt(searchParams.get(limitParam), defaultLimit));
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

// Rate limiting is now handled via the unified checkRateLimit from @/lib/auth/rate-limiter

// ============================================
// ROUTE HANDLER (AUTH, RBAC, TENANT)
// ============================================

export function authorizeRoles(
    role: string,
    allowedRoles: string[]
): { authorized: boolean; response?: NextResponse } {
    if (roleSatisfies(role, allowedRoles)) return { authorized: true };
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

import type { Session } from "next-auth";

/**
 * Session is typed as `Session` (non-null) because `createApiHandler` enforces
 * authentication before invoking the handler when `requireAuth !== false`.
 * Routes that explicitly opt out via `requireAuth: false` should still be
 * defensive — see individual handlers.
 *
 * `params` follows the Next 15+ convention: it's a Promise that resolves to
 * the dynamic segment values for the route.
 */
interface HandlerContext {
    session: Session;
    params: Promise<Record<string, string>>;
}
interface HandlerOptions {
    requireAuth?: boolean;
    requiredPermissions?: Permission[];
    allowedRoles?: string[];
    rateLimit?: boolean;
    rateLimitCount?: number;
    /** Taille maximale du corps de requête (octets) ; défaut DEFAULT_MAX_BODY_BYTES. */
    maxBodyBytes?: number;
}

type RouteHandler = (
    request: NextRequest,
    context: HandlerContext,
    t: TranslationFn,
) => Promise<NextResponse | Response>;

type RouteContext = { params?: Promise<Record<string, string>> };

// ============================================
// CORPS DE REQUÊTE (audit M3)
// ============================================

/** Limite par défaut du corps de requête : 1 Mo. Surchargeable par route (`maxBodyBytes`). */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type BodyInspection = "ok" | "too-large" | "invalid-json";

function isJsonContentType(request: Request): boolean {
    return (request.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

/**
 * Vérifie le corps AVANT le handler, sans le consommer (lecture d'un clone) :
 *  - Content-Length au-delà de la limite → refus sans rien lire ;
 *  - corps en flux sans Content-Length → lu jusqu'à la limite au plus ;
 *  - JSON déclaré mais syntaxiquement invalide → refus, quelle que soit la
 *    gestion d'erreurs propre au handler.
 */
async function inspectRequestBody(request: Request, limit: number): Promise<BodyInspection> {
    if (!BODY_METHODS.has(request.method) || !request.body) return "ok";

    const declared = request.headers.get("content-length");
    if (declared !== null && Number(declared) > limit) return "too-large";

    const json = isJsonContentType(request);
    if (declared !== null && !json) return "ok";

    const reader = request.clone().body!.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) {
            // Flux dupliqué par clone() : l'annulation n'aboutit qu'une fois
            // les DEUX branches annulées. La branche d'origine ne sera jamais
            // lue (413) : on l'annule aussi, ce qui libère la connexion.
            await Promise.all([
                reader.cancel().catch(() => undefined),
                request.body?.cancel().catch(() => undefined),
            ]);
            return "too-large";
        }
        if (json) chunks.push(value);
    }

    if (!json) return "ok";
    const text = new TextDecoder().decode(Buffer.concat(chunks));
    if (text.trim() === "") return "ok"; // corps vide : le handler décide
    try {
        JSON.parse(text);
        return "ok";
    } catch {
        return "invalid-json";
    }
}

function payloadTooLarge(limit: number): NextResponse {
    const megabytes = Math.round((limit / (1024 * 1024)) * 10) / 10;
    return NextResponse.json(
        { error: `Requête trop volumineuse (limite : ${megabytes} Mo).`, code: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
    );
}

function invalidJson(): NextResponse {
    return NextResponse.json(
        { error: "Le corps de la requête n'est pas un JSON valide.", code: "INVALID_JSON" },
        { status: 400 },
    );
}

export function createApiHandler(handler: RouteHandler, options: HandlerOptions = {}) {
    return async (request: NextRequest, routeContext?: RouteContext) => {
        const t = defaultT;
        try {
            // ── RATE LIMITING ──
            // Le middleware (`proxy.ts`) applique déjà un rate-limit Edge sur `/api/*`
            // et pose `x-edupilot-edge-rl=1`. On saute alors le second round-trip Redis
            // (latence x2). Les tests unitaires (Request sans middleware) gardent le
            // chemin local. Forcer via `rateLimit: true` + absence du header.
            const edgeAlreadyLimited =
                request.headers?.get?.("x-edupilot-edge-rl") === "1";
            if (options.rateLimit !== false && !edgeAlreadyLimited) {
                const ip = request.headers ? getClientIp(request.headers) : UNKNOWN_IP;
                const pathname = request.nextUrl?.pathname || (request.url ? new URL(request.url).pathname : "/api");
                const rlKey = `rl:api:${ip}:${pathname}`;
                const limitCount = options.rateLimitCount || API_RATE_LIMIT.maxAttempts;
                
                const rl = await checkUnifiedRateLimit(rlKey, {
                    ...API_RATE_LIMIT,
                    maxAttempts: limitCount
                });
                
                if (!rl.allowed) {
                    return NextResponse.json(
                        { error: "Trop de requêtes. Veuillez réessayer plus tard.", code: "TOO_MANY_REQUESTS" },
                        { status: 429, headers: { "Retry-After": "60" } }
                    );
                }
            }

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
                        return NextResponse.json({ error: "Compte orphelin : aucun établissement associé.", code: "NO_SCHOOL" }, { status: 403 });
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

            // ── MODE MAINTENANCE GLOBALE ──
            // Bloque tous les rôles sauf SUPER_ADMIN quand la maintenance est
            // active (état en cache TTL : pas de requête SQL par appel).
            if (options.requireAuth !== false && maintenanceBlocksRole(session?.user?.role)) {
                const maintenance = await getMaintenanceState();
                if (maintenance.enabled) {
                    return NextResponse.json(
                        { error: maintenance.message, code: "MAINTENANCE" },
                        { status: 503, headers: { "Retry-After": "120" } }
                    );
                }
            }

            if (options.allowedRoles && options.allowedRoles.length > 0 && session?.user) {
                if (!roleSatisfies(session.user.role, options.allowedRoles)) {
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

            // Corps vérifié après les contrôles d'accès : une requête refusée
            // n'est jamais lue.
            const bodyLimit = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
            const body = await inspectRequestBody(request, bodyLimit);
            if (body === "too-large") return payloadTooLarge(bodyLimit);
            if (body === "invalid-json") return invalidJson();

            // Contexte d'établissement transmis à PostgreSQL pour toute la
            // requête (audit M2) ; sans session, aucun : les tables sensibles
            // restent fermées, sauf contexte système déclaré par la route.
            return await runWithDbContext(dbContextForSession(session), () =>
                handler(
                    request,
                    {
                        session: session as Session,
                        params: routeContext?.params ?? Promise.resolve({}),
                    },
                    t,
                ),
            );
        } catch (error: unknown) {
            // Erreurs de validation non interceptées par le handler : faute du
            // client (400 détaillé), pas du serveur (audit M3).
            if (isZodError(error)) {
                return NextResponse.json(
                    {
                        error: "Données invalides",
                        code: "VALIDATION_ERROR",
                        details: error.issues.map((issue) => ({
                            path: issue.path.join("."),
                            message: issue.message,
                        })),
                    },
                    { status: 400 },
                );
            }
            if (error instanceof SyntaxError && /JSON/i.test(error.message)) {
                return invalidJson();
            }
            if (error instanceof InvalidCursorError) {
                return NextResponse.json({ error: error.message, code: "INVALID_CURSOR" }, { status: 400 });
            }

            const message = error instanceof Error ? error.message : String(error);
            console.error("[API Error]", { path: request.url, error: message });

            // Handle Prisma-specific errors with appropriate HTTP status codes
            if (
                error instanceof Prisma.PrismaClientKnownRequestError ||
                error instanceof Prisma.PrismaClientValidationError
            ) {
                const { status, body } = handlePrismaError(error);
                return NextResponse.json(body, { status });
            }

            return NextResponse.json(
                { error: "Une erreur interne est survenue. Veuillez réessayer.", code: "INTERNAL_ERROR" },
                { status: 500 }
            );
        }
    };
}
