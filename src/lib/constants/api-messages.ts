/**
 * Standard API Error Messages and Codes
 * Centralized source of truth for all API responses
 */

export const API_ERRORS = {
    // Authentication & Authorization
    UNAUTHENTICATED: {
        key: "api.errors.unauthenticated",
        code: "UNAUTHENTICATED"
    },
    FORBIDDEN: {
        key: "api.errors.forbidden",
        code: "FORBIDDEN"
    },
    MISSING_PERMISSIONS: {
        key: "api.errors.missing_permissions",
        code: "FORBIDDEN"
    },

    // Rate Limiting
    RATE_LIMIT_EXCEEDED: {
        key: "api.errors.rate_limit_exceeded",
        code: "RATE_LIMIT_EXCEEDED"
    },

    // Resource Errors
    NOT_FOUND: (resource: string) => ({
        key: "api.errors.not_found",
        params: { resource },
        code: "NOT_FOUND"
    }),
    ALREADY_EXISTS: (resource: string) => ({
        key: "api.errors.already_exists",
        params: { resource },
        code: "ALREADY_EXISTS"
    }),

    // Validation & Server Errors 
    INVALID_DATA: {
        key: "api.errors.invalid_data",
        code: "VALIDATION_ERROR"
    },
    INVALID_ID: {
        key: "api.errors.invalid_id",
        code: "INVALID_INPUT"
    },
    INTERNAL_ERROR: {
        key: "api.errors.internal_error",
        code: "INTERNAL_ERROR"
    },
} as const;
