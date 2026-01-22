import { prisma } from "@/lib/prisma";

export class AnalyticsService {
    /**
     * Get school-wide statistics
     */
    async getSchoolStats(schoolId: string) {
        const [
            studentCount,
            teacherCount,
            classCount,
            attendanceToday,
            paymentsThisMonth,
            overdueBooks,
        ] = await Promise.all([
            prisma.studentProfile.count({
                where: { enrollments: { some: { class: { schoolId } } } },
            }),
            prisma.teacherProfile.count({
                where: { assignments: { some: { schoolId } } },
            }),
            prisma.class.count({ where: { schoolId } }),
            this.getTodayAttendance(schoolId),
            this.getMonthlyPayments(schoolId),
            prisma.borrowingRecord.count({
                where: {
                    book: { schoolId },
                    status: "BORROWED",
                    dueDate: { lt: new Date() },
                },
            }),
        ]);

        return {
            students: studentCount,
            teachers: teacherCount,
            classes: classCount,
            attendance: attendanceToday,
            payments: paymentsThisMonth,
            overdueBooks,
        };
    }

    private async getTodayAttendance(schoolId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [present, absent] = await Promise.all([
            prisma.attendance.count({
                where: {
                    date: { gte: today },
                    status: "PRESENT",
                    student: { enrollments: { some: { class: { schoolId } } } },
                },
            }),
            prisma.attendance.count({
                where: {
                    date: { gte: today },
                    status: "ABSENT",
                    student: { enrollments: { some: { class: { schoolId } } } },
                },
            }),
        ]);

        const total = present + absent;
        return {
            present,
            absent,
            rate: total > 0 ? Math.round((present / total) * 100) : 0,
        };
    }

    private async getMonthlyPayments(schoolId: string) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const result = await prisma.payment.aggregate({
            where: {
                fee: { schoolId },
                status: "VERIFIED",
                paidAt: { gte: startOfMonth },
            },
            _sum: { amount: true },
            _count: true,
        });

        return {
            total: result._sum.amount?.toNumber() || 0,
            count: result._count,
        };
    }

    /**
     * Get grade distribution for a class or school
     */
    async getGradeDistribution(schoolId: string, classId?: string) {
        const grades = await prisma.grade.findMany({
            where: {
                evaluation: {
                    classSubject: {
                        class: classId ? { id: classId } : { schoolId },
                    },
                },
            },
            select: { value: true },
        });

        const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
        for (const g of grades) {
            if (!g.value) continue;
            const v = g.value.toNumber();
            if (v >= 16) distribution.A++;
            else if (v >= 14) distribution.B++;
            else if (v >= 12) distribution.C++;
            else if (v >= 10) distribution.D++;
            else distribution.F++;
        }

        return distribution;
    }

    /**
     * Get recent activity feed
     */
    async getRecentActivity(schoolId: string, limit = 10) {
        const logs = await prisma.auditLog.findMany({
            where: {
                user: { schoolId },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                action: true,
                entity: true,
                createdAt: true,
                user: { select: { firstName: true, lastName: true } },
            },
        });

        return logs.map((l) => ({
            action: l.action,
            entity: l.entity,
            user: `${l.user.firstName} ${l.user.lastName}`,
            time: l.createdAt,
        }));
    }

    /**
     * Get user specific stats (e.g. streak)
     */
    async getUserStats(userId: string) {
        // fetch last 30 login logs
        const logs = await prisma.auditLog.findMany({
            where: {
                userId,
                action: "LOGIN",
            },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { createdAt: true },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let streak = 0;
        let todayCompleted = false;

        // Simple streak calculation
        if (logs.length > 0) {
            const lastLogin = new Date(logs[0].createdAt);
            lastLogin.setHours(0, 0, 0, 0);

            if (lastLogin.getTime() === today.getTime()) {
                todayCompleted = true;
                streak = 1;
            }

            // Check previous days
            let checkDate = new Date(today);
            if (!todayCompleted) {
                // if not logged in today yet, check from yesterday
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                checkDate.setDate(checkDate.getDate() - 1);
            }

            // This is a simplified O(N) check. 
            // Real implementation might need more robust date handling.
            for (let i = 0; i < logs.length; i++) {
                const logDate = new Date(logs[i].createdAt);
                logDate.setHours(0, 0, 0, 0);

                if (logDate.getTime() > checkDate.getTime()) continue; // multiple logins same day

                if (logDate.getTime() === checkDate.getTime()) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    // Break in streak
                    break;
                }
            }
        }

        return {
            streak,
            todayCompleted,
            longestStreak: streak, // For now assume current is longest or store max in user profile
        };
    }
}

export const analyticsService = new AnalyticsService();
