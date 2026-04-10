import prisma from "@/lib/prisma";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { createNotification, createBulkNotifications } from "@/lib/services/notification.service";
import { logger } from "@/lib/utils/logger";

export class AutomationService {
    /**
     * Run all daily maintenance tasks
     */
    async runDailyMaintenance() {
        logger.info("🚀 Starting daily maintenance tasks...");
        const results = {
            analyticsSync: { processed: 0, errors: 0 },
            absenteeismAlerts: 0,
            financeAlerts: 0,
        };

        try {
            // 1. Sync Analytics
            results.analyticsSync = await this.syncAllSchoolsAnalytics();

            // 2. Check Absenteeism
            results.absenteeismAlerts = await this.checkAbsenteeismAlerts();

            // 3. Check Overdue Payments
            results.financeAlerts = await this.checkOverduePaymentAlerts();

            logger.info("✨ Daily maintenance complete!", results);
            return { success: true, ...results };
        } catch (error) {
            logger.error("❌ Error during daily maintenance:", error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Sync all students analytics for all schools for the current year
     */
    async syncAllSchoolsAnalytics() {
        const schools = await prisma.school.findMany({
            where: { isActive: true },
            select: { id: true, name: true }
        });

        let totalProcessed = 0;
        let totalErrors = 0;

        for (const school of schools) {
            const currentYear = await prisma.academicYear.findFirst({
                where: { schoolId: school.id, isCurrent: true },
                select: { id: true }
            });

            if (!currentYear) continue;

            try {
                const result = await syncAllStudentsForSchool(school.id, currentYear.id);
                totalProcessed += result.processed;
                totalErrors += result.errors;
            } catch (err) {
                totalErrors++;
                logger.error(`Error syncing school ${school.name}:`, err as Error);
            }
        }

        return { processed: totalProcessed, errors: totalErrors };
    }

    /**
     * Detect classes with high absenteeism in the last 7 days
     */
    async checkAbsenteeismAlerts() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const classes = await prisma.class.findMany({
            where: { deletedAt: null },
            select: { 
                id: true, 
                name: true, 
                schoolId: true,
                enrollments: {
                    where: { status: "ACTIVE" },
                    take: 1
                }
            }
        });

        let alertsSent = 0;

        for (const cls of classes) {
            if (cls.enrollments.length === 0) continue;

            const attendances = await prisma.attendance.groupBy({
                by: ['status'],
                where: {
                    classId: cls.id,
                    date: { gte: sevenDaysAgo }
                },
                _count: true
            });

            const total = attendances.reduce((sum, a) => sum + a._count, 0);
            const absent = attendances.find(a => a.status === 'ABSENT')?._count || 0;

            if (total > 0) {
                const rate = (absent / total) * 100;
                if (rate > 15) {
                    // Notify Director and School Admin
                    const admins = await prisma.user.findMany({
                        where: {
                            schoolId: cls.schoolId,
                            role: { in: ["DIRECTOR", "SCHOOL_ADMIN"] },
                            isActive: true
                        },
                        select: { id: true }
                    });

                    if (admins.length > 0) {
                        await createBulkNotifications({
                            userIds: admins.map(a => a.id),
                            type: "WARNING",
                            title: "Alerte Absentéisme",
                            message: `La classe ${cls.name} présente un taux d'absence élevé de ${rate.toFixed(1)}% sur les 7 derniers jours.`,
                            link: `/dashboard/analytics?classId=${cls.id}`
                        });
                        alertsSent++;
                    }
                }
            }
        }

        return alertsSent;
    }

    /**
     * Notify parents of students with overdue payments (> 30 days)
     */
    async checkOverduePaymentAlerts() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const overdueInstallments = await prisma.installmentPayment.findMany({
            where: {
                status: "OVERDUE",
                dueDate: { lt: thirtyDaysAgo },
                paymentPlan: {
                    status: { not: "COMPLETED" },
                    student: {
                        user: { isActive: true }
                    }
                }
            },
            include: {
                paymentPlan: {
                    include: {
                        student: {
                            include: {
                                user: { select: { firstName: true, lastName: true } },
                                parentStudents: {
                                    include: {
                                        parent: {
                                            include: {
                                                user: { select: { id: true } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        let alertsSent = 0;

        for (const installment of overdueInstallments) {
            const student = (installment as any).paymentPlan.student;
            const parents = student.parentStudents.map((ps: any) => ps.parent.user.id);

            if (parents.length > 0) {
                await createBulkNotifications({
                    userIds: parents,
                    type: "PAYMENT",
                    title: "Retard de paiement critique",
                    message: `Le paiement de l'échéance du ${installment.dueDate.toLocaleDateString()} pour ${student.user.firstName} est en retard de plus de 30 jours. Merci de régulariser la situation au plus vite.`,
                    link: "/dashboard/finance"
                });
                alertsSent++;
            }
        }

        return alertsSent;
    }
}

export const automationService = new AutomationService();
