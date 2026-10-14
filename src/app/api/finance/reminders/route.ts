import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { computePlanlessExpected } from "@/lib/finance/expected-fees";
import { createNotifications } from "@/lib/services/notification.service";
import { isSmsProviderConfigured } from "@/lib/notifications/sms-service";
import { enqueueJobs } from "@/lib/jobs/queue";
import type { NewJob } from "@/lib/jobs/types";
import { Permission } from "@/lib/rbac/permissions";

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/**
 * Relance les familles dont un frais obligatoire (ou un échéancier souscrit) est échu.
 * Appelé par le bouton « Relancer » du tableau de bord finance.
 * Notification in-app immédiate ; e-mail et SMS (si un fournisseur est configuré)
 * confiés à la file d'envoi, avec nouvel essai en cas d'échec.
 */
export const POST = createApiHandler(
    async (_request, { session }) => {
        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "Aucun établissement actif associé au compte." }, { status: 400 });
        }

        const now = new Date();
        const plans = await prisma.paymentPlan.findMany({
            where: { status: { not: "CANCELLED" }, student: { schoolId } },
            select: {
                studentId: true,
                feeId: true,
                totalAmount: true,
                paidAmount: true,
                status: true,
                fee: { select: { name: true, dueDate: true } },
                installmentPayments: { select: { dueDate: true, status: true } },
            },
        });

        const studentIds = new Set<string>();
        for (const plan of plans) {
            const balance = Math.max(0, Number(plan.totalAmount) - Number(plan.paidAmount));
            if (balance <= 0) continue;
            const lateInstallment = plan.installmentPayments.some(
                (installment) => installment.status !== "PAID" && installment.dueDate <= now,
            );
            const feeLate = plan.fee.dueDate !== null && plan.fee.dueDate <= now;
            if (lateInstallment || feeLate || plan.status === "OVERDUE") {
                studentIds.add(plan.studentId);
            }
        }

        const planless = await computePlanlessExpected({
            schoolId,
            plannedKeys: new Set(plans.map((plan) => `${plan.feeId}:${plan.studentId}`)),
            now,
        });
        for (const studentId of planless.overdue.keys()) studentIds.add(studentId);

        if (studentIds.size === 0) {
            return NextResponse.json({
                reminded: 0,
                message: "Aucune famille à relancer : aucun impayé échu.",
            });
        }

        const links = await prisma.parentStudent.findMany({
            where: { studentId: { in: [...studentIds] } },
            select: {
                student: { select: { user: { select: { firstName: true, lastName: true } } } },
                parent: {
                    select: {
                        user: { select: { id: true, email: true, phone: true, firstName: true } },
                    },
                },
            },
        });

        const seen = new Set<string>();
        const title = "Relance de scolarité";
        const smsEnabled = isSmsProviderConfigured();
        const notifications: Parameters<typeof createNotifications>[0] = [];
        const jobs: NewJob[] = [];
        let emailsQueued = 0;
        let smsQueued = 0;
        for (const link of links) {
            const user = link.parent.user;
            const studentName = `${link.student.user.firstName} ${link.student.user.lastName}`.trim();
            const key = `${user.id}:${studentName}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const message = `Un montant reste dû pour ${studentName}. Merci de régulariser auprès de l'économat.`;
            notifications.push({ userId: user.id, type: "PAYMENT", title, message, link: "/dashboard/finance" });
            if (user.email) {
                jobs.push({
                    type: "email.send",
                    schoolId,
                    payload: { to: user.email, subject: title, text: message, html: `<p>${escapeHtml(message)}</p>` },
                });
                emailsQueued += 1;
            }
            if (user.phone && smsEnabled) {
                jobs.push({
                    type: "sms.send",
                    schoolId,
                    payload: { phoneNumber: user.phone, message, smsType: "REMINDER", schoolId },
                });
                smsQueued += 1;
            }
        }

        // Une insertion pour les notifications, une pour la file : la réponse ne
        // dépend plus du nombre de familles ni de la vitesse des fournisseurs.
        // File d'abord : si elle refuse (503, saturée), rien n'est créé et la
        // relance peut être relancée sans notifier deux fois les familles.
        await enqueueJobs(jobs);
        const { count: reminded } = await createNotifications(notifications);

        const channels = [
            emailsQueued > 0 ? `${emailsQueued} e-mail${emailsQueued > 1 ? "s" : ""}` : null,
            smsQueued > 0 ? `${smsQueued} SMS` : null,
        ].filter(Boolean);

        return NextResponse.json({
            reminded,
            emailsQueued,
            smsQueued,
            message:
                reminded > 0
                    ? `${reminded} famille${reminded > 1 ? "s" : ""} relancée${reminded > 1 ? "s" : ""} dans l'application${channels.length > 0 ? ` ; ${channels.join(" et ")} en cours d'envoi` : ""}.`
                    : "Aucune famille à relancer : aucun parent rattaché à ces élèves.",
        });
    },
    {
        allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
        requiredPermissions: [Permission.FINANCE_READ],
    },
);
