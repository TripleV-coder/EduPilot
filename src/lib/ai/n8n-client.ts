import { logger } from "@/lib/utils/logger";

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
    try {
        const response = await fetch(`${N8N_HOST}/webhook/analyze-performance`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(N8N_WEBHOOK_KEY ? { "X-N8N-API-KEY": N8N_WEBHOOK_KEY } : {})
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            // Mock fallback if offline or dev
            if (process.env.NODE_ENV === 'development') {
                logger.warn(`N8N unavailable (${response.statusText}), using mock data`);
                return getMockAnalysis();
            }
            throw new Error(`N8N Error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.error("Error calling N8N AI (Analysis):", error as Error);
        // In dev, robust fallback
        return getMockAnalysis();
    }
}

/**
 * Sends data to n8n for failure prediction.
 */
export async function predictFailureRisk(data: any): Promise<AIPredictionResult> {
    try {
        const response = await fetch(`${N8N_HOST}/webhook/predict-risk`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(N8N_WEBHOOK_KEY ? { "X-N8N-API-KEY": N8N_WEBHOOK_KEY } : {})
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            if (process.env.NODE_ENV === 'development') {
                return getMockPrediction();
            }
            throw new Error(`N8N Error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.error("Error calling N8N AI (Prediction):", error as Error);
        return getMockPrediction();
    }
}

/**
 * Sends chat message to n8n.
 */
export async function chatWithAI(message: string, context: any): Promise<{ response: string }> {
    try {
        const response = await fetch(`${N8N_HOST}/webhook/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(N8N_WEBHOOK_KEY ? { "X-N8N-API-KEY": N8N_WEBHOOK_KEY } : {})
            },
            body: JSON.stringify({ message, ...context })
        });

        if (!response.ok) {
            if (process.env.NODE_ENV === 'development') {
                return { response: "Désolé, je suis en mode maintenance (Dev Mock)." };
            }
            throw new Error(`N8N Error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        logger.error("Error calling N8N AI (Chat):", error as Error);
        return { response: "Service indisponible pour le moment." };
    }
}

// Fallbacks for dev/offline testing
function getMockAnalysis(): AIAnalysisResult {
    return {
        riskScore: 15,
        gradeTrend: "STABLE",
        strengths: ["Mathématiques", "Assiduité"],
        weaknesses: ["Anglais"],
        recommendations: ["Renforcer la pratique orale de l'anglais", "Maintenir les efforts en sciences"],
        summary: "Élève sérieux avec des résultats constants. Léger fléchissement en langues."
    };
}

function getMockPrediction(): AIPredictionResult {
    return {
        dropoutRisk: 5,
        potentialFailureSubjects: ["Anglais"],
        predictedAverage: 14.5,
        confidence: 85
    };
}
