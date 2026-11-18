import { logger } from "@/lib/utils/logger";
import { getIntegrationSetting } from "@/lib/system/integration-settings";
import { CIRCUITS, circuitFetch } from "@/lib/resilience/circuit-breaker";
import { CircuitOpenError } from "@/lib/resilience/errors";

/**
 * Appels vocaux par une passerelle HTTP configurable (même principe que le
 * SMS) : la passerelle synthétise ou diffuse l'enregistrement et appelle le
 * numéro. Réglages (console root › Intégrations, ou variables d'environnement) :
 * VOICE_WEBHOOK_URL, VOICE_API_KEY (facultative).
 */
const VOICE_TIMEOUT_MS = 10_000;

export function isVoiceGatewayConfigured(): boolean {
    return Boolean(getIntegrationSetting("VOICE_WEBHOOK_URL"));
}

export async function sendVoiceCall(params: {
    to: string;
    lang: string;
    text: string;
    audioUrl?: string | null;
    campaignId: string;
}): Promise<{ success: boolean; error?: string; permanent?: boolean }> {
    const url = getIntegrationSetting("VOICE_WEBHOOK_URL");
    if (!url) return { success: false, error: "Aucune passerelle vocale configurée (console root › Intégrations).", permanent: true };
    const apiKey = getIntegrationSetting("VOICE_API_KEY");
    try {
        const response = await circuitFetch(CIRCUITS.voice, url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(VOICE_TIMEOUT_MS),
        });
        if (!response.ok) {
            return {
                success: false,
                error: `Passerelle vocale indisponible (${response.status})`,
                permanent: response.status >= 400 && response.status < 500 && response.status !== 429,
            };
        }
        return { success: true };
    } catch (error) {
        if (error instanceof CircuitOpenError) throw error;
        logger.error("[Voix] Échec de communication avec la passerelle", error as Error);
        return { success: false, error: "Échec de communication avec la passerelle vocale" };
    }
}
