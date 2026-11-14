import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Audit MS-03 : une réponse à une requête authentifiée ne doit jamais être
 * conservée par le navigateur (cache HTTP), quel que soit l'en-tête posé par
 * la route (`private, max-age=…` laissait resservir la réponse d'un autre
 * compte ou de l'école précédente sans interroger le serveur).
 */
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/system/maintenance", () => ({
    getMaintenanceState: vi.fn().mockResolvedValue({ enabled: false, message: "" }),
    maintenanceBlocksRole: vi.fn().mockReturnValue(false),
}));

import { createApiHandler } from "@/lib/api/api-helpers";

const SESSION = {
    user: {
        id: "cuser000000000000000000001",
        role: "SCHOOL_ADMIN",
        schoolId: "cschool00000000000000000001",
        accessibleSchoolIds: ["cschool00000000000000000001"],
        isTwoFactorEnabled: false,
        isTwoFactorAuthenticated: false,
    },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
};

const get = (path = "/api/classes") => new Request(`http://localhost:3000${path}`) as unknown as NextRequest;

beforeEach(() => {
    authMock.mockReset();
});

describe("createApiHandler — aucune conservation des réponses privées", () => {
    it("réponse authentifiée sans en-tête : private, no-store", async () => {
        authMock.mockResolvedValue(SESSION);
        const handler = createApiHandler(async () => NextResponse.json({ classes: ["6e A"] }));
        const res = await handler(get(), { params: Promise.resolve({}) });
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("la route demandait un max-age : remplacé par private, no-store", async () => {
        authMock.mockResolvedValue(SESSION);
        const handler = createApiHandler(async () =>
            NextResponse.json({ total: 1 }, { headers: { "Cache-Control": "private, max-age=3600" } }),
        );
        const res = await handler(get(), { params: Promise.resolve({}) });
        expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("flux SSE : no-transform conservé (pas de mise en tampon par un proxy)", async () => {
        authMock.mockResolvedValue(SESSION);
        const handler = createApiHandler(async () =>
            new Response("data: {}\n\n", { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } }),
        );
        const res = await handler(get("/api/notifications/stream"), { params: Promise.resolve({}) });
        expect(res.headers.get("Cache-Control")).toBe("private, no-store, no-transform");
    });

    it("route publique sans session : en-tête de la route conservé", async () => {
        authMock.mockResolvedValue(null);
        const handler = createApiHandler(
            async () => NextResponse.json({ plans: [] }, { headers: { "Cache-Control": "public, max-age=60" } }),
            { requireAuth: false },
        );
        const res = await handler(get("/api/public/plans"), { params: Promise.resolve({}) });
        expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
    });
});
