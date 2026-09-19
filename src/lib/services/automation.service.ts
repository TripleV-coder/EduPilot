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
     *
     * Audit N8 : un groupBy par classe puis une lecture des administrateurs par
     * classe en alerte. Désormais : une requête pour les classes, une pour les
     * présences de toutes les classes, une pour les administrateurs concernés.
     */
    async checkAbsenteeismAlerts() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const classes = await prisma.class.findMany({
            where: { deletedAt: null, enrollments: { some: { status: "ACTIVE" } } },
            select: { id: true, name: true, schoolId: true },
        });
        if (classes.length === 0) return 0;

        const counts = await prisma.attendance.groupBy({
            by: ["classId", "status"],
            where: {
                classId: { in: classes.map((cls) => cls.id) },
                date: { gte: sevenDaysAgo },
            },
            _count: { _all: true },
        });

        const perClass = new Map<string, { total: number; absent: number }>();
        for (const row of counts) {
            if (!row.classId) continue;
            const tally = perClass.get(row.classId) ?? { total: 0, absent: 0 };
            tally.total += row._count._all;
            if (row.status === "ABSENT") tally.absent += row._count._all;
            perClass.set(row.classId, tally);
        }

        const flagged = classes.flatMap((cls) => {
            const tally = perClass.get(cls.id);
            if (!tally || tally.total === 0) return [];
            const rate = (tally.absent / tally.total) * 100;
            return rate > 15 ? [{ cls, rate }] : [];
        });
        if (flagged.length === 0) return 0;

        // Notify Director and School Admin
        const admins = await prisma.user.findMany({
            where: {
                schoolId: { in: [...new Set(flagged.map(({ cls }) => cls.schoolId))] },
                role: { in: ["DIRECTOR", "SCHOOL_ADMIN"] },
                isActive: true,
            },
            select: { id: true, schoolId: true },
        });

        let alertsSent = 0;
        for (const { cls, rate } of flagged) {
            const userIds = admins.filter((admin) => admin.schoolId === cls.schoolId).map((admin) => admin.id);
            if (userIds.length === 0) continue;

            await createBulkNotifications({
                userIds,
                type: "WARNING",
                title: "Alerte Absentéisme",
                message: `La classe ${cls.name} présente un taux d'absence élevé de ${rate.toFixed(1)}% sur les 7 derniers jours.`,
                link: `/dashboard/analytics?classId=${cls.id}`
            });
            alertsSent++;
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
