import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H3 — le middleware identifie le client pour le rate-limit via la source
 * unique `getClientIp()` : un X-Forwarded-For fourni par le client ne choisit
 * jamais le compartiment de limitation (130 requêtes à XFF tournant → 0×429
 * avant correction).
 */

const { checkRateLimitMock } = vi.hoisted(() => ({
    checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/auth/edge", () => ({
    edgeAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
    apiLimiter: { name: "api" },
    authLimiter: { name: "auth" },
    strictLimiter: { name: "strict" },
    uploadLimiter: { name: "upload" },
    checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

const BASE = "https://edupilot.test";
const TOKEN = "c".repeat(64);

function makeRequest(pathname: string, headers: Record<string, string>) {
    return {
        nextUrl: { pathname },
        url: `${BASE}${pathname}`,
        headers: new Headers(headers),
    } as unknown as Parameters<typeof import("@/proxy").default>[0];
}

async function identifierUsedFor(pathname: string, headers: Record<string, string>): Promise<unknown> {
    const { default: proxy } = await import("@/proxy");
    await proxy(makeRequest(pathname, headers));
    return checkRateLimitMock.mock.calls[0]?.[1];
}

describe("identification du client au middleware", () => {
    beforeEach(() => {
        checkRateLimitMock.mockReset();
        checkRateLimitMock.mockResolvedValue({ success: true, remaining: 42 });
        vi.stubEnv("EDUPILOT_PEER_TOKEN", TOKEN);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("ignore un X-Forwarded-For non signé par le préchargement", async () => {
        expect(await identifierUsedFor("/api/classes", { "x-forwarded-for": "6.6.6.6" })).toBe("unknown");
    });

    it("retient l'adresse de la socket ajoutée par le préchargement", async () => {
        const identifier = await identifierUsedFor("/api/classes", {
            "x-forwarded-for": "6.6.6.6, 203.0.113.9",
            "x-edupilot-peer-token": TOKEN,
        });
        expect(identifier).toBe("203.0.113.9");
    });
});
