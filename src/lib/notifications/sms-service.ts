/**
 * Service SMS unifié pour EduPilot
 * Centralise tous les envois SMS : présence, notes, paiements
 * 
 * IMPORTANT: Ce service est un wrapper prêt pour intégration avec:
 * - Twilio
 * - Africa's Talking
 * - Orange SMS API
 * - MTN MoMo API (Benin)
 * 
 * Pour le moment, il log les SMS en base de données pour traitement ultérieur
 * ou envoi manuel via un provider externe.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export type SMSType = "ATTENDANCE" | "GRADES" | "PAYMENT" | "REMINDER" | "CUSTOM";

export interface SMSPayload {
    /** Phone number in international format (e.g., +229XXXXXXXX) */
    phoneNumber: string;
    /** Message content (max 160 chars for single SMS, 306 for concatenated) */
    message: string;
    /** Type of SMS for categorization */
    type: SMSType;
    /** Related entity ID (studentId, paymentId, etc.) */
    relatedId?: string;
    /** School ID for multi-tenant isolation */
    schoolId: string;
    /** Sender ID (school name, max 11 chars) */
    senderId?: string;
}

export interface SMSResult {
    success: boolean;
    messageId?: string;
    error?: string;
    queued?: boolean;
}

/**
 * Format phone number to international format for Benin
 */
export function formatBeninPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");

    // Benin numbers are 8 digits (or 11 with country code)
    if (digits.length === 8) {
        return `+229${digits}`;
    }

    if (digits.length === 11 && digits.startsWith("229")) {
        return `+${digits}`;
    }

    if (digits.length === 12 && digits.startsWith("00229")) {
        return `+229${digits.slice(5)}`;
    }

    logger.warn("Invalid phone number format", { phone, digits });
    return null;
}

/**
 * Validate SMS message length
 */
export function validateSMSMessage(message: string): { valid: boolean; length: number; parts: number } {
    const length = message.length;
    const parts = length <= 160 ? 1 : Math.ceil(length / 153); // 153 chars per part for concatenated SMS

    return {
        valid: length > 0 && length <= 918, // Max 6 parts
        length,
        parts,
    };
}

/**
 * Queue an SMS for sending
 * Currently stores in database for manual/batch processing
 * Can be extended to call external SMS API directly
 */
export async function queueSMS(payload: SMSPayload): Promise<SMSResult> {
    try {
        const formattedPhone = formatBeninPhoneNumber(payload.phoneNumber);

        if (!formattedPhone) {
            return {
                success: false,
                error: "Invalid phone number format",
            };
        }

        const validation = validateSMSMessage(payload.message);
        if (!validation.valid) {
            return {
                success: false,
                error: `Message too long: ${validation.length} chars`,
            };
        }

        // Store in database for processing
        // You would create an SMSQueue model in Prisma for this
        // For now, we'll log it
        logger.info("SMS Queued", {
            phone: formattedPhone,
            type: payload.type,
            length: validation.length,
            parts: validation.parts,
            schoolId: payload.schoolId,
        });

        // TODO: When SMS provider is integrated, call API here
        // const result = await smsProvider.send({
        //     to: formattedPhone,
        //     message: payload.message,
        //     from: payload.senderId || "EduPilot",
        // });

        return {
            success: true,
            queued: true,
            messageId: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
    } catch (error) {
        logger.error("Failed to queue SMS", error as Error);
        return {
            success: false,
            error: "Failed to queue SMS",
        };
    }
}

/**
 * Send attendance notification to parent
 */
export async function sendAttendanceSMS(params: {
    parentPhone: string;
    studentName: string;
    status: "ABSENT" | "LATE";
    date: Date;
    schoolId: string;
    schoolName?: string;
}): Promise<SMSResult> {
    const { parentPhone, studentName, status, date, schoolId, schoolName } = params;

    const dateStr = date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short"
    });

    const message = status === "ABSENT"
        ? `${studentName} était absent(e) le ${dateStr}. Merci de contacter l'école. - ${schoolName || "EduPilot"}`
        : `${studentName} est arrivé(e) en retard le ${dateStr}. - ${schoolName || "EduPilot"}`;

    return queueSMS({
        phoneNumber: parentPhone,
        message,
        type: "ATTENDANCE",
        schoolId,
        senderId: schoolName?.slice(0, 11),
    });
}

/**
 * Send payment reminder to parent
 */
export async function sendPaymentReminderSMS(params: {
    parentPhone: string;
    studentName: string;
    amount: number;
    dueDate: Date;
    schoolId: string;
    schoolName?: string;
}): Promise<SMSResult> {
    const { parentPhone, studentName, amount, dueDate, schoolId, schoolName } = params;

    const dateStr = dueDate.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short"
    });

    const message = `Rappel: ${amount.toLocaleString("fr-FR")} XOF à payer pour ${studentName} avant le ${dateStr}. - ${schoolName || "EduPilot"}`;

    return queueSMS({
        phoneNumber: parentPhone,
        message,
        type: "PAYMENT",
        schoolId,
        senderId: schoolName?.slice(0, 11),
    });
}

/**
 * Send grades notification to parent
 */
export async function sendGradesNotificationSMS(params: {
    parentPhone: string;
    studentName: string;
    period: string;
    average?: number;
    schoolId: string;
    schoolName?: string;
}): Promise<SMSResult> {
    const { parentPhone, studentName, period, average, schoolId, schoolName } = params;

    const avgStr = average !== undefined ? ` Moyenne: ${average.toFixed(2)}/20.` : "";
    const message = `Les notes de ${studentName} pour ${period} sont disponibles.${avgStr} Consultez le bulletin sur EduPilot. - ${schoolName || "EduPilot"}`;

    return queueSMS({
        phoneNumber: parentPhone,
        message,
        type: "GRADES",
        schoolId,
        senderId: schoolName?.slice(0, 11),
    });
}

/**
 * Send bulk SMS to multiple recipients
 */
export async function sendBulkSMS(
    recipients: Array<{ phone: string; message: string }>,
    type: SMSType,
    schoolId: string
): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
    const results: SMSResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
        const result = await queueSMS({
            phoneNumber: recipient.phone,
            message: recipient.message,
            type,
            schoolId,
        });

        results.push(result);
        if (result.success) {
            sent++;
        } else {
            failed++;
        }
    }

    return { sent, failed, results };
}

export default {
    queueSMS,
    sendAttendanceSMS,
    sendPaymentReminderSMS,
    sendGradesNotificationSMS,
    sendBulkSMS,
    formatBeninPhoneNumber,
    validateSMSMessage,
};
