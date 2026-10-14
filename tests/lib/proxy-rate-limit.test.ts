import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Limitation de débit au middleware.
 *
 * H3 — le client est identifié via la source unique `getClientIp()` : un
 * X-Forwarded-For fourni par le client ne choisit jamais le seau (130 requêtes
 * à XFF tournant → 0×429 avant correction).
 *
 * Seaux à jetons : compte connecté ET adresse IP, vérifiés ensemble ; au-delà,
 * 429 + Retry-After. Les familles sensibles (connexion, notes…) gardent leur
 * limiteur dédié en plus.
 */

const { checkRateLimitMock, consumeTokensMock } = vi.hoisted(() => ({
    checkRateLimitMock: vi.fn(),
    consumeTokensMock: vi.fn(),
}));

vi.mock("@/lib/auth/edge", () => ({
    edgeAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/rate-limit", () => ({
    authLimiter: { name: "auth" },
    strictLimiter: { name: "strict" },
    uploadLimiter: { name: "upload" },
    checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));

vi.mock("@/lib/resilience/token-bucket", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/resilience/token-bucket")>()),
    consumeTokens: (...args: unknown[]) => consumeTokensMock(...args),
}));

const BASE = "https://edupilot.test";
const TOKEN = "c".repeat(64);
const sameSchoolIp = { "x-forwarded-for": "203.0.113.9", "x-edupilot-peer-token": TOKEN };

function makeRequest(pathname: string, headers: Record<string, string>, method = "POST") {
    return {
        method,
        nextUrl: { pathname },
        url: `${BASE}${pathname}`,
        headers: new Headers(headers),
    } as unknown as Parameters<typeof import("@/proxy").default>[0];
}

type BucketSpec = { key: string; capacity: number };

function bucketKeys(): string[] {
    const specs = consumeTokensMock.mock.calls.at(-1)?.[0] as BucketSpec[] | undefined;
    return (specs ?? []).map((spec) => spec.key);
}

async function asUser(userId: string) {
    const { edgeAuth } = await import("@/lib/auth/edge");
    vi.mocked(edgeAuth as unknown as () => Promise<unknown>).mockResolvedValueOnce({
        user: { id: userId, role: "TEACHER" },
        expires: new Date(Date.now() + 60_000).toISOString(),
    });
}

async function runProxy(pathname: string, headers: Record<string, string> = sameSchoolIp, method = "POST") {
    const { default: proxy } = await import("@/proxy");
    return proxy(makeRequest(pathname, headers, method));
}

beforeEach(() => {
    checkRateLimitMock.mockReset();
    checkRateLimitMock.mockResolvedValue({ success: true, remaining: 42, reset: new Date(Date.now() + 60_000) });
    consumeTokensMock.mockReset();
    consumeTokensMock.mockResolvedValue({ allowed: true, remaining: 99, retryAfterMs: 0, deniedIndex: -1 });
    vi.stubEnv("EDUPILOT_PEER_TOKEN", TOKEN);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_RELAXED", "");
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("identification du client au middleware", () => {
    it("ignore un X-Forwarded-For non signé par le préchargement", async () => {
        await runProxy("/api/classes", { "x-forwarded-for": "6.6.6.6" });
        expect(bucketKeys()).toEqual(["tb:ip:unknown"]);
    });

    it("retient l'adresse de la socket ajoutée par le préchargement", async () => {
        await runProxy("/api/classes", { "x-forwarded-for": "6.6.6.6, 203.0.113.9", "x-edupilot-peer-token": TOKEN });
        expect(bucketKeys()).toEqual(["tb:ip:203.0.113.9"]);
    });
});

describe("seaux à jetons : compte et adresse IP", () => {
    it("un compte connecté n'est limité que par son propre seau, au quota configuré", async () => {
        vi.stubEnv("RATE_LIMIT_USER_PER_MIN", "100");
        vi.stubEnv("RATE_LIMIT_IP_PER_MIN", "1000");
        await asUser("teacher-a");
        await runProxy("/api/classes");

        // Une IP d'école ou le NAT d'un opérateur mobile porte des centaines de
        // comptes : un seau par IP les refuserait ensemble (capacité 2026-10-01).
        const specs = consumeTokensMock.mock.calls.at(-1)?.[0] as BucketSpec[];
        expect(specs.map((s) => [s.key, s.capacity])).toEqual([["tb:user:teacher-a", 100]]);
    });

    it("deux enseignants derrière la même IP d'école ont chacun leur seau", async () => {
        await asUser("teacher-a");
        await runProxy("/api/classes");
        const first = bucketKeys();
        await asUser("teacher-b");
        await runProxy("/api/classes");
        expect(first).toEqual(["tb:user:teacher-a"]);
        expect(bucketKeys()).toEqual(["tb:user:teacher-b"]);
    });

    it("répond 429 avec Retry-After (secondes, arrondi au-dessus) quand un seau est vide", async () => {
        consumeTokensMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 1_200, deniedIndex: 0 });
        await asUser("teacher-a");
        const res = await runProxy("/api/classes");

        expect(res.status).toBe(429);
        expect(res.headers.get("Retry-After")).toBe("2");
        expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(await res.json()).toMatchObject({ code: "RATE_LIMITED" });
    });

    it("compte le rejet selon le seau vidé (compte connecté ou IP anonyme)", async () => {
        const metrics = await import("@/lib/resilience/metrics");
        metrics.resetMetrics();

        consumeTokensMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 500, deniedIndex: 0 });
        await asUser("teacher-a");
        await runProxy("/api/classes");
        consumeTokensMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 500, deniedIndex: 0 });
        await runProxy("/api/auth/forgot-password");

        const text = metrics.renderPrometheus({ queue: null, circuits: [] });
        expect(text).toContain('edupilot_requests_rejected_total{reason="rate_limit_user"} 1');
        expect(text).toContain('edupilot_requests_rejected_total{reason="rate_limit_ip"} 1');
    });

    it("ne consulte pas les limiteurs suivants quand le seau refuse", async () => {
        consumeTokensMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 500, deniedIndex: 0 });
        await asUser("teacher-a");
        await runProxy("/api/grades/batch");
        expect(checkRateLimitMock).not.toHaveBeenCalled();
    });
});

describe("familles sensibles, limitées en plus", () => {
    it("les LECTURES de notes et paiements n'ont que le seau général", async () => {
        await asUser("teacher-a");
        await runProxy("/api/grades?classId=c1", sameSchoolIp, "GET");
        await runProxy("/api/payments?limit=20", sameSchoolIp, "GET");
        expect(checkRateLimitMock).not.toHaveBeenCalled();
    });

    it("les notes sont limitées par compte, pas par IP partagée", async () => {
        await asUser("teacher-a");
        await runProxy("/api/grades/batch");
        expect(checkRateLimitMock.mock.calls.at(-1)?.[1]).toBe("user:teacher-a");
    });

    it("une route publique reste limitée par IP, sans lire la session", async () => {
        const { edgeAuth } = await import("@/lib/auth/edge");
        vi.mocked(edgeAuth).mockClear();
        await runProxy("/api/auth/forgot-password");
        expect(checkRateLimitMock.mock.calls.at(-1)?.[1]).toBe("203.0.113.9");
        expect(bucketKeys()).toEqual(["tb:ip:203.0.113.9"]);
        expect(edgeAuth).not.toHaveBeenCalled();
    });

    it("le refus d'une famille sensible renvoie aussi 429 + Retry-After", async () => {
        checkRateLimitMock.mockResolvedValueOnce({ success: false, remaining: 0, reset: new Date(Date.now() + 30_000) });
        const res = await runProxy("/api/auth/forgot-password");
        expect(res.status).toBe(429);
        expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(29);
    });
});
