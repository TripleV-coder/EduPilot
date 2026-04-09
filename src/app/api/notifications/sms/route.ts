import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
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
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

type BulkTarget = "parents_all" | "parents_debt" | "teachers_all";

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
    })).max(100).optional(),
    target: z.enum(["parents_all", "parents_debt", "teachers_all"]).optional(),
    message: z.string().max(918).optional(),
    type: z.enum(["ATTENDANCE", "GRADES", "PAYMENT", "REMINDER", "CUSTOM"]),
});

function applySmsTemplate(
    template: string,
    context: {
        parentFirstName?: string;
        studentName?: string;
        balance?: number;
    }
): string {
    return template
        .replaceAll("{Prenom_Parent}", context.parentFirstName || "")
        .replaceAll("{Nom_Enfant}", context.studentName || "")
        .replaceAll(
            "{Solde_A_Payer}",
            context.balance !== undefined ? `${Math.round(context.balance)} FCFA` : ""
        )
        .trim();
}

async function resolveBulkRecipients(
    schoolId: string,
    target: BulkTarget,
    messageTemplate: string
): Promise<{ phone: string; message: string }[]> {
    if (target === "teachers_all") {
        const teachers = await prisma.user.findMany({
            where: {
                schoolId,
                role: "TEACHER",
                isActive: true,
                phone: { not: null },
            },
            select: {
                phone: true,
                firstName: true,
            },
        });

        return teachers
            .filter((teacher) => teacher.phone)
            .map((teacher) => ({
                phone: teacher.phone!,
                message: applySmsTemplate(messageTemplate, {
                    parentFirstName: teacher.firstName,
                }),
            }));
    }

    if (target === "parents_debt") {
        const plans = await prisma.paymentPlan.findMany({
            where: {
                fee: { schoolId },
                status: { in: ["ACTIVE", "OVERDUE"] },
                student: {
                    parentStudents: {
                        some: {},
                    },
                },
            },
            select: {
                totalAmount: true,
                paidAmount: true,
                student: {
                    select: {
                        user: { select: { firstName: true, lastName: true } },
                        parentStudents: {
                            select: {
                                parent: {
                                    select: {
                                        user: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                phone: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const recipientsByPhone = new Map<
            string,
            { phone: string; message: string; balance: number; parentFirstName?: string; studentNames: string[] }
        >();

        for (const plan of plans) {
            const balance = Math.max(
                0,
                Number(plan.totalAmount) - Number(plan.paidAmount)
            );
            if (balance <= 0) continue;

            const studentName = `${plan.student.user.firstName} ${plan.student.user.lastName}`;

            for (const link of plan.student.parentStudents) {
                const phone = link.parent.user.phone;
                if (!phone) continue;

                const existing = recipientsByPhone.get(phone) ?? {
                    phone,
                    message: "",
                    balance: 0,
                    parentFirstName: link.parent.user.firstName,
                    studentNames: [],
                };

                existing.balance += balance;
                if (!existing.studentNames.includes(studentName)) {
                    existing.studentNames.push(studentName);
                }
                recipientsByPhone.set(phone, existing);
            }
        }

        return Array.from(recipientsByPhone.values()).map((recipient) => ({
            phone: recipient.phone,
            message: applySmsTemplate(messageTemplate, {
                parentFirstName: recipient.parentFirstName,
                studentName: recipient.studentNames.join(", "),
                balance: recipient.balance,
            }),
        }));
    }

    const parents = await prisma.parentProfile.findMany({
        where: {
            user: {
                schoolId,
                isActive: true,
                phone: { not: null },
            },
        },
        select: {
            user: {
                select: {
                    phone: true,
                    firstName: true,
                },
            },
            parentStudents: {
                select: {
                    student: {
                        select: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    return parents
        .filter((parent) => parent.user.phone)
        .map((parent) => ({
            phone: parent.user.phone!,
            message: applySmsTemplate(messageTemplate, {
                parentFirstName: parent.user.firstName,
                studentName: parent.parentStudents
                    .map(
                        (link) =>
                            `${link.student.user.firstName} ${link.student.user.lastName}`
                    )
                    .join(", "),
            }),
        }));
}

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

        const schoolId = getActiveSchoolId(session);
        if (!schoolId && session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "Contexte école requis" }, { status: 400 });
        }

        const body = await request.json();
        const searchParams = request.nextUrl.searchParams;
        const isBulk = searchParams.get("bulk") === "true";

        if (isBulk) {
            // Bulk SMS
            const validated = bulkSmsSchema.parse(body);
            let recipients = validated.recipients ?? [];

            if (validated.target) {
                if (!schoolId) {
                    return NextResponse.json(
                        { error: "Contexte école requis pour un envoi groupé" },
                        { status: 400 }
                    );
                }

                if (!validated.message) {
                    return NextResponse.json(
                        { error: "message requis pour un envoi groupé par cible" },
                        { status: 400 }
                    );
                }

                recipients = await resolveBulkRecipients(
                    schoolId,
                    validated.target,
                    validated.message
                );
            }

            if (recipients.length === 0) {
                return NextResponse.json(
                    { error: "Aucun destinataire valide pour cette campagne" },
                    { status: 400 }
                );
            }

            const result = await sendBulkSMS(
                recipients,
                validated.type as SMSType,
                schoolId || "super_admin"
            );

            return NextResponse.json({
                success: true,
                sent: result.sent,
                failed: result.failed,
                recipientsCount: recipients.length,
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
        if (isZodError(error)) {
            return NextResponse.json(
                { error: "Données invalides", details: error.issues },
                { status: 400 }
            );
        }

        logger.error("SMS API error:", error as Error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
