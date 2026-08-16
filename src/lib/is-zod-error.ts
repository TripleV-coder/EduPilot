import { ZodError } from "zod";

/**
 * Type guard: checks if an error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
    return error instanceof ZodError || (typeof error === "object" && error !== null && "name" in error && (error as { name?: unknown }).name === "ZodError");
}
