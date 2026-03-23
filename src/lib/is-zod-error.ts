import { ZodError } from "zod";

/**
 * Type guard: checks if an error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
    return error instanceof ZodError || (error as any)?.name === "ZodError";
}
