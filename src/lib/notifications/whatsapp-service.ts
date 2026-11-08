import { logger } from "@/lib/utils/logger";
import { getIntegrationSetting } from "@/lib/system/integration-settings";
import { CIRCUITS, circuitFetch } from "@/lib/resilience/circuit-breaker";
import { CircuitOpenError } from "@/lib/resilience/errors";

/**
 * Envoi WhatsApp par l'API Meta Cloud (WhatsApp Business). Un message à
 * l'initiative de l'école doit passer par un MODÈLE approuvé par Meta : le
 * texte de l'école en est le paramètre {{1}}.
 *
 * Réglages (console root › Intégrations, ou variables d'environnement) : WHATSAPP_PHONE_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME,
 * WHATSAPP_TEMPLATE_LANG (défaut « fr »), WHATSAPP_API_VERSION (défaut v21.0).
 */
const WHATSAPP_TIMEOUT_MS = 10_000;

export interface WhatsAppResult {
    success: boolean;
    messageId?: string;
    error?: string;
    /** Échec qu'un nouvel essai ne corrigera pas (configuration, numéro refusé). */
    permanent?: boolean;
}

export function whatsAppConfig() {
    const phoneId = getIntegrationSetting("WHATSAPP_PHONE_ID");
    const token = getIntegrationSetting("WHATSAPP_ACCESS_TOKEN");
    const template = getIntegrationSetting("WHATSAPP_TEMPLATE_NAME");
    return {
        configured: Boolean(phoneId && token && template),
        phoneId,
        token,
        template,
        lang: getIntegrationSetting("WHATSAPP_TEMPLATE_LANG") || "fr",
        version: getIntegrationSetting("WHATSAPP_API_VERSION") || "v21.0",
    };
}

export async function sendWhatsAppText(to: string, text: string): Promise<WhatsAppResult> {
    const cfg = whatsAppConfig();
    if (!cfg.configured) {
        return { success: false, error: "WhatsApp non configuré (console root › Intégrations).", permanent: true };
    }
    try {
        const response = await circuitFetch(CIRCUITS.whatsapp, `https://graph.facebook.com/${cfg.version}/${cfg.phoneId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "template",
                template: {
                    name: cfg.template,
                    language: { code: cfg.lang },
                    components: [{ type: "body", parameters: [{ type: "text", text }] }],
                },
            }),
            signal: AbortSignal.timeout(WHATSAPP_TIMEOUT_MS),
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => response.statusText);
            logger.warn(`[WhatsApp] Refus ${response.status}`, { module: "whatsapp", detail: detail.slice(0, 300) });
            return {
                success: false,
                error: `WhatsApp a refusé l'envoi (${response.status})`,
                permanent: response.status >= 400 && response.status < 500 && response.status !== 429,
            };
        }
        const payload = (await response.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
        return { success: true, messageId: payload?.messages?.[0]?.id };
    } catch (error) {
        if (error instanceof CircuitOpenError) throw error;
        logger.error("[WhatsApp] Échec de communication", error as Error);
        return { success: false, error: "Échec de communication avec WhatsApp" };
    }
}
