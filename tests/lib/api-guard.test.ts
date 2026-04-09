/**
 * Tests for RBAC API Guard module
 * Tests authorization functions, school isolation, and role-specific checks.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/rbac/permissions', () => {
    const Permission = {
        SCHOOL_CREATE: 'school:create',
        SCHOOL_READ: 'school:read',
        GRADE_CREATE: 'grade:create',
        GRADE_READ: 'grade:read',
        STUDENT_READ: 'student:read',
        CLASS_READ: 'class:read',
    }

    return {
        Permission,
        ADMIN_ROLES: ['SUPER_ADMIN'],
        SCHOOL_ADMIN_ROLES: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'],
        STUDENT_MANAGER_ROLES: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'],
        TEACHER_MANAGER_ROLES: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'],
        GRADE_MANAGER_ROLES: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'TEACHER'],
        FINANCE_MANAGER_ROLES: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'],
        REPORT_VIEWER_ROLES: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR'],
        isAllowedRole: (role: string, allowedRoles: string[]) => allowedRoles.includes(role),
        rolePermissions: {},
    }
})

import {
    requireAuth,
    requireRoles,
    requireSuperAdmin,
    requireSchoolAdmin,
    hasSchoolAccess,
    requireSchoolMembership,
    isTeacherOfSubject,
    canTeacherGrade,
    isParentOfStudent,
    forbiddenForRole,
    logAuthorizationAttempt,
} from '@/lib/rbac/api-guard'

// Helper to create a mock session
function mockSession(
    role: string,
    schoolId: string | null = 'school-1',
    userId: string = 'user-1',
    accessibleSchoolIds?: string[]
) {
    return {
        user: {
            id: userId,
            role,
            schoolId,
            accessibleSchoolIds,
            name: 'Test User',
            email: 'test@test.com',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
    } as any
}

describe('API Guard - RBAC', () => {

    // ============================================
    // requireAuth
    // ============================================
    describe('requireAuth', () => {
        it('should return true for authenticated session', () => {
            const session = mockSession('TEACHER')
            expect(requireAuth(session)).toBe(true)
        })

        it('should return false for null session', () => {
            expect(requireAuth(null)).toBe(false)
        })

        it('should return false for session without user', () => {
            expect(requireAuth({ expires: '' } as any)).toBe(false)
        })
    })

    // ============================================
    // requireRoles
    // ============================================
    describe('requireRoles', () => {
        it('should authorize user with matching role', () => {
            const session = mockSession('SUPER_ADMIN')
            const result = requireRoles(session, ['SUPER_ADMIN', 'SCHOOL_ADMIN'] as any)
            expect(result.authorized).toBe(true)
        })

        it('should deny user without matching role', () => {
            const session = mockSession('STUDENT')
            const result = requireRoles(session, ['SUPER_ADMIN'] as any)
            expect(result.authorized).toBe(false)
            expect(result.response).toBeDefined()
        })

        it('should deny unauthenticated requests', () => {
            const result = requireRoles(null, ['SUPER_ADMIN'] as any)
            expect(result.authorized).toBe(false)
        })
    })

    // ============================================
    // requireSuperAdmin
    // ============================================
    describe('requireSuperAdmin', () => {
        it('should authorize SUPER_ADMIN', () => {
            const session = mockSession('SUPER_ADMIN')
            const result = requireSuperAdmin(session)
            expect(result.authorized).toBe(true)
        })

        it('should deny SCHOOL_ADMIN', () => {
            const session = mockSession('SCHOOL_ADMIN')
            const result = requireSuperAdmin(session)
            expect(result.authorized).toBe(false)
        })

        it('should deny TEACHER', () => {
            const session = mockSession('TEACHER')
            const result = requireSuperAdmin(session)
            expect(result.authorized).toBe(false)
        })
    })

    // ============================================
    // requireSchoolAdmin
    // ============================================
    describe('requireSchoolAdmin', () => {
        it('should authorize SUPER_ADMIN', () => {
            const result = requireSchoolAdmin(mockSession('SUPER_ADMIN'))
            expect(result.authorized).toBe(true)
        })

        it('should authorize SCHOOL_ADMIN', () => {
            const result = requireSchoolAdmin(mockSession('SCHOOL_ADMIN'))
            expect(result.authorized).toBe(true)
        })

        it('should authorize DIRECTOR', () => {
            const result = requireSchoolAdmin(mockSession('DIRECTOR'))
            expect(result.authorized).toBe(true)
        })

        it('should deny TEACHER', () => {
            const result = requireSchoolAdmin(mockSession('TEACHER'))
            expect(result.authorized).toBe(false)
        })

        it('should deny STUDENT', () => {
            const result = requireSchoolAdmin(mockSession('STUDENT'))
            expect(result.authorized).toBe(false)
        })
    })

    // ============================================
    // hasSchoolAccess
    // ============================================
    describe('hasSchoolAccess (school isolation)', () => {
        it('should allow SUPER_ADMIN access to any school', () => {
            const session = mockSession('SUPER_ADMIN', null)
            const result = hasSchoolAccess(session, 'any-school-id')
            expect(result.authorized).toBe(true)
        })

        it('should allow user access to their own school', () => {
            const session = mockSession('TEACHER', 'school-1')
            const result = hasSchoolAccess(session, 'school-1')
            expect(result.authorized).toBe(true)
        })

        it('should deny user access to another school', () => {
            const session = mockSession('TEACHER', 'school-1')
            const result = hasSchoolAccess(session, 'school-2')
            expect(result.authorized).toBe(false)
        })

        it('should allow access to another explicitly accessible school', () => {
            const session = mockSession('TEACHER', 'school-1', 'user-1', ['school-1', 'school-2'])
            const result = hasSchoolAccess(session, 'school-2')
            expect(result.authorized).toBe(true)
        })
    })

    // ============================================
    // requireSchoolMembership
    // ============================================
    describe('requireSchoolMembership', () => {
        it('should allow SUPER_ADMIN without school', () => {
            const session = mockSession('SUPER_ADMIN', null)
            const result = requireSchoolMembership(session)
            expect(result.authorized).toBe(true)
            expect(result.schoolId).toBeNull()
        })

        it('should allow user with school', () => {
            const session = mockSession('TEACHER', 'school-1')
            const result = requireSchoolMembership(session)
            expect(result.authorized).toBe(true)
            expect(result.schoolId).toBe('school-1')
        })

        it('should deny non-admin without school', () => {
            const session = mockSession('TEACHER', null)
            const result = requireSchoolMembership(session)
            expect(result.authorized).toBe(false)
        })
    })

    // ============================================
    // Teacher-specific checks
    // ============================================
    describe('isTeacherOfSubject', () => {
        it('should return true when teacher owns the subject', () => {
            expect(isTeacherOfSubject('teacher-1', 'teacher-1')).toBe(true)
        })

        it('should return false when teacher does not own the subject', () => {
            expect(isTeacherOfSubject('teacher-1', 'teacher-2')).toBe(false)
        })

        it('should return false for null classSubjectTeacherId', () => {
            expect(isTeacherOfSubject('teacher-1', null)).toBe(false)
        })
    })

    describe('canTeacherGrade', () => {
        it('should allow admins to grade anything', () => {
            const result = canTeacherGrade(mockSession('SUPER_ADMIN'), 'any-teacher-id')
            expect(result.authorized).toBe(true)
        })

        it('should allow SCHOOL_ADMIN to grade anything', () => {
            const result = canTeacherGrade(mockSession('SCHOOL_ADMIN'), 'any-teacher-id')
            expect(result.authorized).toBe(true)
        })

        it('should allow DIRECTOR to grade anything', () => {
            const result = canTeacherGrade(mockSession('DIRECTOR'), 'any-teacher-id')
            expect(result.authorized).toBe(true)
        })

        it('should allow teacher to grade their own subjects', () => {
            const session = mockSession('TEACHER', 'school-1', 'teacher-1')
            const result = canTeacherGrade(session, 'teacher-1')
            expect(result.authorized).toBe(true)
        })

        it('should deny teacher grading other subjects', () => {
            const session = mockSession('TEACHER', 'school-1', 'teacher-1')
            const result = canTeacherGrade(session, 'teacher-2')
            expect(result.authorized).toBe(false)
        })
    })

    // ============================================
    // Parent-specific checks
    // ============================================
    describe('isParentOfStudent', () => {
        it('should authorize parent for their child', () => {
            const result = isParentOfStudent(['student-1', 'student-2'], 'student-1')
            expect(result.authorized).toBe(true)
        })

        it('should deny parent for other student', () => {
            const result = isParentOfStudent(['student-1'], 'student-3')
            expect(result.authorized).toBe(false)
        })

        it('should deny parent with empty children list', () => {
            const result = isParentOfStudent([], 'student-1')
            expect(result.authorized).toBe(false)
        })
    })

    // ============================================
    // Utility functions
    // ============================================
    describe('forbiddenForRole', () => {
        it('should return a 403 response with role info', () => {
            const response = forbiddenForRole('TEACHER' as any, "créer une école")
            expect(response.status).toBe(403)
        })
    })

    describe('logAuthorizationAttempt', () => {
        it('should log without throwing in development', () => {
            expect(() => {
                logAuthorizationAttempt('user-1', 'READ', 'students', true)
            }).not.toThrow()
        })

        it('should log denied access', () => {
            expect(() => {
                logAuthorizationAttempt('user-1', 'DELETE', 'school', false)
            }).not.toThrow()
        })
    })
})
