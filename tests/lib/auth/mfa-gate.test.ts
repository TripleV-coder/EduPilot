import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Garde du second facteur au middleware.
 *
 * `authorize()` délivre volontairement une session « pré-2FA » (mot de passe
 * validé, code TOTP pas encore fourni). Avant ce garde, cette session
 * intermédiaire donnait accès à l'intégralité de l'application : seules les
 * routes passant par `createApiHandler` (75 sur 283) la bloquaient.
 */

const edgeAuthMock = vi.fn();

vi.mock("@/lib/auth/edge", () => ({
    edgeAuth: () => edgeAuthMock(),
}));

vi.mock("@/lib/rate-limit", () => ({
    apiLimiter: {},
    authLimiter: {},
    strictLimiter: {},
    uploadLimiter: {},
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 99 }),
}));

const BASE = "https://edupilot.test";

function makeRequest(pathname: string) {
    return {
        nextUrl: { pathname },
        url: `${BASE}${pathname}`,
        headers: new Map<string, string>([["x-forwarded-for", "10.0.0.1"]]),
    } as unknown as Parameters<typeof import("@/proxy").default>[0];
}

function session(over: Record<string, unknown>) {
    return {
        user: {
            id: "cuser000000000000000000001",
            role: "TEACHER",
            isTwoFactorEnabled: false,
            isTwoFactorAuthenticated: false,
            ...over,
        },
    };
}

async function runProxy(pathname: string) {
    const { default: proxy } = await import("@/proxy");
    return proxy(makeRequest(pathname));
}

function locationOf(res: unknown): string {
    const headers = (res as { headers: Map<string, unknown> }).headers;
    return String(headers.get("location") ?? "");
}

describe("garde 2FA du middleware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("session en attente de second facteur", () => {
        beforeEach(() => {
            edgeAuthMock.mockResolvedValue(
                session({ isTwoFactorEnabled: true, isTwoFactorAuthenticated: false })
            );
        });

        it("refuse une route d'API qui n'utilise pas createApiHandler", async () => {
            // /api/finance/stats fait son auth à la main : avant le garde, elle
            // répondait 200 à une session pré-2FA.
            const res = await runProxy("/api/finance/stats");

            expect((res as { status: number }).status).toBe(403);
            await expect((res as { json: () => Promise<unknown> }).json()).resolves.toMatchObject({
                code: "MFA_REQUIRED",
            });
        });

        it("refuse aussi une route d'API sensible", async () => {
            const res = await runProxy("/api/grades/report-cards");
            expect((res as { status: number }).status).toBe(403);
        });

        it("redirige les pages vers /mfa-verify en conservant la destination", async () => {
            const res = await runProxy("/dashboard/finance");

            expect((res as { status: number }).status).toBe(302);
            const location = locationOf(res);
            expect(location).toContain("/mfa-verify");
            expect(location).toContain("callbackUrl=%2Fdashboard%2Ffinance");
        });

        it("laisse passer /mfa-verify, seule sortie possible de cet état", async () => {
            const res = await runProxy("/mfa-verify");
            expect((res as { status: number }).status).toBe(200);
        });
    });

    describe("session pleinement authentifiée", () => {
        it("laisse passer quand le second facteur est validé", async () => {
            edgeAuthMock.mockResolvedValue(
                session({ isTwoFactorEnabled: true, isTwoFactorAuthenticated: true })
            );

            const res = await runProxy("/api/finance/stats");
            expect((res as { status: number }).status).toBe(200);
        });

        it("laisse passer un compte sans 2FA activé", async () => {
            edgeAuthMock.mockResolvedValue(
                session({ isTwoFactorEnabled: false, isTwoFactorAuthenticated: false })
            );

            const res = await runProxy("/api/finance/stats");
            expect((res as { status: number }).status).toBe(200);
        });
    });

    describe("routes publiques", () => {
        it("n'exige pas de session sur une route publique", async () => {
            edgeAuthMock.mockResolvedValue(null);

            const res = await runProxy("/api/public/schools");
            expect((res as { status: number }).status).toBe(200);
        });

        it("répond 401 sur une route privée sans session", async () => {
            edgeAuthMock.mockResolvedValue(null);

            const res = await runProxy("/api/finance/stats");
            expect((res as { status: number }).status).toBe(401);
        });
    });
});
