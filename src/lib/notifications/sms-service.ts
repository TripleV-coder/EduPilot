/**
 * SMS Service
 * Utilise un webhook HTTP configurable pour déléguer l'envoi à un fournisseur SMS réel.
 */

import { logger } from "@/lib/utils/logger";

export type SMSType = "ATTENDANCE" | "GRADES" | "PAYMENT" | "REMINDER" | "CUSTOM";

interface SMSResult {
    success: boolean;
    messageId?: string;
    queued?: boolean;
    error?: string;
}

interface BulkSMSResult {
    sent: number;
    failed: number;
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
        };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            logger.error(`[SMS] Provider error ${response.status}: ${errorText}`);
            return {
                success: false,
                error: `Fournisseur SMS indisponible (${response.status})`,
            };
        }

        const payload = await response.json().catch(() => null);
        return {
            success: true,
            messageId: payload?.messageId || payload?.id || `${Date.now()}`,
            queued: payload?.queued ?? true,
        };
    } catch (error) {
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

export async function sendAttendanceSMS(params: {
    parentPhone: string;
    studentName: string;
    status: string;
    date: Date;
    schoolId: string;
}): Promise<SMSResult> {
    const message = `${params.studentName} a été marqué(e) ${params.status} le ${params.date.toLocaleDateString("fr-FR")}`;
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

export async function sendBulkSMS(
    recipients: { phone: string; message: string }[],
    type: SMSType,
    schoolId: string
): Promise<BulkSMSResult> {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
        const result = await queueSMS({
            phoneNumber: recipient.phone,
            message: recipient.message,
            type,
            schoolId,
        });

        if (result.success) sent += 1;
        else failed += 1;
    }

    logger.info(`[SMS] Bulk send completed: ${sent} sent, ${failed} failed`);
    return { sent, failed };
}
