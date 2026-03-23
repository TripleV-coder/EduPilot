/**
 * HTTP Cache Middleware
 * Provides ETag and Cache-Control headers for API responses
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";

/**
 * Generate ETag from response body
 */
export function generateETag(body: string): string {
  const hash = createHash("md5").update(body).digest("hex");
  return `"${hash}"`;
}

/**
 * Cache options for HTTP caching
 */
export interface CacheOptions {
  maxAge?: number; // Max age in seconds (default: 300 = 5 minutes)
  staleWhileRevalidate?: number; // Stale while revalidate in seconds
  public?: boolean; // Public cache (default: true)
  private?: boolean; // Private cache (for authenticated content)
  immutable?: boolean; // Immutable content (never changes)
  mustRevalidate?: boolean; // Must revalidate before serving stale
}

/**
 * Default cache options
 */
const defaultCacheOptions: Required<CacheOptions> = {
  maxAge: 300, // 5 minutes
  staleWhileRevalidate: 60, // 1 minute
  public: true,
  private: false,
  immutable: false,
  mustRevalidate: false,
};

/**
 * Generate Cache-Control header
 */
export function generateCacheControl(options: CacheOptions = {}): string {
  const opts = { ...defaultCacheOptions, ...options };
  const directives: string[] = [];

  if (opts.private) {
    directives.push("private");
  } else if (opts.public) {
    directives.push("public");
  }

  directives.push(`max-age=${opts.maxAge}`);

  if (opts.staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${opts.staleWhileRevalidate}`);
  }

  if (opts.immutable) {
    directives.push("immutable");
  }

  if (opts.mustRevalidate) {
    directives.push("must-revalidate");
  }

  return directives.join(", ");
}

/**
 * Add cache headers to response
 */
export function addCacheHeaders(
  response: NextResponse,
  body: string,
  options: CacheOptions = {}
): NextResponse {
  // Generate ETag
  const etag = generateETag(body);
  response.headers.set("ETag", etag);

  // Generate Cache-Control
  const cacheControl = generateCacheControl(options);
  response.headers.set("Cache-Control", cacheControl);

  // Add Vary header if needed
  if (options.private) {
    response.headers.set("Vary", "Authorization");
  }

  return response;
}

/**
 * Check if request has matching ETag (304 Not Modified)
 */
export function checkETag(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get("If-None-Match");
  return ifNoneMatch === etag || ifNoneMatch === "*";
}

/**
 * Middleware for HTTP caching
 */
export async function withHttpCache<T>(
  response: NextResponse<T>,
  request: Request,
  options: CacheOptions = {}
): Promise<NextResponse<T>> {
  const body = await response.clone().text();

  // Check ETag for 304 Not Modified
  const etag = generateETag(body);
  if (checkETag(request, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": generateCacheControl(options),
      },
    }) as NextResponse<T>;
  }

  // Add cache headers
  return addCacheHeaders(response, body, options) as NextResponse<T>;
}

/**
 * Cache presets for common use cases
 */
export const cachePresets = {
  /**
   * Public static content (5 min cache, 1 min stale)
   */
  public: (): CacheOptions => ({
    maxAge: 300,
    staleWhileRevalidate: 60,
    public: true,
  }),

  /**
   * Private authenticated content (2 min cache)
   */
  private: (): CacheOptions => ({
    maxAge: 120,
    staleWhileRevalidate: 30,
    private: true,
  }),

  /**
   * Long cache for immutable content (1 hour)
   */
  immutable: (): CacheOptions => ({
    maxAge: 3600,
    immutable: true,
    public: true,
  }),

  /**
   * No cache
   */
  noCache: (): CacheOptions => ({
    maxAge: 0,
    mustRevalidate: true,
    public: false,
  }),
};
