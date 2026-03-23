/**
 * Réponses d'erreur API standardisées
 * Garantit un format cohérent (error, code, requestId) et log via le logger structuré
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/utils/logger";

type ErrorPayload = { error: string; code?: string; details?: unknown; requestId?: string };

const requestIdHeader = "X-Request-Id";

/**
 * Génère un requestId optionnel pour tracer les requêtes (dev/test ou si header fourni).
 * Préfère X-Request-Id de la requête si présent, sinon génère un UUID si disponible.
 */
export function getOrCreateRequestId(request?: Request): string | undefined {
  const fromHeader = request?.headers?.get(requestIdHeader);
  if (fromHeader) return fromHeader;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return undefined;
}

/**
 * Réponse d'erreur standardisée avec code, message et optionnellement requestId.
 * Log l'erreur côté serveur (sans exposer de détail sensible au client).
 */
export function apiErrorResponse(
  status: number,
  payload: ErrorPayload,
  options?: { requestId?: string; logContext?: Record<string, unknown> }
): NextResponse {
  const { requestId, logContext } = options ?? {};
  const body: ErrorPayload = {
    error: payload.error,
    code: payload.code,
    ...(payload.details !== undefined && { details: payload.details }),
    ...(requestId && { requestId }),
  };

  if (status >= 500) {
    logger.error("API Error Response", undefined, {
      status,
      code: payload.code,
      requestId,
      ...logContext,
    });
  }

  const res = NextResponse.json(body, { status });
  if (requestId) {
    res.headers.set(requestIdHeader, requestId);
  }
  return res;
}

/**
 * Helper pour erreur 400 (validation) avec détails optionnels
 */
export function validationErrorResponse(
  message: string,
  details?: unknown,
  requestId?: string
): NextResponse {
  return apiErrorResponse(
    400,
    { error: message, code: "VALIDATION_ERROR", details, requestId },
    { requestId }
  );
}

/**
 * Helper pour erreur 500 (interne) — message générique côté client, détail en log
 */
export function internalErrorResponse(
  requestId?: string,
  logContext?: Record<string, unknown>
): NextResponse {
  return apiErrorResponse(
    500,
    {
      error: "Une erreur interne est survenue.",
      code: "INTERNAL_ERROR",
      requestId,
    },
    { requestId, logContext }
  );
}

/**
 * Helper pour erreur 401 (non autorisé)
 */
export function unauthorized(message: string = "Non autorisé"): NextResponse {
  return apiErrorResponse(401, { error: message, code: "UNAUTHORIZED" });
}

/**
 * Helper pour erreur 403 (accès refusé)
 */
export function forbidden(message: string = "Accès refusé"): NextResponse {
  return apiErrorResponse(403, { error: message, code: "FORBIDDEN" });
}
