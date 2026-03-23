/**
 * Tests for RGPD/GDPR Compliance module
 * Tests data export sanitization, user anonymization, and data retention.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================
// Mock dependencies
// ============================================
const mockUser = {
    id: 'user-1',
    email: 'jean.dupont@test.com',
    firstName: 'Jean',
    lastName: 'Dupont',
    phone: '+229 90 12 34 56',
    role: 'STUDENT',
    password: '$2a$12$hashedpassword',
    createdAt: new Date('2024-01-15'),
    isActive: true,
    studentProfile: { id: 'sp-1', address: '123 Rue Test' },
    teacherProfile: null,
    parentProfile: null,
    notifications: [{ id: 'n-1' }, { id: 'n-2' }],
    auditLogs: [{ id: 'al-1' }],
    userAchievements: [
        {
            achievement: { name: 'First Login' },
            unlockedAt: new Date('2024-01-16'),
        },
    ],
    mealTickets: [{ id: 'mt-1' }],
}

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        studentProfile: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
        teacherProfile: {
            updateMany: vi.fn(),
        },
        parentProfile: {
            updateMany: vi.fn(),
        },
        notification: {
            deleteMany: vi.fn(),
        },
        message: {
            updateMany: vi.fn(),
            deleteMany: vi.fn(),
        },
        grade: {
            deleteMany: vi.fn(),
        },
        examAnswer: {
            deleteMany: vi.fn(),
        },
        examSession: {
            deleteMany: vi.fn(),
        },
        lessonCompletion: {
            deleteMany: vi.fn(),
        },
        courseEnrollment: {
            deleteMany: vi.fn(),
        },
        studentOrientation: {
            deleteMany: vi.fn(),
        },
        attendance: {
            updateMany: vi.fn(),
        },
        payment: {
            updateMany: vi.fn(),
        },
        medicalRecord: {
            deleteMany: vi.fn(),
            updateMany: vi.fn(),
        },
        sanction: {
            deleteMany: vi.fn(),
        },
        behaviorIncident: {
            updateMany: vi.fn(),
        },
        eventParticipation: {
            deleteMany: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
    default: mockPrisma,
}))

vi.mock('@/lib/security/audit-log', () => ({
    auditLog: {
        dataAccess: vi.fn(),
        securityEvent: vi.fn(),
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

import { exportUserData, anonymizeUser, getDataRetentionStatus } from '@/lib/security/rgpd'
import { auditLog } from '@/lib/security/audit-log'

describe('RGPD Compliance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ============================================
    // DATA EXPORT
    // ============================================
    describe('exportUserData', () => {
        it('should export user data without password', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser)

            const data = await exportUserData('user-1')

            // Should include personal info
            expect(data.personalInfo.email).toBe('jean.dupont@test.com')
            expect(data.personalInfo.firstName).toBe('Jean')
            expect(data.personalInfo.lastName).toBe('Dupont')
            expect(data.personalInfo.phone).toBe('+229 90 12 34 56')
            expect(data.personalInfo.role).toBe('STUDENT')

            // Should NOT include password
            expect((data as any).password).toBeUndefined()
            expect((data.personalInfo as any).password).toBeUndefined()
        })

        it('should include profiles', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser)

            const data = await exportUserData('user-1')

            expect(data.profiles.student).toBeDefined()
            expect(data.profiles.teacher).toBeNull()
            expect(data.profiles.parent).toBeNull()
        })

        it('should include activity data', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser)

            const data = await exportUserData('user-1')

            expect(data.notifications).toHaveLength(2)
            expect(data.auditLogs).toHaveLength(1)
        })

        it('should include achievements', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser)

            const data = await exportUserData('user-1')

            expect(data.achievements).toHaveLength(1)
            expect(data.achievements[0].name).toBe('First Login')
        })

        it('should include canteen tickets', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser)

            const data = await exportUserData('user-1')

            expect(data.canteenTickets).toHaveLength(1)
        })

        it('should include export timestamp', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser)

            const data = await exportUserData('user-1')

            expect(data.exportedAt).toBeDefined()
            expect(new Date(data.exportedAt).getTime()).toBeLessThanOrEqual(Date.now())
        })

        it('should create an audit log for data access', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(mockUser)

            await exportUserData('user-1')

            expect(auditLog.dataAccess).toHaveBeenCalledWith('user-1', 'USER', 'user-1')
        })

        it('should throw error for unknown user', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null)

            await expect(exportUserData('unknown')).rejects.toThrow('User not found')
        })
    })

    // ============================================
    // USER ANONYMIZATION
    // ============================================
    describe('anonymizeUser', () => {
        it('should anonymize user PII', async () => {
            mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))

            await anonymizeUser('user-1', 'admin-1')

            expect(mockPrisma.$transaction).toHaveBeenCalled()
            expect(mockPrisma.user.update).toHaveBeenCalled()
            expect(mockPrisma.studentProfile.updateMany).toHaveBeenCalled()
        })

        it('should create security audit log', async () => {
            mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
            mockPrisma.studentProfile.findUnique.mockResolvedValue(null)

            await anonymizeUser('user-1', 'admin-1')

            expect(auditLog.securityEvent).toHaveBeenCalledWith(
                'admin-1',
                'USER_ANONYMIZATION',
                { targetUserId: 'user-1' }
            )
        })

        it('should return success with anonymized email', async () => {
            mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
            mockPrisma.studentProfile.findUnique.mockResolvedValue(null)

            const result = await anonymizeUser('user-1', 'admin-1')

            expect(result.success).toBe(true)
            expect(result.anonymizedEmail).toContain('deleted_')
            expect(result.anonymizedEmail).toContain('@anonymized.local')
        })
    })

    // ============================================
    // DATA RETENTION STATUS
    // ============================================
    describe('getDataRetentionStatus', () => {
        it('should return retention info for active user', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                createdAt: new Date('2024-01-15'),
                isActive: true,
            })

            const status = await getDataRetentionStatus('user-1')

            expect(status).not.toBeNull()
            expect(status!.isActive).toBe(true)
            expect(status!.retentionPolicy).toContain('5 years')
            expect(parseFloat(status!.dataAgeYears)).toBeGreaterThan(0)
        })

        it('should return null for unknown user', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null)

            const status = await getDataRetentionStatus('unknown')
            expect(status).toBeNull()
        })

        it('should correctly calculate data age', async () => {
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

            mockPrisma.user.findUnique.mockResolvedValue({
                createdAt: oneYearAgo,
                isActive: true,
            })

            const status = await getDataRetentionStatus('user-1')

            expect(status).not.toBeNull()
            expect(parseFloat(status!.dataAgeYears)).toBeCloseTo(1, 0)
        })
    })
})
