/**
 * Tests for Security modules - Account Lockout, Brute Force, RGPD
 * All Prisma calls are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================
// Mock Prisma — use vi.hoisted() to avoid hoisting issues
// ============================================
const { mockPrismaUser, mockPrismaAuditLog, mockPrismaTransaction } = vi.hoisted(() => ({
    mockPrismaUser: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
    },
    mockPrismaAuditLog: {
        create: vi.fn(),
    },
    mockPrismaTransaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        user: mockPrismaUser,
        auditLog: mockPrismaAuditLog,
        studentProfile: { updateMany: vi.fn() },
        $transaction: mockPrismaTransaction,
    },
    prisma: {
        user: mockPrismaUser,
        auditLog: mockPrismaAuditLog,
        studentProfile: { updateMany: vi.fn() },
        $transaction: mockPrismaTransaction,
    },
}))

vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue('127.0.0.1'),
    }),
}))

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}))

// ============================================
// Import modules under test
// ============================================
import {
    recordFailedLoginAttempt,
    isAccountLocked,
    resetFailedLoginAttempts,
    unlockAccount,
    getRemainingLockoutTime,
} from '@/lib/auth/account-lockout'

describe('Account Lockout Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ============================================
    // recordFailedLoginAttempt
    // ============================================
    describe('recordFailedLoginAttempt', () => {
        it('should increment failed attempts and return remaining attempts', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({
                failedLoginAttempts: 1,
                lockedUntil: null,
            })
            mockPrismaUser.update.mockResolvedValue({})

            const result = await recordFailedLoginAttempt('user-1')

            expect(result.isLocked).toBe(false)
            expect(result.remainingAttempts).toBe(3) // 5 - 2 = 3
            expect(mockPrismaUser.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'user-1' },
                    data: expect.objectContaining({
                        failedLoginAttempts: 2,
                    }),
                })
            )
        })

        it('should lock account after 5 failed attempts', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({
                failedLoginAttempts: 4,
                lockedUntil: null,
            })
            mockPrismaUser.update.mockResolvedValue({})
            mockPrismaAuditLog.create.mockResolvedValue({})

            const result = await recordFailedLoginAttempt('user-1')

            expect(result.isLocked).toBe(true)
            expect(result.lockedUntil).toBeDefined()
            expect(result.remainingAttempts).toBe(0)
        })

        it('should return locked status if already locked', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 30)
            mockPrismaUser.findUnique.mockResolvedValue({
                failedLoginAttempts: 5,
                lockedUntil: futureDate,
            })

            const result = await recordFailedLoginAttempt('user-1')

            expect(result.isLocked).toBe(true)
            expect(result.lockedUntil).toEqual(futureDate)
            expect(result.remainingAttempts).toBe(0)
        })

        it('should throw error for unknown user', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null)

            await expect(recordFailedLoginAttempt('unknown')).rejects.toThrow('User not found')
        })

        it('should create audit log when account is locked', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({
                failedLoginAttempts: 4,
                lockedUntil: null,
            })
            mockPrismaUser.update.mockResolvedValue({})
            mockPrismaAuditLog.create.mockResolvedValue({})

            await recordFailedLoginAttempt('user-1')

            expect(mockPrismaAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 'user-1',
                        action: 'ACCOUNT_LOCKED',
                    }),
                })
            )
        })
    })

    // ============================================
    // isAccountLocked
    // ============================================
    describe('isAccountLocked', () => {
        it('should return not locked for user without lockedUntil', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: null })

            const result = await isAccountLocked('user-1')
            expect(result.isLocked).toBe(false)
        })

        it('should return locked for user with future lockedUntil', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 30)
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: futureDate })

            const result = await isAccountLocked('user-1')
            expect(result.isLocked).toBe(true)
            expect(result.lockedUntil).toEqual(futureDate)
        })

        it('should return not locked for user with expired lockedUntil', async () => {
            const pastDate = new Date(Date.now() - 1000 * 60)
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: pastDate })

            const result = await isAccountLocked('user-1')
            expect(result.isLocked).toBe(false)
        })

        it('should return not locked for unknown user', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null)

            const result = await isAccountLocked('unknown')
            expect(result.isLocked).toBe(false)
        })
    })

    // ============================================
    // resetFailedLoginAttempts
    // ============================================
    describe('resetFailedLoginAttempts', () => {
        it('should reset attempts to 0 and clear lock', async () => {
            mockPrismaUser.update.mockResolvedValue({})

            await resetFailedLoginAttempts('user-1')

            expect(mockPrismaUser.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: {
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
            })
        })
    })

    // ============================================
    // unlockAccount
    // ============================================
    describe('unlockAccount', () => {
        it('should unlock account and create audit log', async () => {
            mockPrismaUser.update.mockResolvedValue({})
            mockPrismaAuditLog.create.mockResolvedValue({})

            await unlockAccount('user-1', 'admin-1')

            expect(mockPrismaUser.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            })

            expect(mockPrismaAuditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 'admin-1',
                        action: 'ACCOUNT_UNLOCKED',
                        entityId: 'user-1',
                    }),
                })
            )
        })
    })

    // ============================================
    // getRemainingLockoutTime
    // ============================================
    describe('getRemainingLockoutTime', () => {
        it('should return remaining seconds', () => {
            const lockedUntil = new Date(Date.now() + 60000) // 60 seconds from now
            const remaining = getRemainingLockoutTime(lockedUntil)

            expect(remaining).toBeGreaterThan(55)
            expect(remaining).toBeLessThanOrEqual(60)
        })

        it('should return 0 for expired lock', () => {
            const lockedUntil = new Date(Date.now() - 60000) // 60 seconds ago
            const remaining = getRemainingLockoutTime(lockedUntil)

            expect(remaining).toBe(0)
        })
    })
})
