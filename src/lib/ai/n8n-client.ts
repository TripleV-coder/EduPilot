import { createHmac } from "crypto";
import { logger } from "@/lib/utils/logger";
import { fetchJsonWithPolicy } from "@/lib/ai/http-client";

// Lecture lazy : les env vars peuvent être chargées après l'import du module
// (tests, instrumentation Next). Ne jamais figer au top-level.
const n8nHost = () => process.env.N8N_HOST || "http://localhost:5678";

export interface AIAnalysisResult {
    riskScore: number;
    gradeTrend: string; // "UP", "DOWN", "STABLE"
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    summary: string;
}

export interface AIPredictionResult {
    dropoutRisk: number; // 0-100
    potentialFailureSubjects: string[];
    predictedAverage: number;
    confidence: number;
}

/**
 * Headers d'authentification n8n :
 * - X-N8N-API-KEY : header auth standard du nœud Webhook n8n
 * - X-EduPilot-Signature : HMAC-SHA256 du payload (si N8N_WEBHOOK_SECRET défini),
 *   vérifiable côté workflow pour rejeter les requêtes forgées.
 */
export function buildN8nHeaders(body: unknown): Record<string, string> {
    const apiKey = process.env.N8N_WEBHOOK_KEY;
    const secret = process.env.N8N_WEBHOOK_SECRET;
    const headers: Record<string, string> = {};
    if (apiKey) headers["X-N8N-API-KEY"] = apiKey;
    if (secret) {
        const payload = body !== undefined ? JSON.stringify(body) : "";
        headers["X-EduPilot-Signature"] =
            "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
    }
    return headers;
}

/**
 * Sends student data to n8n for comprehensive cloud LLM analysis.
 */
export async function analyzeStudentPerformance(data: Record<string, unknown>): Promise<AIAnalysisResult> {
    const result = await fetchJsonWithPolicy<AIAnalysisResult>(`${n8nHost()}/webhook/analyze-performance`, {
        method: "POST",
        headers: buildN8nHeaders(data),
        body: data,
        timeoutMs: 20_000,
        retries: 1,
    });

    if (!result.ok) {
        const error = new Error(`N8N_ERROR: ${result.status || "NETWORK"} — ${result.error}`);
        logger.error("Error calling N8N AI (Analysis):", error);
        throw error;
    }

    return result.data;
}

/**
 * Sends data to n8n for failure prediction.
 */
export async function predictFailureRisk(data: Record<string, unknown>): Promise<AIPredictionResult> {
    const result = await fetchJsonWithPolicy<AIPredictionResult>(`${n8nHost()}/webhook/predict-risk`, {
        method: "POST",
        headers: buildN8nHeaders(data),
        body: data,
        timeoutMs: 20_000,
        retries: 1,
    });

    if (!result.ok) {
        const error = new Error(`N8N_ERROR: ${result.status || "NETWORK"} — ${result.error}`);
        logger.error("Error calling N8N AI (Prediction):", error);
        throw error;
    }

    return result.data;
}

/**
 * Sends chat message to n8n.
 */
export async function chatWithAI(message: string, context: Record<string, unknown>): Promise<{ response: string }> {
    const body = { message, ...context };
    const result = await fetchJsonWithPolicy<{ response: string }>(`${n8nHost()}/webhook/chat`, {
        method: "POST",
        headers: buildN8nHeaders(body),
        body,
        timeoutMs: 25_000,
        retries: 1,
    });

    if (!result.ok) {
        const error = new Error(`N8N_ERROR: ${result.status || "NETWORK"} — ${result.error}`);
        logger.error("Error calling N8N AI (Chat):", error);
        throw error;
    }

    return result.data;
}

export interface N8nHealth {
    configured: boolean;
    reachable: boolean;
    latencyMs: number | null;
}

/**
 * Vérifie la joignabilité de l'instance n8n (endpoint /healthz natif).
 * Timeout court : utilisé par le statut du service IA, ne doit pas bloquer.
 */
export async function checkN8nHealth(): Promise<N8nHealth> {
    if (!process.env.N8N_HOST) {
        return { configured: false, reachable: false, latencyMs: null };
    }

    const startedAt = Date.now();
    const result = await fetchJsonWithPolicy<{ status?: string }>(`${n8nHost()}/healthz`, {
        method: "GET",
        timeoutMs: 3_000,
        retries: 0,
    });

    return {
        configured: true,
        reachable: result.ok,
        latencyMs: result.ok ? Date.now() - startedAt : null,
    };
}
