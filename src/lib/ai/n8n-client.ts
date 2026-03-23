import { logger } from "@/lib/utils/logger";
import { fetchJsonWithPolicy } from "@/lib/ai/http-client";

const N8N_HOST = process.env.N8N_HOST || "http://localhost:5678";
const N8N_WEBHOOK_KEY = process.env.N8N_WEBHOOK_KEY;

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
 * Sends student data to n8n for comprehensive analysis via Ollama/LLM.
 */
export async function analyzeStudentPerformance(data: any): Promise<AIAnalysisResult> {
    const result = await fetchJsonWithPolicy<AIAnalysisResult>(`${N8N_HOST}/webhook/analyze-performance`, {
        method: "POST",
        headers: {
            ...(N8N_WEBHOOK_KEY ? { "X-N8N-API-KEY": N8N_WEBHOOK_KEY } : {}),
        },
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
export async function predictFailureRisk(data: any): Promise<AIPredictionResult> {
    const result = await fetchJsonWithPolicy<AIPredictionResult>(`${N8N_HOST}/webhook/predict-risk`, {
        method: "POST",
        headers: {
            ...(N8N_WEBHOOK_KEY ? { "X-N8N-API-KEY": N8N_WEBHOOK_KEY } : {}),
        },
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
export async function chatWithAI(message: string, context: any): Promise<{ response: string }> {
    const result = await fetchJsonWithPolicy<{ response: string }>(`${N8N_HOST}/webhook/chat`, {
        method: "POST",
        headers: {
            ...(N8N_WEBHOOK_KEY ? { "X-N8N-API-KEY": N8N_WEBHOOK_KEY } : {}),
        },
        body: { message, ...context },
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
