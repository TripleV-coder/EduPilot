import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@/lib/utils/logger";
import { getIntegrationSetting } from "@/lib/system/integration-settings";
import { CIRCUITS, circuitFetch } from "@/lib/resilience/circuit-breaker";
import { CircuitOpenError } from "@/lib/resilience/errors";
import type { SMSType } from "@/lib/notifications/sms-service";

/**
 * Envoi WhatsApp par l'API Meta Cloud (WhatsApp Business) — canal PRINCIPAL
 * des messages aux familles depuis le 2026-11-14 (le SMS devient le secours,
 * voir family-channel.ts).
 *
 * Un message à l'initiative de l'école doit passer par un MODÈLE approuvé par
 * Meta ; le texte de l'école en est l'unique paramètre {{1}}. Un modèle par
 * type de message (absence, paiement, notes, rappel) : Meta classe chacun
 * (« utilitaire » ≈ 5 fois moins cher que « marketing ») et l'approuve à part.
 * Sans modèle propre à un type, le modèle par défaut (WHATSAPP_TEMPLATE_NAME)
 * est utilisé.
 *
 * Réglages (console root › Intégrations, ou variables d'environnement) :
 * WHATSAPP_PHONE_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME,
 * WHATSAPP_TEMPLATE_<TYPE>, WHATSAPP_TEMPLATE_LANG (défaut « fr »),
 * WHATSAPP_API_VERSION (défaut v21.0), WHATSAPP_APP_SECRET (statuts reçus).
 */
const WHATSAPP_TIMEOUT_MS = 10_000;
/** Longueur maximale d'un paramètre de modèle (règle Meta). */
export const WHATSAPP_PARAM_MAX = 1024;

export type WhatsAppKind = SMSType;

export interface WhatsAppResult {
    success: boolean;
    messageId?: string;
    error?: string;
    /** Échec qu'un nouvel essai ne corrigera pas (configuration, numéro refusé). */
    permanent?: boolean;
}

/** Modèle à utiliser pour un type de message : le sien, sinon le modèle par défaut. */
export function whatsAppTemplateFor(kind: WhatsAppKind = "CUSTOM"): string | undefined {
    return specificTemplate(kind) || getIntegrationSetting("WHATSAPP_TEMPLATE_NAME");
}

function specificTemplate(kind: WhatsAppKind): string | undefined {
    switch (kind) {
        case "ATTENDANCE":
            return getIntegrationSetting("WHATSAPP_TEMPLATE_ATTENDANCE");
        case "PAYMENT":
            return getIntegrationSetting("WHATSAPP_TEMPLATE_PAYMENT");
        case "GRADES":
            return getIntegrationSetting("WHATSAPP_TEMPLATE_GRADES");
        case "REMINDER":
            return getIntegrationSetting("WHATSAPP_TEMPLATE_REMINDER");
        default:
            return undefined;
    }
}

export function whatsAppConfig(kind: WhatsAppKind = "CUSTOM") {
    const phoneId = getIntegrationSetting("WHATSAPP_PHONE_ID");
    const token = getIntegrationSetting("WHATSAPP_ACCESS_TOKEN");
    const template = whatsAppTemplateFor(kind);
    return {
        configured: Boolean(phoneId && token && template),
        phoneId,
        token,
        template,
        lang: getIntegrationSetting("WHATSAPP_TEMPLATE_LANG") || "fr",
        version: getIntegrationSetting("WHATSAPP_API_VERSION") || "v21.0",
    };
}

/**
 * Texte d'un paramètre de modèle conforme à Meta : ni retour à la ligne ni
 * tabulation, pas plus de 4 espaces consécutifs, 1 024 caractères au plus.
 */
export function toTemplateParam(text: string): string {
    const flat = text
        .replace(/\s*[\r\n]+\s*/g, " · ")
        .replace(/\t/g, " ")
        .replace(/ {4,}/g, "   ")
        .trim();
    return flat.length > WHATSAPP_PARAM_MAX ? `${flat.slice(0, WHATSAPP_PARAM_MAX - 1)}…` : flat;
}

export async function sendWhatsAppText(to: string, text: string, kind: WhatsAppKind = "CUSTOM"): Promise<WhatsAppResult> {
    const cfg = whatsAppConfig(kind);
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
                    components: [{ type: "body", parameters: [{ type: "text", text: toTemplateParam(text) }] }],
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

/**
 * Signature d'un événement envoyé par Meta : en-tête X-Hub-Signature-256
 * « sha256=<HMAC-SHA256 hexadécimal du corps brut avec la clé secrète de
 * l'application> ». Comparaison en temps constant.
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
    if (!header?.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    const given = Buffer.from(header.slice("sha256=".length), "utf8");
    const wanted = Buffer.from(expected, "utf8");
    return given.length === wanted.length && timingSafeEqual(given, wanted);
}
