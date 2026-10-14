/**
 * Compteurs Prometheus de la protection contre la surcharge, sans dépendance.
 *
 * Les compteurs sont par processus, comme le veut Prometheus : chaque pod est
 * interrogé séparément et `sum()` agrège. Ce n'est pas un état applicatif :
 * aucune décision (quota, file, circuit) n'en dépend, elles lisent Redis ou la base.
 *
 * Le registre est accroché à `globalThis` : le proxy et les routes sont
 * empaquetés séparément par Next.js, et sans cela chacun aurait le sien.
 */

export type RejectionReason = "rate_limit_user" | "rate_limit_ip" | "queue_saturated" | "queue_full" | "circuit_open";

export type CircuitStateName = "closed" | "open" | "half_open";

interface Registry {
    apiRequests: number;
    rejections: Map<RejectionReason, number>;
    transitions: Map<string, number>;
}

const globalForMetrics = globalThis as unknown as { __edupilotResilienceMetrics?: Registry };

function registry(): Registry {
    globalForMetrics.__edupilotResilienceMetrics ??= { apiRequests: 0, rejections: new Map(), transitions: new Map() };
    return globalForMetrics.__edupilotResilienceMetrics;
}

/** Chaque requête d'API vue par le proxy : dénominateur du taux de rejet. */
export function recordApiRequest(): void {
    registry().apiRequests += 1;
}

export function recordRejection(reason: RejectionReason): void {
    const { rejections } = registry();
    rejections.set(reason, (rejections.get(reason) ?? 0) + 1);
}

export function recordCircuitTransition(circuit: string, from: CircuitStateName, to: CircuitStateName): void {
    const { transitions } = registry();
    const key = JSON.stringify([circuit, from, to]);
    transitions.set(key, (transitions.get(key) ?? 0) + 1);
}

/** Pour les tests : repart d'un registre vide. */
export function resetMetrics(): void {
    delete globalForMetrics.__edupilotResilienceMetrics;
}

export interface GaugeSnapshot {
    queue: { pending: number; running: number; failed: number; capacity: number; rejectAt: number; oldestPendingSeconds: number } | null;
    circuits: { name: string; state: CircuitStateName }[];
}

const CIRCUIT_STATE_VALUE: Record<CircuitStateName, number> = { closed: 0, half_open: 1, open: 2 };

/** Échappement des valeurs d'étiquette (format d'exposition texte 0.0.4). */
function label(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

/** Rend les compteurs et les jauges au format texte Prometheus. */
export function renderPrometheus(gauges: GaugeSnapshot): string {
    const { apiRequests, rejections, transitions } = registry();
    const lines: string[] = [];
    const metric = (name: string, type: "counter" | "gauge", help: string) => {
        lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
    };

    metric("edupilot_api_requests_total", "counter", "Requêtes d'API reçues par le proxy.");
    lines.push(`edupilot_api_requests_total ${apiRequests}`);

    metric("edupilot_requests_rejected_total", "counter", "Requêtes refusées pour surcharge, par motif.");
    const reasons: RejectionReason[] = ["rate_limit_user", "rate_limit_ip", "queue_saturated", "queue_full", "circuit_open"];
    for (const reason of reasons) {
        lines.push(`edupilot_requests_rejected_total{reason="${reason}"} ${rejections.get(reason) ?? 0}`);
    }

    if (gauges.queue) {
        const q = gauges.queue;
        metric("edupilot_job_queue_size", "gauge", "Envois dans la file, par statut.");
        lines.push(`edupilot_job_queue_size{status="pending"} ${q.pending}`);
        lines.push(`edupilot_job_queue_size{status="running"} ${q.running}`);
        lines.push(`edupilot_job_queue_size{status="failed"} ${q.failed}`);
        metric("edupilot_job_queue_capacity", "gauge", "Taille maximale de la file (JOB_QUEUE_MAX).");
        lines.push(`edupilot_job_queue_capacity ${q.capacity}`);
        metric("edupilot_job_queue_reject_threshold", "gauge", "Taille à partir de laquelle les nouveaux envois sont refusés.");
        lines.push(`edupilot_job_queue_reject_threshold ${q.rejectAt}`);
        metric("edupilot_job_queue_oldest_pending_seconds", "gauge", "Retard du plus ancien envoi prêt, en secondes.");
        lines.push(`edupilot_job_queue_oldest_pending_seconds ${q.oldestPendingSeconds}`);
    }

    metric("edupilot_circuit_breaker_state", "gauge", "État du coupe-circuit : 0 fermé, 1 demi-ouvert, 2 ouvert.");
    for (const circuit of gauges.circuits) {
        lines.push(`edupilot_circuit_breaker_state{circuit="${label(circuit.name)}"} ${CIRCUIT_STATE_VALUE[circuit.state]}`);
    }

    metric("edupilot_circuit_breaker_transitions_total", "counter", "Changements d'état observés par ce processus.");
    for (const [key, count] of transitions) {
        const [circuit, from, to] = JSON.parse(key) as [string, string, string];
        lines.push(`edupilot_circuit_breaker_transitions_total{circuit="${label(circuit)}",from="${from}",to="${to}"} ${count}`);
    }

    return `${lines.join("\n")}\n`;
}
