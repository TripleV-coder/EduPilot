import { afterEach, describe, expect, it, vi } from "vitest";

/** Seuils de la protection contre la surcharge : défauts, surcharge par variable, valeurs invalides. */
const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }));
vi.mock("@/lib/utils/logger", () => ({ logger: { warn: warnMock, info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { circuitSettings, queueSettings, rateLimitSettings } from "@/lib/resilience/config";

afterEach(() => {
    vi.unstubAllEnvs();
    warnMock.mockReset();
});

describe("seuils par défaut", () => {
    it("100/min par compte, 1 000/min par IP en production", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("RATE_LIMIT_RELAXED", "");
        expect(rateLimitSettings()).toEqual({ userPerMinute: 100, ipPerMinute: 1000 });
    });

    it("file : 20 000 places, refus à 80 %, 5 en parallèle, 600 envois/min", () => {
        expect(queueSettings()).toEqual({ maxSize: 20_000, rejectRatio: 0.8, concurrency: 5, ratePerMinute: 600 });
    });

    it("coupe-circuit : 5 échecs, 30 s", () => {
        expect(circuitSettings()).toEqual({ failureThreshold: 5, openMs: 30_000 });
    });
});

describe("variables d'environnement", () => {
    it("chaque seuil est réglable", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("RATE_LIMIT_USER_PER_MIN", "50");
        vi.stubEnv("RATE_LIMIT_IP_PER_MIN", "500");
        vi.stubEnv("JOB_QUEUE_MAX", "1000");
        vi.stubEnv("JOB_QUEUE_REJECT_RATIO", "0.5");
        vi.stubEnv("JOB_WORKER_CONCURRENCY", "2");
        vi.stubEnv("JOB_WORKER_RATE_PER_MIN", "60");
        vi.stubEnv("CIRCUIT_FAILURE_THRESHOLD", "3");
        vi.stubEnv("CIRCUIT_OPEN_MS", "5000");

        expect(rateLimitSettings()).toEqual({ userPerMinute: 50, ipPerMinute: 500 });
        expect(queueSettings()).toEqual({ maxSize: 1000, rejectRatio: 0.5, concurrency: 2, ratePerMinute: 60 });
        expect(circuitSettings()).toEqual({ failureThreshold: 3, openMs: 5000 });
    });

    it("une valeur invalide retombe sur le défaut (protection jamais désactivée) et le signale", () => {
        vi.stubEnv("JOB_QUEUE_MAX", "beaucoup");
        vi.stubEnv("JOB_QUEUE_REJECT_RATIO", "1.5");
        vi.stubEnv("CIRCUIT_OPEN_MS", "10");
        expect(queueSettings().maxSize).toBe(20_000);
        expect(queueSettings().rejectRatio).toBe(0.8);
        expect(circuitSettings().openMs).toBe(30_000);
        expect(warnMock).toHaveBeenCalled();
    });

    it("développement ou RATE_LIMIT_RELAXED : quotas ×5", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("RATE_LIMIT_RELAXED", "true");
        expect(rateLimitSettings()).toEqual({ userPerMinute: 500, ipPerMinute: 5000 });
    });
});
