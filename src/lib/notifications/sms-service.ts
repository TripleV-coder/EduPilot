/**
 * SMS Service
 * Utilise un webhook HTTP configurable pour déléguer l'envoi à un fournisseur SMS réel.
 */

import { logger } from "@/lib/utils/logger";
import { enqueueJobs } from "@/lib/jobs/queue";
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

interface BulkSMSResult {
    sent: number;
    failed: number;
    /** Messages confiés à la file d'envoi (`src/lib/jobs/queue.ts`). */
    queued: number;
}

export function isSmsProviderConfigured(): boolean {
    return Boolean(process.env.SMS_WEBHOOK_URL);
}

async function sendViaConfiguredProvider(params: {
    phoneNumber: string;
    message: string;
    type: SMSType;
    schoolId: string;
}): Promise<SMSResult> {
    const webhookUrl = process.env.SMS_WEBHOOK_URL;
    const apiKey = process.env.SMS_API_KEY;

    if (!webhookUrl) {
        return {
            success: false,
            error: "Aucun fournisseur SMS configuré (SMS_WEBHOOK_URL).",
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
    const message = `Rappel: paiement de ${params.amount} FCFA pour ${params.studentName} avant le ${params.dueDate.toLocaleDateString("fr-FR")}`;
    return queueSMS({ phoneNumber: params.parentPhone, message, type: "PAYMENT", schoolId: params.schoolId });
}

export async function sendGradesNotificationSMS(params: {
    parentPhone: string;
    studentName: string;
    period: string;
    average?: number;
    schoolId: string;
}): Promise<SMSResult> {
    const avgText = params.average ? ` (moyenne: ${params.average}/20)` : "";
    const message = `Les notes de ${params.studentName} pour ${params.period} sont disponibles${avgText}`;
    return queueSMS({ phoneNumber: params.parentPhone, message, type: "GRADES", schoolId: params.schoolId });
}

/**
 * Envoi groupé : les messages sont confiés à la file d'envoi et partent en
 * arrière-plan, avec nouvel essai si la passerelle échoue. Une campagne vers
 * toutes les familles ne retient plus la requête le temps de N appels.
 * `schoolId` vaut "super_admin" pour un envoi hors établissement.
 */
export async function sendBulkSMS(
    recipients: { phone: string; message: string }[],
    type: SMSType,
    schoolId: string
): Promise<BulkSMSResult> {
    if (!isSmsProviderConfigured()) {
        logger.warn(`[SMS] Bulk send skipped: no provider configured (${recipients.length} recipients)`);
        return { sent: 0, failed: recipients.length, queued: 0 };
    }

    const queued = await enqueueJobs(
        recipients.map((recipient) => ({
            type: "sms.send" as const,
            payload: { phoneNumber: recipient.phone, message: recipient.message, smsType: type, schoolId },
            schoolId: schoolId === "super_admin" ? null : schoolId,
        })),
    );

    logger.info(`[SMS] Bulk send queued: ${queued} messages`);
    return { sent: 0, failed: 0, queued };
}
