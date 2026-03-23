/**
 * API Helper Functions
 * Provides common utilities for API routes
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================
// CUID VALIDATION
// ============================================

/**
 * Check if a string is a valid CUID
 */
export function isValidCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/.test(id);
}

/**
 * Validate and sanitize a CUID parameter
 * Throws an error if invalid
 */
export function validateCuid(id: string | null | undefined, fieldName: string = "id"): string {
  if (!id) {
    throw new Error(`${fieldName} est requis`);
  }
  if (!isValidCuid(id)) {
    throw new Error(`${fieldName} invalide`);
  }
  return id;
}

/**
 * Validate multiple CUIDs at once
 */
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

/**
 * Parse and validate pagination parameters from request
 */
export function getPaginationParams(
  request: NextRequest,
  options: { defaultLimit?: number; maxLimit?: number } = {}
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100 } = options;

  // Support both real Next.js runtime (nextUrl) and test environments
  const searchParams =
    request.nextUrl?.searchParams ?? new URL(request.url).searchParams;

  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit)))
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
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

/**
 * Create a paginated response (returns NextResponse for route handlers)
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
) {
  return NextResponse.json({
    data,
    pagination: createPaginationMeta(total, params),
  });
}

// ============================================
// ERROR RESPONSE HELPERS
// ============================================

export interface ApiErrorResponse {
  error: string;
  details?: unknown;
  code?: string;
}

/**
 * Create a standardized error response
 */
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
// SEARCH HELPERS
// ============================================

/**
 * Parse search parameter from request
 */
export function getSearchParam(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  if (!search || search.trim().length === 0) {
    return null;
  }

  return search.trim();
}

/**
 * Create case-insensitive search filter for Prisma
 */
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
