import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/metrics : fermé par défaut (404 sans METRICS_TOKEN), jeton porteur
 * exigé, puis exposition Prometheus de la file et des coupe-circuits.
 */
const { statsMock } = vi.hoisted(() => ({ statsMock: vi.fn() }));
vi.mock("@/lib/jobs/queue", () => ({ getJobQueueStats: statsMock }));

import { GET } from "@/app/api/metrics/route";
import { derivedSecretHex } from "@/lib/security/derived-secrets";

const TOKEN = "m".repeat(64);
const request = (authorization?: string) =>
    new Request("http://localhost:3000/api/metrics", { headers: authorization ? { authorization } : {} });

beforeEach(() => {
    statsMock.mockResolvedValue({
        PENDING: 7,
        RUNNING: 2,
        DONE: 100,
        FAILED: 1,
        oldestPendingRunAt: new Date(Date.now() - 90_000),
    });
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("GET /api/metrics", () => {
    it("n'existe pas sans METRICS_TOKEN ni secret maître", async () => {
        vi.stubEnv("METRICS_TOKEN", "");
        vi.stubEnv("NEXTAUTH_SECRET", "");
        vi.stubEnv("AUTH_SECRET", "");
        expect((await GET(request(`Bearer ${TOKEN}`))).status).toBe(404);
    });

    it("sans METRICS_TOKEN : jeton dérivé du secret maître accepté, tout autre refusé", async () => {
        vi.stubEnv("METRICS_TOKEN", "");
        vi.stubEnv("NEXTAUTH_SECRET", "m".repeat(40));
        const derived = derivedSecretHex("metrics")!;
        expect((await GET(request(`Bearer ${derived}`))).status).toBe(200);
        expect((await GET(request(`Bearer ${derivedSecretHex("cron")}`))).status).toBe(401);
    });

    it("refuse un jeton absent ou erroné", async () => {
        vi.stubEnv("METRICS_TOKEN", TOKEN);
        expect((await GET(request())).status).toBe(401);
        expect((await GET(request("Bearer mauvais"))).status).toBe(401);
    });

    it("expose la file, ses seuils et l'état de chaque coupe-circuit", async () => {
        vi.stubEnv("METRICS_TOKEN", TOKEN);
        vi.stubEnv("JOB_QUEUE_MAX", "1000");
        const res = await GET(request(`Bearer ${TOKEN}`));

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/plain; version=0.0.4");
        const text = await res.text();
        expect(text).toContain('edupilot_job_queue_size{status="pending"} 7');
        expect(text).toContain("edupilot_job_queue_capacity 1000");
        expect(text).toContain("edupilot_job_queue_reject_threshold 800");
        expect(text).toMatch(/edupilot_job_queue_oldest_pending_seconds (89|90|91)/);
        for (const circuit of ["sms", "email", "payment-momo", "payment-flutterwave", "payment-paystack", "payment-fedapay"]) {
            expect(text).toContain(`edupilot_circuit_breaker_state{circuit="${circuit}"}`);
        }
    });

    it("reste lisible quand la base ne répond pas", async () => {
        vi.stubEnv("METRICS_TOKEN", TOKEN);
        statsMock.mockRejectedValueOnce(new Error("connexion refusée"));
        const res = await GET(request(`Bearer ${TOKEN}`));
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain("edupilot_job_queue_size");
        expect(text).toContain("edupilot_requests_rejected_total");
    });
});
