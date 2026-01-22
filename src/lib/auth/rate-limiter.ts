/**
 * Rate Limiter pour l'authentification
 * Protège contre les attaques par force brute
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Stockage en mémoire des tentatives de connexion
 * En production, utiliser Redis pour le partage entre instances
 */
class InMemoryStore {
  private store = new Map<string, RateLimitEntry>();

  /**
   * Nettoyer les entrées expirées (toutes les 5 minutes)
   */
  constructor() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetTime < now) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetTime < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, value: RateLimitEntry): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

const store = new InMemoryStore();

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Fenêtre de temps en millisecondes
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Vérifier si une requête est autorisée selon le rate limit
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry) {
    // Première tentative
    const resetTime = now + config.windowMs;
    store.set(identifier, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetTime,
    };
  }

  if (entry.count >= config.maxAttempts) {
    // Limite atteinte
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Incrémenter le compteur
  entry.count++;
  store.set(identifier, entry);

  return {
    allowed: true,
    remaining: config.maxAttempts - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Réinitialiser le compteur pour un identifiant
 */
export function resetRateLimit(identifier: string): void {
  store.delete(identifier);
}

/**
 * Configuration par défaut pour le login
 */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * Configuration pour le forgot password
 */
export const FORGOT_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * Configuration pour les API générales
 */
export const API_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 100,
  windowMs: 60 * 1000, // 1 minute
};

/**
 * Helper pour extraire l'IP d'une requête
 */
export function getClientIp(request: Request): string {
  // Essayer différentes sources d'IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback sur une valeur par défaut si aucune IP n'est trouvée
  return 'unknown';
}

/**
 * Créer un identifiant unique pour le rate limiting
 */
export function createRateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}
