import { describe, expect, it, vi } from "vitest";

/**
 * Refus pour surcharge → 503 + Retry-After, que l'erreur vienne de la file
 * (saturée, pleine) ou d'un coupe-circuit ouvert, y compris levée au fond
 * d'une route `createApiHandler`.
 */
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/system/maintenance", () => ({
    getMaintenanceState: vi.fn().mockResolvedValue({ enabled: false, message: "" }),
    maintenanceBlocksRole: vi.fn().mockReturnValue(false),
}));

import type { NextRequest } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import {
    CircuitOpenError,
    QueueSaturatedError,
    ServiceUnavailableError,
    retryAfterSeconds,
    serviceUnavailableResponse,
} from "@/lib/resilience/errors";

describe("retryAfterSeconds", () => {
    it("arrondit au-dessus, jamais moins d'une seconde", () => {
        expect(retryAfterSeconds(0)).toBe("1");
        expect(retryAfterSeconds(1)).toBe("1");
        expect(retryAfterSeconds(1_001)).toBe("2");
        expect(retryAfterSeconds(30_000)).toBe("30");
    });
});

describe("erreurs de surcharge", () => {
    it("file saturée et file pleine ont chacune leur code", () => {
        expect(new QueueSaturatedError("saturated", 60_000)).toMatchObject({ code: "QUEUE_SATURATED", retryAfterMs: 60_000 });
        expect(new QueueSaturatedError("full", 60_000)).toMatchObject({ code: "QUEUE_FULL" });
        expect(new CircuitOpenError("sms", 30_000)).toMatchObject({ code: "CIRCUIT_OPEN", circuit: "sms" });
        expect(new CircuitOpenError("sms", 1)).toBeInstanceOf(ServiceUnavailableError);
    });

    it("serviceUnavailableResponse : 503, Retry-After, message et code", async () => {
        const res = serviceUnavailableResponse(new CircuitOpenError("sms", 12_500));
        expect(res.status).toBe(503);
        expect(res.headers.get("Retry-After")).toBe("13");
        expect(await res.json()).toMatchObject({ code: "CIRCUIT_OPEN", error: expect.stringContaining("sms") });
    });
});

describe("createApiHandler", () => {
    const get = () => new Request("http://localhost:3000/api/finance/reminders") as unknown as NextRequest;

    it("transforme une erreur de surcharge levée par la route en 503 + Retry-After", async () => {
        const handler = createApiHandler(
            async () => {
                throw new QueueSaturatedError("full", 120_000);
            },
            { requireAuth: false },
        );
        const res = await handler(get(), { params: Promise.resolve({}) });
        expect(res.status).toBe(503);
        expect(res.headers.get("Retry-After")).toBe("120");
        expect(await res.json()).toMatchObject({ code: "QUEUE_FULL" });
    });

    it("une autre erreur reste une 500", async () => {
        const handler = createApiHandler(
            async () => {
                throw new Error("bug");
            },
            { requireAuth: false },
        );
        const res = await handler(get(), { params: Promise.resolve({}) });
        expect(res.status).toBe(500);
    });
});
