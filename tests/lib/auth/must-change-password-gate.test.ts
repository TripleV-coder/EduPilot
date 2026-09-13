import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * M1 — `mustChangePassword` n'était lu ni par `authorize()` ni par le
 * middleware : un compte créé par un tiers (admin, import) restait utilisable
 * indéfiniment avec son mot de passe provisoire. Le middleware, seul point de
 * passage commun aux pages et aux 283 routes d'API, confine désormais une telle
 * session à l'écran de changement de mot de passe.
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
    return proxy(makeRequest(pathname)) as Promise<{ status: number; headers: Map<string, unknown>; json: () => Promise<unknown> }>;
}

const locationOf = (res: { headers: Map<string, unknown> }) => String(res.headers.get("location") ?? "");

describe("garde « changement de mot de passe obligatoire » du middleware (M1)", () => {
    beforeEach(() => vi.clearAllMocks());

    describe("session dont le mot de passe provisoire doit être changé", () => {
        beforeEach(() => edgeAuthMock.mockResolvedValue(session({ mustChangePassword: true })));

        it("refuse les routes d'API avec un code explicite", async () => {
            const res = await runProxy("/api/grades/report-cards");
            expect(res.status).toBe(403);
            await expect(res.json()).resolves.toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
        });

        it("refuse aussi une route d'API qui fait son auth à la main", async () => {
            const res = await runProxy("/api/finance/stats");
            expect(res.status).toBe(403);
        });

        it("redirige les pages vers /first-login", async () => {
            const res = await runProxy("/dashboard/grades");
            expect(res.status).toBe(302);
            expect(locationOf(res)).toContain("/first-login");
        });

        it("laisse ouvrir /first-login au lieu de renvoyer vers le tableau de bord", async () => {
            const res = await runProxy("/first-login");
            expect(res.status).toBe(200);
        });

        it("laisse passer /api/auth/* (changement de mot de passe, session, déconnexion)", async () => {
            const res = await runProxy("/api/auth/first-login");
            expect(res.status).toBe(200);
        });
    });

    describe("session ordinaire", () => {
        it("laisse passer quand aucun changement n'est exigé", async () => {
            edgeAuthMock.mockResolvedValue(session({ mustChangePassword: false }));
            const res = await runProxy("/api/finance/stats");
            expect(res.status).toBe(200);
        });

        it("renvoie toujours /first-login vers le tableau de bord", async () => {
            edgeAuthMock.mockResolvedValue(session({ mustChangePassword: false }));
            const res = await runProxy("/first-login");
            expect([302, 307]).toContain(res.status);
            expect(locationOf(res)).toContain("/dashboard");
        });
    });

    describe("second facteur prioritaire", () => {
        it("une session pré-2FA va d'abord vers /mfa-verify", async () => {
            edgeAuthMock.mockResolvedValue(
                session({ mustChangePassword: true, isTwoFactorEnabled: true, isTwoFactorAuthenticated: false }),
            );
            const res = await runProxy("/dashboard");
            expect(locationOf(res)).toContain("/mfa-verify");
        });
    });
});
