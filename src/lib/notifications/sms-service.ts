/**
 * SMS — canal de SECOURS des messages aux familles depuis le 2026-11-14 :
 * WhatsApp passe en priorité (lib/notifications/family-channel.ts), le SMS
 * part quand WhatsApp n'est pas configuré ou n'aboutit pas.
 * Envoi délégué à une passerelle HTTP (console root › Intégrations).
 */

import { logger } from "@/lib/utils/logger";
import { getIntegrationSetting } from "@/lib/system/integration-settings";
import { CIRCUITS, circuitFetch } from "@/lib/resilience/circuit-breaker";
import { CircuitOpenError } from "@/lib/resilience/errors";

export type SMSType = "ATTENDANCE" | "GRADES" | "PAYMENT" | "REMINDER" | "CUSTOM";

/** Une passerelle qui ne répond pas ne doit pas retenir la requête ni la tâche. */
const SMS_TIMEOUT_MS = 10_000;

interface SMSResult {
    success: boolean;
    messageId?: string;
    queued?: boolean;
    error?: string;
    /** Échec qu'un nouvel essai ne corrigera pas (fournisseur absent, requête refusée). */
    permanent?: boolean;
}

export function isSmsProviderConfigured(): boolean {
    return Boolean(getIntegrationSetting("SMS_WEBHOOK_URL"));
}

async function sendViaConfiguredProvider(params: {
    phoneNumber: string;
    message: string;
    type: SMSType;
    schoolId: string;
}): Promise<SMSResult> {
    const webhookUrl = getIntegrationSetting("SMS_WEBHOOK_URL");
    const apiKey = getIntegrationSetting("SMS_API_KEY");

    if (!webhookUrl) {
        return {
            success: false,
            error: "Aucun fournisseur SMS configuré (console root › Intégrations).",
            permanent: true,
        };
    }

    try {
        const response = await circuitFetch(CIRCUITS.sms, webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(SMS_TIMEOUT_MS),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            logger.error(`[SMS] Provider error ${response.status}: ${errorText}`);
            return {
                success: false,
                error: `Fournisseur SMS indisponible (${response.status})`,
                // 4xx : la requête elle-même est refusée (numéro, clé) ; 429 et 5xx : réessayer.
                permanent: response.status >= 400 && response.status < 500 && response.status !== 429,
            };
        }

        const payload = await response.json().catch(() => null);
        return {
            success: true,
            messageId: payload?.messageId || payload?.id || `${Date.now()}`,
            queued: payload?.queued ?? true,
        };
    } catch (error) {
        // Circuit ouvert : aucun appel tenté. L'appelant répond 503, la file diffère l'envoi.
        if (error instanceof CircuitOpenError) throw error;
        logger.error("[SMS] Provider request failed", error as Error);
        return {
            success: false,
            error: "Échec de communication avec le fournisseur SMS",
        };
    }
}

export async function queueSMS(params: {
    phoneNumber: string;
    message: string;
    type: SMSType;
    schoolId: string;
}): Promise<SMSResult> {
    logger.info(`[SMS] Sending ${params.type} SMS to ${params.phoneNumber}`);
    return sendViaConfiguredProvider(params);
}

export function attendanceSmsMessage(params: { studentName: string; status: string; date: Date }): string {
    return `${params.studentName} a été marqué(e) ${params.status} le ${params.date.toLocaleDateString("fr-FR")}`;
}

export function paymentReminderMessage(params: { studentName: string; amount: number; dueDate: Date }): string {
    return `Rappel: paiement de ${params.amount} FCFA pour ${params.studentName} avant le ${params.dueDate.toLocaleDateString("fr-FR")}`;
}

export function gradesMessage(params: { studentName: string; period: string; average?: number }): string {
    const avgText = params.average ? ` (moyenne: ${params.average}/20)` : "";
    return `Les notes de ${params.studentName} pour ${params.period} sont disponibles${avgText}`;
}

export async function sendAttendanceSMS(params: {
    parentPhone: string;
    studentName: string;
    status: string;
    date: Date;
    schoolId: string;
}): Promise<SMSResult> {
    const message = attendanceSmsMessage(params);
    return queueSMS({ phoneNumber: params.parentPhone, message, type: "ATTENDANCE", schoolId: params.schoolId });
}

export async function sendPaymentReminderSMS(params: {
    parentPhone: string;
    studentName: string;
    amount: number;
    dueDate: Date;
    schoolId: string;
}): Promise<SMSResult> {
    const message = paymentReminderMessage(params);
    return queueSMS({ phoneNumber: params.parentPhone, message, type: "PAYMENT", schoolId: params.schoolId });
}

export async function sendGradesNotificationSMS(params: {
    parentPhone: string;
    studentName: string;
    period: string;
    average?: number;
    schoolId: string;
}): Promise<SMSResult> {
    const message = gradesMessage(params);
    return queueSMS({ phoneNumber: params.parentPhone, message, type: "GRADES", schoolId: params.schoolId });
}
