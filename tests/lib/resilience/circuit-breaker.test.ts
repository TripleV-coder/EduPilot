import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Coupe-circuit : 5 échecs consécutifs ouvrent le circuit 30 s ; pendant ce
 * temps aucun appel n'est tenté (503 rapide) ; ensuite un seul essai
 * (demi-ouvert) décide de la fermeture ou d'une nouvelle ouverture. Chaque
 * transition est journalisée et comptée.
 */
const { logMock } = vi.hoisted(() => ({ logMock: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("@/lib/utils/logger", () => ({ logger: logMock }));

import {
    CircuitBreaker,
    MemoryBreakerKV,
    circuitFetch,
    isProviderFailureStatus,
} from "@/lib/resilience/circuit-breaker";
import { circuitSettings } from "@/lib/resilience/config";
import { CircuitOpenError } from "@/lib/resilience/errors";
import { renderPrometheus, resetMetrics } from "@/lib/resilience/metrics";

const SETTINGS = { failureThreshold: 5, openMs: 30_000 };

function setup() {
    let now = 1_000_000;
    const kv = new MemoryBreakerKV(() => now);
    const breaker = new CircuitBreaker("sms-test", { kv, settings: () => SETTINGS });
    return { breaker, kv, advance: (ms: number) => (now += ms) };
}

const boom = () => Promise.reject(new Error("passerelle injoignable"));
const ok = () => Promise.resolve("ok");

async function failTimes(breaker: CircuitBreaker, n: number) {
    for (let i = 0; i < n; i++) await expect(breaker.execute(boom)).rejects.toThrow("passerelle injoignable");
}

/** Messages de transition, dans l'ordre d'émission (avertissements et infos mêlés). */
function transitions(): string[] {
    const calls = [logMock.warn, logMock.info].flatMap((fn) =>
        fn.mock.calls.map((args, i) => ({ order: fn.mock.invocationCallOrder[i], message: String(args[0]) })),
    );
    return calls
        .sort((a, b) => a.order - b.order)
        .map((call) => call.message)
        .filter((message) => message.startsWith("[circuit]"));
}

beforeEach(() => {
    vi.clearAllMocks();
    resetMetrics();
});

describe("CircuitBreaker", () => {
    it("reste fermé sous le seuil ; un succès remet la série à zéro", async () => {
        const { breaker } = setup();
        await failTimes(breaker, 4);
        expect(await breaker.state()).toBe("closed");
        await breaker.execute(ok);
        await failTimes(breaker, 4);
        expect(await breaker.state()).toBe("closed");
    });

    it("s'ouvre au 5e échec consécutif et n'appelle plus le service pendant 30 s", async () => {
        const { breaker, advance } = setup();
        await failTimes(breaker, 5);
        expect(await breaker.state()).toBe("open");

        const operation = vi.fn(ok);
        const error = await breaker.execute(operation).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).retryAfterMs).toBe(30_000);
        expect(operation).not.toHaveBeenCalled();

        advance(29_000);
        await expect(breaker.execute(operation)).rejects.toBeInstanceOf(CircuitOpenError);
        expect(operation).not.toHaveBeenCalled();
    });

    it("après 30 s : demi-ouvert, un seul essai à la fois", async () => {
        const { breaker, advance } = setup();
        await failTimes(breaker, 5);
        advance(30_001);
        expect(await breaker.state()).toBe("half_open");

        let release!: () => void;
        const probe = breaker.execute(() => new Promise<string>((resolve) => (release = () => resolve("ok"))));
        await vi.waitFor(() => expect(release).toBeDefined());

        const other = vi.fn(ok);
        await expect(breaker.execute(other)).rejects.toBeInstanceOf(CircuitOpenError);
        expect(other).not.toHaveBeenCalled();

        release();
        await expect(probe).resolves.toBe("ok");
        expect(await breaker.state()).toBe("closed");
        await expect(breaker.execute(other)).resolves.toBe("ok");
    });

    it("essai échoué : le circuit se rouvre pour 30 s", async () => {
        const { breaker, advance } = setup();
        await failTimes(breaker, 5);
        advance(30_001);
        await expect(breaker.execute(boom)).rejects.toThrow("passerelle injoignable");
        expect(await breaker.state()).toBe("open");
        advance(29_000);
        await expect(breaker.execute(ok)).rejects.toBeInstanceOf(CircuitOpenError);
    });

    it("journalise chaque transition closed → open → half_open → closed", async () => {
        const { breaker, advance } = setup();
        await failTimes(breaker, 5);
        advance(30_001);
        await breaker.execute(ok);

        expect(transitions()).toEqual([
            "[circuit] sms-test : closed → open",
            "[circuit] sms-test : open → half_open",
            "[circuit] sms-test : half_open → closed",
        ]);
        const text = renderPrometheus({ queue: null, circuits: [] });
        expect(text).toContain('edupilot_circuit_breaker_transitions_total{circuit="sms-test",from="closed",to="open"} 1');
        expect(text).toContain('edupilot_circuit_breaker_transitions_total{circuit="sms-test",from="half_open",to="closed"} 1');
    });

    it("journalise half_open → open, et l'ouverture une seule fois malgré des échecs en vol", async () => {
        const { breaker, advance } = setup();
        await failTimes(breaker, 5);
        // Des appels lancés juste avant l'ouverture échouent après : pas de nouveau journal.
        await breaker["recordFailure"](false);
        advance(30_001);
        await expect(breaker.execute(boom)).rejects.toThrow();

        expect(transitions()).toEqual([
            "[circuit] sms-test : closed → open",
            "[circuit] sms-test : open → half_open",
            "[circuit] sms-test : half_open → open",
        ]);
    });

    it("compte chaque appel refusé comme rejet circuit_open", async () => {
        const { breaker } = setup();
        await failTimes(breaker, 5);
        await breaker.execute(ok).catch(() => undefined);
        await breaker.execute(ok).catch(() => undefined);
        expect(renderPrometheus({ queue: null, circuits: [] })).toContain(
            'edupilot_requests_rejected_total{reason="circuit_open"} 2',
        );
    });

    it("une erreur qui prouve que le service répond n'est pas une panne", async () => {
        const { breaker } = setup();
        const refused = () => Promise.reject(Object.assign(new Error("adresse refusée"), { responseCode: 550 }));
        for (let i = 0; i < 10; i++) {
            await expect(breaker.execute(refused, { isFailureError: () => false })).rejects.toThrow("adresse refusée");
        }
        expect(await breaker.state()).toBe("closed");
    });

    it("ensureAvailable lève sans rien tenter quand le circuit est ouvert", async () => {
        const { breaker } = setup();
        await expect(breaker.ensureAvailable()).resolves.toBeUndefined();
        await failTimes(breaker, 5);
        await expect(breaker.ensureAvailable()).rejects.toBeInstanceOf(CircuitOpenError);
    });
});

describe("circuitFetch", () => {
    it("5xx, 429 et erreur réseau sont des pannes ; 4xx n'en est pas une", () => {
        expect(isProviderFailureStatus(500)).toBe(true);
        expect(isProviderFailureStatus(503)).toBe(true);
        expect(isProviderFailureStatus(429)).toBe(true);
        expect(isProviderFailureStatus(400)).toBe(false);
        expect(isProviderFailureStatus(404)).toBe(false);
        expect(isProviderFailureStatus(200)).toBe(false);
    });

    it("des 400 répétés n'ouvrent pas le circuit ; des 502 l'ouvrent", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch");
        const name = `fetch-test-${Math.random()}`;
        try {
            fetchMock.mockImplementation(async () => new Response("bad", { status: 400 }));
            for (let i = 0; i < 6; i++) expect((await circuitFetch(name, "https://sms.example")).status).toBe(400);

            fetchMock.mockImplementation(async () => new Response("down", { status: 502 }));
            for (let i = 0; i < 5; i++) expect((await circuitFetch(name, "https://sms.example")).status).toBe(502);

            fetchMock.mockClear();
            await expect(circuitFetch(name, "https://sms.example")).rejects.toBeInstanceOf(CircuitOpenError);
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            fetchMock.mockRestore();
        }
    });
});

describe("seuils configurables", () => {
    it("lit CIRCUIT_FAILURE_THRESHOLD et CIRCUIT_OPEN_MS", () => {
        vi.stubEnv("CIRCUIT_FAILURE_THRESHOLD", "3");
        vi.stubEnv("CIRCUIT_OPEN_MS", "10000");
        try {
            expect(circuitSettings()).toEqual({ failureThreshold: 3, openMs: 10_000 });
        } finally {
            vi.unstubAllEnvs();
        }
    });
});
