/**
 * GamificationService — Achievements, points et classements
 */
import prisma from "@/lib/prisma";

export class GamificationService {
    async unlockAchievement(userId: string, achievementCode: string) {
        const achievement = await prisma.achievement.findUnique({
            where: { code: achievementCode },
        });

        if (!achievement) {
            throw new Error(`Achievement ${achievementCode} not found`);
        }

        // Check if already unlocked
        const existing = await prisma.userAchievement.findUnique({
            where: { userId_achievementId: { userId, achievementId: achievement.id } },
        });

        if (existing) {
            return existing;
        }

        // Create new achievement
        const userAchievement = await prisma.userAchievement.create({
            data: {
                userId,
                achievementId: achievement.id,
            },
        });

        // Add points to leaderboard
        await this.addPoints(userId, achievement.points);

        return userAchievement;
    }

    async addPoints(userId: string, points: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, schoolId: true },
        });

        if (!user || !user.schoolId) return;

        const existing = await prisma.leaderboard.findFirst({
            where: { userId, schoolId: user.schoolId, period: "ALL_TIME" },
        });

        if (existing) {
            await prisma.leaderboard.update({
                where: { id: existing.id },
                data: { points: existing.points + points },
            });
        } else {
            await prisma.leaderboard.create({
                data: {
                    userId,
                    schoolId: user.schoolId,
                    period: "ALL_TIME",
                    points,
                    rank: 0,
                },
            });
        }
    }

    async getLeaderboard(schoolId: string, limit = 10) {
        return prisma.leaderboard.findMany({
            where: { schoolId, period: "ALL_TIME" },
            orderBy: { points: "desc" },
            take: limit,
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, role: true, avatar: true },
                },
            },
        });
    }

    async getUserAchievements(userId: string) {
        return prisma.userAchievement.findMany({
            where: { userId },
            include: { achievement: true },
        });
    }
}

export const gamificationService = new GamificationService();
