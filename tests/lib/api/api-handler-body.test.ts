import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * M3 — `POST /api/classes` avec `{}` ou `{bad` renvoyait 500 INTERNAL_ERROR ;
 * un corps de 5 Mo était lu puis rejeté par Zod (pression mémoire).
 * createApiHandler traite désormais, pour toutes les routes :
 *   - JSON syntaxiquement invalide → 400 INVALID_JSON (le handler n'est pas appelé) ;
 *   - ZodError non interceptée → 400 VALIDATION_ERROR avec le détail des champs ;
 *   - corps au-delà de la limite → 413 PAYLOAD_TOO_LARGE, limite surchargeable.
 */

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/system/maintenance", () => ({
    getMaintenanceState: vi.fn().mockResolvedValue({ enabled: false, message: "" }),
    maintenanceBlocksRole: vi.fn().mockReturnValue(false),
}));

import { createApiHandler, DEFAULT_MAX_BODY_BYTES } from "@/lib/api/api-helpers";
import type { NextRequest } from "next/server";

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

function post(body: BodyInit, headers: Record<string, string> = {}): NextRequest {
    return new Request("http://localhost:3000/api/classes", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body,
        // @ts-expect-error — option Node (undici) requise pour un corps en flux
        duplex: "half",
    }) as unknown as NextRequest;
}

function streamOf(totalBytes: number): ReadableStream<Uint8Array> {
    const chunk = new Uint8Array(64 * 1024).fill(0x20);
    let sent = 0;
    return new ReadableStream({
        pull(controller) {
            if (sent >= totalBytes) return controller.close();
            controller.enqueue(chunk);
            sent += chunk.byteLength;
        },
    });
}

const schema = z.object({ name: z.string().min(1), capacity: z.number().int() });

describe("createApiHandler — corps de requête", () => {
    beforeEach(() => {
        authMock.mockResolvedValue(SESSION);
    });

    it("renvoie 400 INVALID_JSON sur un JSON cassé, sans appeler le handler", async () => {
        const handler = vi.fn();
        const res = await createApiHandler(handler)(post("{bad"));

        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_JSON");
        expect(handler).not.toHaveBeenCalled();
    });

    it("renvoie 400 VALIDATION_ERROR détaillé quand le handler laisse remonter une ZodError", async () => {
        const res = await createApiHandler(async (request) => {
            schema.parse(await request.json());
            return new Response("jamais atteint");
        })(post("{}"));

        const body = await res.json();
        expect(res.status).toBe(400);
        expect(body.code).toBe("VALIDATION_ERROR");
        expect(body.details.map((d: { path: string }) => d.path).sort()).toEqual(["capacity", "name"]);
    });

    it("laisse passer un JSON valide jusqu'au handler, qui peut encore le lire", async () => {
        const res = await createApiHandler(async (request) => {
            const data = schema.parse(await request.json());
            return Response.json({ received: data.name });
        })(post(JSON.stringify({ name: "6e A", capacity: 40 })));

        expect(res.status).toBe(200);
        expect((await res.json()).received).toBe("6e A");
    });

    it("renvoie 413 quand Content-Length dépasse la limite, sans appeler le handler", async () => {
        const handler = vi.fn();
        const res = await createApiHandler(handler)(
            post("{}", { "content-length": String(DEFAULT_MAX_BODY_BYTES + 1) }),
        );

        expect(res.status).toBe(413);
        expect((await res.json()).code).toBe("PAYLOAD_TOO_LARGE");
        expect(handler).not.toHaveBeenCalled();
    });

    it("renvoie 413 pour un corps en flux sans Content-Length qui dépasse la limite", async () => {
        const handler = vi.fn();
        const res = await createApiHandler(handler)(post(streamOf(DEFAULT_MAX_BODY_BYTES + 128 * 1024)));

        expect(res.status).toBe(413);
        expect(handler).not.toHaveBeenCalled();
    });

    it("applique une limite propre à la route quand elle est déclarée", async () => {
        const big = JSON.stringify({ name: "x".repeat(DEFAULT_MAX_BODY_BYTES + 10), capacity: 1 });
        const res = await createApiHandler(
            async (request) => Response.json({ size: JSON.stringify(await request.json()).length }),
            { maxBodyBytes: 4 * DEFAULT_MAX_BODY_BYTES },
        )(post(big));

        expect(res.status).toBe(200);
    });

    it("n'impose rien aux requêtes sans corps", async () => {
        const res = await createApiHandler(async () => Response.json({ ok: true }))(
            new Request("http://localhost:3000/api/classes") as unknown as NextRequest,
        );

        expect(res.status).toBe(200);
    });
});
