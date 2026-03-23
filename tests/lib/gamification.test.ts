/**
 * Tests for Gamification Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        achievement: {
            findUnique: vi.fn(),
        },
        userAchievement: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        leaderboard: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
    default: mockPrisma,
}))

import { GamificationService } from '@/lib/gamification/service'

describe('Gamification Service', () => {
    let service: GamificationService

    beforeEach(() => {
        vi.clearAllMocks()
        service = new GamificationService()
    })

    // ============================================
    // unlockAchievement
    // ============================================
    describe('unlockAchievement', () => {
        it('should throw for unknown achievement', async () => {
            mockPrisma.achievement.findUnique.mockResolvedValue(null)

            await expect(
                service.unlockAchievement('user-1', 'INVALID_CODE')
            ).rejects.toThrow('Achievement INVALID_CODE not found')
        })

        it('should return existing if already unlocked', async () => {
            const existing = { id: 'ua-1', userId: 'user-1', achievementId: 'ach-1' }
            mockPrisma.achievement.findUnique.mockResolvedValue({ id: 'ach-1', code: 'FIRST_LOGIN', points: 10 })
            mockPrisma.userAchievement.findUnique.mockResolvedValue(existing)

            const result = await service.unlockAchievement('user-1', 'FIRST_LOGIN')
            expect(result).toEqual(existing)
            expect(mockPrisma.userAchievement.create).not.toHaveBeenCalled()
        })

        it('should create new achievement and add points', async () => {
            const achievement = { id: 'ach-1', code: 'FIRST_LOGIN', points: 10 }
            const created = { id: 'ua-1', userId: 'user-1', achievementId: 'ach-1' }

            mockPrisma.achievement.findUnique.mockResolvedValue(achievement)
            mockPrisma.userAchievement.findUnique.mockResolvedValue(null)
            mockPrisma.userAchievement.create.mockResolvedValue(created)
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', schoolId: 'school-1' })
            mockPrisma.leaderboard.findFirst.mockResolvedValue(null)
            mockPrisma.leaderboard.create.mockResolvedValue({})

            const result = await service.unlockAchievement('user-1', 'FIRST_LOGIN')

            expect(result).toEqual(created)
            expect(mockPrisma.userAchievement.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-1',
                    achievementId: 'ach-1',
                },
            })
        })
    })

    // ============================================
    // addPoints
    // ============================================
    describe('addPoints', () => {
        it('should create leaderboard entry if none exists', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', schoolId: 'school-1' })
            mockPrisma.leaderboard.findFirst.mockResolvedValue(null)
            mockPrisma.leaderboard.create.mockResolvedValue({})

            await service.addPoints('user-1', 50)

            expect(mockPrisma.leaderboard.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user-1',
                    schoolId: 'school-1',
                    period: 'ALL_TIME',
                    points: 50,
                    rank: 0,
                },
            })
        })

        it('should update existing leaderboard entry', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', schoolId: 'school-1' })
            mockPrisma.leaderboard.findFirst.mockResolvedValue({ id: 'lb-1', points: 100 })
            mockPrisma.leaderboard.update.mockResolvedValue({})

            await service.addPoints('user-1', 50)

            expect(mockPrisma.leaderboard.update).toHaveBeenCalledWith({
                where: { id: 'lb-1' },
                data: { points: 150 },
            })
        })

        it('should do nothing for user without school', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', schoolId: null })

            await service.addPoints('user-1', 50)

            expect(mockPrisma.leaderboard.findFirst).not.toHaveBeenCalled()
        })

        it('should do nothing for non-existent user', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null)

            await service.addPoints('unknown', 50)

            expect(mockPrisma.leaderboard.findFirst).not.toHaveBeenCalled()
        })
    })

    // ============================================
    // getLeaderboard
    // ============================================
    describe('getLeaderboard', () => {
        it('should return ordered leaderboard with user info', async () => {
            const leaderboardData = [
                { id: 'lb-1', points: 150, user: { id: 'u1', firstName: 'Jean', lastName: 'D', role: 'STUDENT', avatar: null } },
                { id: 'lb-2', points: 100, user: { id: 'u2', firstName: 'Marie', lastName: 'A', role: 'STUDENT', avatar: null } },
            ]
            mockPrisma.leaderboard.findMany.mockResolvedValue(leaderboardData)

            const result = await service.getLeaderboard('school-1')

            expect(result).toHaveLength(2)
            expect(result[0].points).toBe(150)
            expect(mockPrisma.leaderboard.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { schoolId: 'school-1', period: 'ALL_TIME' },
                    orderBy: { points: 'desc' },
                    take: 10,
                })
            )
        })

        it('should respect custom limit', async () => {
            mockPrisma.leaderboard.findMany.mockResolvedValue([])

            await service.getLeaderboard('school-1', 5)

            expect(mockPrisma.leaderboard.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 5 })
            )
        })
    })

    // ============================================
    // getUserAchievements
    // ============================================
    describe('getUserAchievements', () => {
        it('should return user achievements with details', async () => {
            const achievements = [
                { id: 'ua-1', achievement: { name: 'First Login', points: 10 } },
                { id: 'ua-2', achievement: { name: 'Perfect Score', points: 50 } },
            ]
            mockPrisma.userAchievement.findMany.mockResolvedValue(achievements)

            const result = await service.getUserAchievements('user-1')

            expect(result).toHaveLength(2)
            expect(mockPrisma.userAchievement.findMany).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
                include: { achievement: true },
            })
        })
    })
})
