import { prisma } from "@/lib/prisma";

export class GamificationService {
    /**
     * Unlock an achievement for a user
     */
    async unlockAchievement(userId: string, achievementCode: string) {
        const achievement = await prisma.achievement.findUnique({
            where: { code: achievementCode }
        });

        if (!achievement) throw new Error(`Achievement ${achievementCode} not found`);

        // Check if already unlocked
        const existing = await prisma.userAchievement.findUnique({
            where: {
                userId_achievementId: {
                    userId,
                    achievementId: achievement.id
                }
            }
        });

        if (existing) return existing;

        // Unlock
        const userAchievement = await prisma.userAchievement.create({
            data: {
                userId,
                achievementId: achievement.id,
                isUnlocked: true,
                progress: 100
            }
        });

        // Update Leaderboard (Simple implementation: just Add Points)
        await this.addPoints(userId, achievement.points);

        return userAchievement;
    }

    /**
     * Add points to a user's leaderboard score
     */
    async addPoints(userId: string, points: number) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.schoolId) return;

        // simplistic: just one "ALL_TIME" "POINTS" leaderboard per school
        const leaderboard = await prisma.leaderboard.findFirst({
            where: {
                userId,
                schoolId: user.schoolId,
                period: "ALL_TIME",
                type: "POINTS"
            }
        });

        if (leaderboard) {
            await prisma.leaderboard.update({
                where: { id: leaderboard.id },
                data: { score: leaderboard.score + points }
            });
        } else {
            await prisma.leaderboard.create({
                data: {
                    userId,
                    schoolId: user.schoolId,
                    period: "ALL_TIME",
                    type: "POINTS",
                    score: points,
                    rank: 0 // Rank needs recalculation later
                }
            });
        }
    }

    /**
     * Get Leaderboard for a school
     */
    async getLeaderboard(schoolId: string, limit = 10) {
        return prisma.leaderboard.findMany({
            where: {
                schoolId,
                period: "ALL_TIME",
                type: "POINTS"
            },
            orderBy: { score: 'desc' },
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true, // Maybe only show students?
                        avatar: true
                    }
                }
            }
        });
    }

    /**
      * Get User Achievements
      */
    async getUserAchievements(userId: string) {
        return prisma.userAchievement.findMany({
            where: { userId },
            include: { achievement: true }
        });
    }
}

export const gamificationService = new GamificationService();
