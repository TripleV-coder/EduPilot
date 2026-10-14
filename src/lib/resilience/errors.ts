/**
 * Refus volontaires pour cause de surcharge. Ce ne sont pas des pannes de
 * l'application : le client doit réessayer plus tard, d'où un 503 assorti
 * d'un en-tête Retry-After (posé par `createApiHandler` et les routes de paiement).
 */
import { NextResponse } from "next/server";

export class ServiceUnavailableError extends Error {
    constructor(
        message: string,
        /** Délai conseillé avant un nouvel essai, en millisecondes. */
        readonly retryAfterMs: number,
        readonly code: string,
    ) {
        super(message);
        this.name = "ServiceUnavailableError";
    }
}

/** Service en aval coupé par son coupe-circuit : aucun appel n'est tenté. */
export class CircuitOpenError extends ServiceUnavailableError {
    constructor(readonly circuit: string, retryAfterMs: number) {
        super(`Service ${circuit} momentanément indisponible. Réessayez dans quelques instants.`, retryAfterMs, "CIRCUIT_OPEN");
        this.name = "CircuitOpenError";
    }
}

/** File d'envoi saturée (seuil de refus atteint) ou pleine. */
export class QueueSaturatedError extends ServiceUnavailableError {
    constructor(readonly reason: "saturated" | "full", retryAfterMs: number) {
        super(
            reason === "full"
                ? "La file d'envoi est pleine. Réessayez dans quelques minutes."
                : "La file d'envoi est très chargée. Réessayez dans quelques minutes.",
            retryAfterMs,
            reason === "full" ? "QUEUE_FULL" : "QUEUE_SATURATED",
        );
        this.name = "QueueSaturatedError";
    }
}

/** En-tête Retry-After en secondes entières, jamais moins d'une seconde. */
export function retryAfterSeconds(ms: number): string {
    return String(Math.max(1, Math.ceil(ms / 1000)));
}

export function serviceUnavailableResponse(error: ServiceUnavailableError): NextResponse {
    return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503, headers: { "Retry-After": retryAfterSeconds(error.retryAfterMs) } },
    );
}
