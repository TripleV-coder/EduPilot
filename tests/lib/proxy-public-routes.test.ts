import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H1 / H2 — le middleware bloquait par 401 « Non authentifié » :
 *  - /api/health : le healthcheck Docker ne passait jamais ;
 *  - /api/system/automation et /api/system/retention : les crons n'atteignaient
 *    jamais leur propre contrôle CRON_SECRET.
 * Ces routes doivent être ouvertes au middleware — et elles SEULES : les
 * sous-routes de /api/health contiennent des données de santé.
 */

vi.mock("@/lib/auth/edge", () => ({
    edgeAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
    apiLimiter: { name: "api" },
    authLimiter: { name: "auth" },
    strictLimiter: { name: "strict" },
    uploadLimiter: { name: "upload" },
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 99 }),
}));

function makeRequest(pathname: string) {
    return {
        nextUrl: { pathname },
        url: `https://edupilot.test${pathname}`,
        headers: new Headers(),
    } as unknown as Parameters<typeof import("@/proxy").default>[0];
}

async function anonymousStatus(pathname: string): Promise<number> {
    const { default: proxy } = await import("@/proxy");
    const res = await proxy(makeRequest(pathname));
    return res.status;
}

describe("routes ouvertes au middleware sans session", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        "/api/health",
        "/api/system/automation",
        "/api/system/retention",
    ])("%s atteint son handler", async (pathname) => {
        expect(await anonymousStatus(pathname)).not.toBe(401);
    });

    it.each([
        "/api/health/medical-records",
        "/api/health/vaccinations",
        "/api/health/emergency-contacts",
        "/api/healthcheck-inexistant",
        "/api/system/backup",
        "/api/system/health",
        "/api/system/automation-admin",
    ])("%s reste bloquée sans session", async (pathname) => {
        expect(await anonymousStatus(pathname)).toBe(401);
    });
});
