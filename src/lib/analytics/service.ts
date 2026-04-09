/**
 * Analytics Service — provides school-level statistics
 * Used by analytics API routes and AI context enrichment
 */

import prisma from "@/lib/prisma";
import { normalizeGradeTo20 } from "@/lib/analytics/helpers";
import { countTeachersForSchool } from "@/lib/teachers/school-assignments";

export const analyticsService = {
    /**
     * Get summary statistics for a school
     */
    async getSchoolStats(schoolId: string) {
        const [studentsCount, teachersCount, classesCount] = await Promise.all([
            prisma.studentProfile.count({ where: { schoolId } }),
            countTeachersForSchool(schoolId),
            prisma.class.count({ where: { schoolId } }),
        ]);

        return {
            studentsCount,
            teachersCount,
            classesCount,
        };
    },

    /**
     * Get student performance analytics for a period
     */
    async getStudentPerformance(studentId: string, periodId?: string) {
        const where: any = { studentId };
        if (periodId) where.periodId = periodId;

        const analytics = await prisma.studentAnalytics.findFirst({
            where,
            orderBy: { createdAt: "desc" },
            include: { subjectPerformances: true },
        });

        return analytics;
    },

    /**
     * Get user-specific statistics
     */
    async getUserStats(_userId: string) {
        const [notificationsCount, unreadNotifications, latestActivity] = await Promise.all([
            prisma.notification.count({
                where: { userId: _userId },
            }),
            prisma.notification.count({
                where: { userId: _userId, isRead: false },
            }),
            prisma.auditLog.findFirst({
                where: { userId: _userId },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true, action: true, entity: true },
            }),
        ]);

        return {
            lastActivityAt: latestActivity?.createdAt ?? null,
            lastActivityAction: latestActivity?.action ?? null,
            lastActivityEntity: latestActivity?.entity ?? null,
            notificationsCount,
            unreadNotifications,
        };
    },

    /**
     * Get grade distribution
     */
    async getGradeDistribution(_schoolId: string, _classId?: string) {
        const currentYear = await prisma.academicYear.findFirst({
            where: { schoolId: _schoolId, isCurrent: true },
            select: { id: true },
        });

        const grades = await prisma.grade.findMany({
            where: {
                deletedAt: null,
                value: { not: null },
                isAbsent: false,
                isExcused: false,
                evaluation: {
                    ...(currentYear ? { period: { academicYearId: currentYear.id } } : {}),
                    classSubject: {
                        class: {
                            schoolId: _schoolId,
                        },
                        ...(_classId ? { classId: _classId } : {}),
                    },
                },
            },
            include: {
                evaluation: {
                    select: { maxGrade: true },
                },
            },
        });

        const bins = [0, 0, 0, 0, 0];

        for (const grade of grades) {
            const normalizedValue = normalizeGradeTo20(
                Number(grade.value),
                Number(grade.evaluation.maxGrade)
            );

            if (normalizedValue === null) continue;

            if (normalizedValue >= 16) bins[0]++;
            else if (normalizedValue >= 14) bins[1]++;
            else if (normalizedValue >= 12) bins[2]++;
            else if (normalizedValue >= 10) bins[3]++;
            else bins[4]++;
        }

        return {
            labels: ["16-20", "14-15.99", "12-13.99", "10-11.99", "<10"],
            datasets: [{ data: bins }]
        };
    },

    /**
     * Get recent activity
     */
    async getRecentActivity(_schoolId: string) {
        const logs = await prisma.auditLog.findMany({
            where: { schoolId: _schoolId },
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
                user: {
                    select: { firstName: true, lastName: true },
                },
            },
        });

        return logs.map((log) => ({
            id: log.id,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId,
            createdAt: log.createdAt,
            userName: `${log.user.firstName} ${log.user.lastName}`,
        }));
    },
};
