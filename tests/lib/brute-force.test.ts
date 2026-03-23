/**
 * Tests for Brute Force Protection module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrismaUser } = vi.hoisted(() => ({
    mockPrismaUser: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: mockPrismaUser,
    },
    default: {
        user: mockPrismaUser,
    },
}))

import {
    recordLoginAttempt,
    isAccountLocked,
    isAccountLockedByEmail,
} from '@/lib/security/brute-force'

describe('Brute Force Protection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ============================================
    // recordLoginAttempt
    // ============================================
    describe('recordLoginAttempt', () => {
        it('should reset attempts on successful login', async () => {
            mockPrismaUser.update.mockResolvedValue({
                failedLoginAttempts: 0,
                lockedUntil: null,
            })

            const result = await recordLoginAttempt('user-1', true)

            expect(result.locked).toBe(false)
            expect(mockPrismaUser.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            })
        })

        it('should increment attempts on failed login', async () => {
            mockPrismaUser.update.mockResolvedValue({
                failedLoginAttempts: 2,
            })

            const result = await recordLoginAttempt('user-1', false)

            expect(result.locked).toBe(false)
            expect(result.attemptsRemaining).toBe(3) // 5 - 2 = 3
        })

        it('should lock account after 5 failed attempts', async () => {
            mockPrismaUser.update
                .mockResolvedValueOnce({ failedLoginAttempts: 5 }) // first update increments
                .mockResolvedValueOnce({}) // second update sets lock

            const result = await recordLoginAttempt('user-1', false)

            expect(result.locked).toBe(true)
            expect(result.until).toBeDefined()
        })

        it('should not lock when below threshold', async () => {
            mockPrismaUser.update.mockResolvedValue({
                failedLoginAttempts: 3,
            })

            const result = await recordLoginAttempt('user-1', false)

            expect(result.locked).toBe(false)
            expect(result.attemptsRemaining).toBe(2) // 5 - 3 = 2
        })
    })

    // ============================================
    // isAccountLocked
    // ============================================
    describe('isAccountLocked', () => {
        it('should return false when no lock date', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: null })

            const result = await isAccountLocked('user-1')
            expect(result).toBe(false)
        })

        it('should return true when lock is still active', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 15)
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: futureDate })

            const result = await isAccountLocked('user-1')
            expect(result).toBe(true)
        })

        it('should return false and clear lock when expired', async () => {
            const pastDate = new Date(Date.now() - 1000)
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: pastDate })
            mockPrismaUser.update.mockResolvedValue({})

            const result = await isAccountLocked('user-1')

            expect(result).toBe(false)
            // Should have cleared the lock
            expect(mockPrismaUser.update).toHaveBeenCalledWith({
                where: { id: 'user-1' },
                data: { lockedUntil: null, failedLoginAttempts: 0 },
            })
        })

        it('should return false for non-existent user', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null)

            const result = await isAccountLocked('unknown')
            expect(result).toBe(false)
        })
    })

    // ============================================
    // isAccountLockedByEmail
    // ============================================
    describe('isAccountLockedByEmail', () => {
        it('should return locked=false when no user found', async () => {
            mockPrismaUser.findUnique.mockResolvedValue(null)

            const result = await isAccountLockedByEmail('unknown@test.com')
            expect(result.locked).toBe(false)
        })

        it('should return locked=false when no lock date', async () => {
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: null })

            const result = await isAccountLockedByEmail('user@test.com')
            expect(result.locked).toBe(false)
        })

        it('should return locked=true with date when locked', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 15)
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: futureDate })

            const result = await isAccountLockedByEmail('user@test.com')
            expect(result.locked).toBe(true)
            expect(result.until).toEqual(futureDate)
        })

        it('should return locked=false when lock has expired', async () => {
            const pastDate = new Date(Date.now() - 1000)
            mockPrismaUser.findUnique.mockResolvedValue({ lockedUntil: pastDate })

            const result = await isAccountLockedByEmail('user@test.com')
            expect(result.locked).toBe(false)
        })
    })
})
