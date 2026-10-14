import { beforeEach, describe, expect, it } from "vitest";
import {
    recordApiRequest,
    recordCircuitTransition,
    recordRejection,
    renderPrometheus,
    resetMetrics,
} from "@/lib/resilience/metrics";

/** Exposition Prometheus : taille de la file, taux de rejet, état des coupe-circuits. */
beforeEach(() => resetMetrics());

const QUEUE = { pending: 120, running: 5, failed: 3, capacity: 20_000, rejectAt: 16_000, oldestPendingSeconds: 42 };

describe("renderPrometheus", () => {
    it("expose requêtes et rejets par motif (dénominateur et numérateur du taux de rejet)", () => {
        recordApiRequest();
        recordApiRequest();
        recordApiRequest();
        recordRejection("rate_limit_user");
        recordRejection("queue_full");

        const text = renderPrometheus({ queue: null, circuits: [] });
        expect(text).toContain("# TYPE edupilot_api_requests_total counter");
        expect(text).toContain("edupilot_api_requests_total 3");
        expect(text).toContain('edupilot_requests_rejected_total{reason="rate_limit_user"} 1');
        expect(text).toContain('edupilot_requests_rejected_total{reason="queue_full"} 1');
        // Motifs jamais vus exposés à 0 : rate() fonctionne dès le premier rejet.
        expect(text).toContain('edupilot_requests_rejected_total{reason="circuit_open"} 0');
    });

    it("expose la taille de la file et ses seuils", () => {
        const text = renderPrometheus({ queue: QUEUE, circuits: [] });
        expect(text).toContain('edupilot_job_queue_size{status="pending"} 120');
        expect(text).toContain('edupilot_job_queue_size{status="running"} 5');
        expect(text).toContain('edupilot_job_queue_size{status="failed"} 3');
        expect(text).toContain("edupilot_job_queue_capacity 20000");
        expect(text).toContain("edupilot_job_queue_reject_threshold 16000");
        expect(text).toContain("edupilot_job_queue_oldest_pending_seconds 42");
    });

    it("omet les jauges de file quand la base est illisible", () => {
        expect(renderPrometheus({ queue: null, circuits: [] })).not.toContain("edupilot_job_queue_size");
    });

    it("état des coupe-circuits : 0 fermé, 1 demi-ouvert, 2 ouvert ; transitions comptées", () => {
        recordCircuitTransition("sms", "closed", "open");
        recordCircuitTransition("sms", "closed", "open");
        const text = renderPrometheus({
            queue: null,
            circuits: [
                { name: "sms", state: "open" },
                { name: "email", state: "closed" },
                { name: "payment-momo", state: "half_open" },
            ],
        });
        expect(text).toContain('edupilot_circuit_breaker_state{circuit="sms"} 2');
        expect(text).toContain('edupilot_circuit_breaker_state{circuit="email"} 0');
        expect(text).toContain('edupilot_circuit_breaker_state{circuit="payment-momo"} 1');
        expect(text).toContain('edupilot_circuit_breaker_transitions_total{circuit="sms",from="closed",to="open"} 2');
    });

    it("échappe les valeurs d'étiquette et finit par un saut de ligne", () => {
        const text = renderPrometheus({ queue: null, circuits: [{ name: 'a"b\\c', state: "closed" }] });
        expect(text).toContain('edupilot_circuit_breaker_state{circuit="a\\"b\\\\c"} 0');
        expect(text.endsWith("\n")).toBe(true);
    });
});
