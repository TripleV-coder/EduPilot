import prisma from "@/lib/prisma";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { createBulkNotifications } from "@/lib/services/notification.service";
import { runInstallmentReminders } from "@/lib/finance/reminders";
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
            financeReminders: { swept: 0, notified: 0, UPCOMING: 0, DUE: 0, OVERDUE: 0, CRITICAL: 0 },
        };

        try {
            // 1. Sync Analytics
            results.analyticsSync = await this.syncAllSchoolsAnalytics();

            // 2. Check Absenteeism
            results.absenteeismAlerts = await this.checkAbsenteeismAlerts();

            // 3. Balayage des échéances + relances étagées aux parents.
            // `financeReminders` porte le détail par étape ; `financeAlerts`
            // conserve son ancienne sémantique (alertes de retard critique
            // > 30 j) pour ne pas casser les consommateurs existants.
            const finance = await this.runFinanceReminders();
            results.financeReminders = finance;
            results.financeAlerts = finance.CRITICAL;

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
     * Balaie les échéances échues (PENDING → OVERDUE) et envoie les relances
     * étagées aux parents (à venir / aujourd'hui / en retard / critique).
     * Voir `src/lib/finance/reminders.ts` pour la logique et l'idempotence.
     */
    async runFinanceReminders() {
        return runInstallmentReminders();
    }
}

export const automationService = new AutomationService();
