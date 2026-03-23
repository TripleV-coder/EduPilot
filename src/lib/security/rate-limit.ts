/**
 * Simple in-memory rate limiter
 * For production, use Redis-based solution
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    default: { windowMs: 60000, maxRequests: 100 },       // 100 req/min
    auth: { windowMs: 300000, maxRequests: 10 },          // 10 attempts per 5 min
    ai: { windowMs: 60000, maxRequests: 20 },             // 20 AI calls/min
    payments: { windowMs: 60000, maxRequests: 30 },       // 30 payment ops/min
};

export function checkRateLimit(
    identifier: string,
    configKey: keyof typeof RATE_LIMIT_CONFIGS = 'default'
): { allowed: boolean; remaining: number; resetIn: number } {
    const config = RATE_LIMIT_CONFIGS[configKey];
    const now = Date.now();
    const key = `${configKey}:${identifier}`;

    let entry = rateLimitStore.get(key);

    // Clean up or initialize
    if (!entry || now > entry.resetTime) {
        entry = { count: 0, resetTime: now + config.windowMs };
        rateLimitStore.set(key, entry);
    }

    entry.count++;

    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetIn = Math.max(0, entry.resetTime - now);

    return { allowed, remaining, resetIn };
}

export function getRateLimitHeaders(
    result: { remaining: number; resetIn: number },
    configKey: keyof typeof RATE_LIMIT_CONFIGS = 'default'
): Record<string, string> {
    const config = RATE_LIMIT_CONFIGS[configKey];
    return {
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000)),
    };
}

// Cleanup old entries periodically (every 5 minutes)
const _cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 300000);
// Eviter de bloquer le processus Node.js si plus rien d'autre ne tourne
if (_cleanupInterval.unref) _cleanupInterval.unref();
