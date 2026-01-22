/**
 * Réponses d'erreur standardisées pour les API
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/utils/logger';

export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 400 - Bad Request / Validation Error
 */
export function validationError(
  message: string = 'Données invalides',
  details?: any
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code: 'VALIDATION_ERROR',
      details: isDevelopment ? details : undefined,
      timestamp: new Date().toISOString(),
    },
    { status: 400 }
  );
}

/**
 * Helper spécifique pour les erreurs Zod
 */
export function zodValidationError(error: ZodError): NextResponse<ErrorResponse> {
  const details = error.issues.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));

  return NextResponse.json(
    {
      error: 'Erreur de validation',
      code: 'VALIDATION_ERROR',
      details: isDevelopment ? details : 'Données invalides',
      timestamp: new Date().toISOString(),
    },
    { status: 400 }
  );
}

/**
 * 401 - Unauthorized (Non authentifié)
 */
export function unauthorized(
  message: string = 'Authentification requise'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code: 'UNAUTHORIZED',
      timestamp: new Date().toISOString(),
    },
    { status: 401 }
  );
}

/**
 * 403 - Forbidden (Authentifié mais pas autorisé)
 */
export function forbidden(
  message: string = 'Accès refusé'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString(),
    },
    { status: 403 }
  );
}

/**
 * 404 - Not Found
 */
export function notFound(
  resource: string = 'Ressource'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: `${resource} introuvable`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    },
    { status: 404 }
  );
}

/**
 * 409 - Conflict
 */
export function conflict(
  message: string = 'Conflit avec une ressource existante'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code: 'CONFLICT',
      timestamp: new Date().toISOString(),
    },
    { status: 409 }
  );
}

/**
 * 429 - Too Many Requests (Rate Limit)
 */
export function tooManyRequests(
  message: string = 'Trop de requêtes',
  retryAfter?: number
): NextResponse<ErrorResponse> {
  const response = NextResponse.json(
    {
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
    { status: 429 }
  );

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * 500 - Internal Server Error
 */
export function serverError(
  message: string = 'Erreur serveur interne',
  error?: Error
): NextResponse<ErrorResponse> {
  // En développement, inclure la stack trace
  const details = isDevelopment && error
    ? {
      message: error.message,
      stack: error.stack,
    }
    : undefined;

  // Logger l'erreur
  if (error) {
    logger.error('[SERVER ERROR]', error);
  }

  return NextResponse.json(
    {
      error: message,
      code: 'INTERNAL_SERVER_ERROR',
      details,
      timestamp: new Date().toISOString(),
    },
    { status: 500 }
  );
}

/**
 * 503 - Service Unavailable
 */
export function serviceUnavailable(
  message: string = 'Service temporairement indisponible'
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: message,
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString(),
    },
    { status: 503 }
  );
}

/**
 * Helper pour gérer les erreurs Prisma
 */
export function handlePrismaError(error: any): NextResponse<ErrorResponse> {
  // Erreur de contrainte unique
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'champ';
    return conflict(`Ce ${field} existe déjà`);
  }

  // Enregistrement non trouvé
  if (error.code === 'P2025') {
    return notFound();
  }

  // Contrainte de clé étrangère
  if (error.code === 'P2003') {
    return validationError('Référence invalide');
  }

  // Erreur générique
  return serverError('Erreur de base de données', error);
}

/**
 * Wrapper pour gérer les erreurs dans les route handlers
 */
export async function withErrorHandling<T>(
  handler: () => Promise<T>
): Promise<T | NextResponse<ErrorResponse>> {
  try {
    return await handler();
  } catch (error) {
    // Erreur Zod
    if (error instanceof ZodError) {
      return zodValidationError(error);
    }

    // Erreur Prisma
    if (error && typeof error === 'object' && 'code' in error) {
      return handlePrismaError(error);
    }

    // Erreur générique
    if (error instanceof Error) {
      return serverError(undefined, error);
    }

    return serverError();
  }
}
