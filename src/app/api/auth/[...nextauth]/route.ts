import { NextRequest, NextResponse } from 'next/server';
import { GET as AuthGET, POST as AuthPOST } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  createRateLimitKey,
  LOGIN_RATE_LIMIT,
} from '@/lib/auth/rate-limiter';

/**
 * Wrapper pour POST avec rate limiting
 */
export async function POST(req: NextRequest) {
  // Appliquer rate limiting uniquement sur les tentatives de login
  const { searchParams } = new URL(req.url);
  const isSignIn = searchParams.get('nextauth')?.includes('signin');

  if (isSignIn) {
    const ip = getClientIp(req);
    const rateLimitKey = createRateLimitKey('login', ip);
    const rateLimitResult = await checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      const resetTime = new Date(rateLimitResult.resetTime);
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
          retryAfter,
          resetAt: resetTime.toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': LOGIN_RATE_LIMIT.maxAttempts.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toISOString(),
          },
        }
      );
    }

    // Ajouter les headers de rate limit pour les requêtes autorisées
    const response = await AuthPOST(req);

    // Ajouter les headers de rate limit
    response.headers.set('X-RateLimit-Limit', LOGIN_RATE_LIMIT.maxAttempts.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.resetTime).toISOString());

    return response;
  }

  // Pour les autres requêtes (callback, etc.), passer directement
  return AuthPOST(req);
}

/**
 * Passer GET sans modification
 */
export async function GET(req: NextRequest) {
  return AuthGET(req);
}
