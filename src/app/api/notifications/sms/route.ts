import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
    queueSMS,
    sendAttendanceSMS,
    sendPaymentReminderSMS,
    sendGradesNotificationSMS,
    sendBulkSMS,
    SMSType
} from "@/lib/notifications/sms-service";
import { logger } from "@/lib/utils/logger";

const smsSchema = z.object({
    type: z.enum(["ATTENDANCE", "GRADES", "PAYMENT", "REMINDER", "CUSTOM"]),
    phoneNumber: z.string().min(8),
    message: z.string().max(918).optional(),
    // For ATTENDANCE type
    studentName: z.string().optional(),
    status: z.enum(["ABSENT", "LATE"]).optional(),
    // For PAYMENT type
    amount: z.number().positive().optional(),
    dueDate: z.string().optional(),
    // For GRADES type
    period: z.string().optional(),
    average: z.number().optional(),
});

const bulkSmsSchema = z.object({
    recipients: z.array(z.object({
        phone: z.string().min(8),
        message: z.string().max(918),
    })).min(1).max(100),
    type: z.enum(["ATTENDANCE", "GRADES", "PAYMENT", "REMINDER", "CUSTOM"]),
});

/**
 * POST /api/notifications/sms
 * Send SMS notifications (single or type-based)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
        }

        const schoolId = session.user.schoolId;
        if (!schoolId && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Contexte école requis" }, { status: 400 });
        }

        const body = await request.json();
        const searchParams = request.nextUrl.searchParams;
        const isBulk = searchParams.get("bulk") === "true";

        if (isBulk) {
            // Bulk SMS
            const validated = bulkSmsSchema.parse(body);
            const result = await sendBulkSMS(
                validated.recipients,
                validated.type as SMSType,
                schoolId || "super_admin"
            );

            return NextResponse.json({
                success: true,
                sent: result.sent,
                failed: result.failed,
            });
        }

        // Single SMS
        const validated = smsSchema.parse(body);

        let result;

        switch (validated.type) {
            case "ATTENDANCE":
                if (!validated.studentName || !validated.status) {
                    return NextResponse.json(
                        { error: "studentName et status requis pour ATTENDANCE" },
                        { status: 400 }
                    );
                }
                result = await sendAttendanceSMS({
                    parentPhone: validated.phoneNumber,
                    studentName: validated.studentName,
                    status: validated.status,
                    date: new Date(),
                    schoolId: schoolId || "super_admin",
                });
                break;

            case "PAYMENT":
                if (!validated.studentName || !validated.amount || !validated.dueDate) {
                    return NextResponse.json(
                        { error: "studentName, amount et dueDate requis pour PAYMENT" },
                        { status: 400 }
                    );
                }
                result = await sendPaymentReminderSMS({
                    parentPhone: validated.phoneNumber,
                    studentName: validated.studentName,
                    amount: validated.amount,
                    dueDate: new Date(validated.dueDate),
                    schoolId: schoolId || "super_admin",
                });
                break;

            case "GRADES":
                if (!validated.studentName || !validated.period) {
                    return NextResponse.json(
                        { error: "studentName et period requis pour GRADES" },
                        { status: 400 }
                    );
                }
                result = await sendGradesNotificationSMS({
                    parentPhone: validated.phoneNumber,
                    studentName: validated.studentName,
                    period: validated.period,
                    average: validated.average,
                    schoolId: schoolId || "super_admin",
                });
                break;

            case "CUSTOM":
            case "REMINDER":
                if (!validated.message) {
                    return NextResponse.json(
                        { error: "message requis pour CUSTOM/REMINDER" },
                        { status: 400 }
                    );
                }
                result = await queueSMS({
                    phoneNumber: validated.phoneNumber,
                    message: validated.message,
                    type: validated.type,
                    schoolId: schoolId || "super_admin",
                });
                break;

            default:
                return NextResponse.json({ error: "Type SMS invalide" }, { status: 400 });
        }

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            queued: result.queued,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }

        logger.error("SMS API error:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
