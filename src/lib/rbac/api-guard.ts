/**
 * API Route Guards
 * Centralized RBAC checks for API routes
 */

import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { UserRole } from "@prisma/client";
import {
  ADMIN_ROLES,
  SCHOOL_ADMIN_ROLES,
  STUDENT_MANAGER_ROLES,
  TEACHER_MANAGER_ROLES,
  GRADE_MANAGER_ROLES,
  FINANCE_MANAGER_ROLES,
  REPORT_VIEWER_ROLES,
  isAllowedRole,
} from "./permissions";

// ============================================
// AUTHORIZATION ERROR RESPONSES
// ============================================

export function unauthorizedResponse(message: string = "Accès non autorisé") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function unauthenticatedResponse(message: string = "Non authentifié") {
  return NextResponse.json({ error: message }, { status: 401 });
}

// ============================================
// ROLE-BASED GUARDS
// ============================================

/**
 * Require authentication (any authenticated user)
 */
export function requireAuth(session: Session | null): session is Session {
  return session !== null && session.user !== undefined;
}

/**
 * Require specific roles
 */
export function requireRoles(
  session: Session | null,
  allowedRoles: UserRole[]
): { authorized: boolean; response?: NextResponse } {
  if (!requireAuth(session)) {
    return { authorized: false, response: unauthenticatedResponse() };
  }

  const userRole = session.user.role as UserRole;
  if (!isAllowedRole(userRole, allowedRoles)) {
    return { authorized: false, response: unauthorizedResponse() };
  }

  return { authorized: true };
}

/**
 * Require SUPER_ADMIN role
 */
export function requireSuperAdmin(
  session: Session | null
): { authorized: boolean; response?: NextResponse } {
  return requireRoles(session, ADMIN_ROLES);
}

/**
 * Require School Admin roles (SUPER_ADMIN, SCHOOL_ADMIN, DIRECTOR)
 */
export function requireSchoolAdmin(
  session: Session | null
): { authorized: boolean; response?: NextResponse } {
  return requireRoles(session, SCHOOL_ADMIN_ROLES);
}

/**
 * Require roles that can manage students
 */
export function requireStudentManager(
  session: Session | null
): { authorized: boolean; response?: NextResponse } {
  return requireRoles(session, STUDENT_MANAGER_ROLES);
}

/**
 * Require roles that can manage teachers
 */
export function requireTeacherManager(
  session: Session | null
): { authorized: boolean; response?: NextResponse } {
  return requireRoles(session, TEACHER_MANAGER_ROLES);
}

/**
 * Require roles that can manage grades
 */
export function requireGradeManager(
  session: Session | null
): { authorized: boolean; response?: NextResponse } {
  return requireRoles(session, GRADE_MANAGER_ROLES);
}

/**
 * Require roles that can manage finances
 */
export function requireFinanceManager(
  session: Session | null
): { authorized: boolean; response?: NextResponse } {
  return requireRoles(session, FINANCE_MANAGER_ROLES);
}

/**
 * Require roles that can view reports
 */
export function requireReportViewer(
  session: Session | null
): { authorized: boolean; response?: NextResponse } {
  return requireRoles(session, REPORT_VIEWER_ROLES);
}

// ============================================
// SCHOOL ISOLATION CHECKS
// ============================================

/**
 * Check if user has access to a specific school
 */
export function hasSchoolAccess(
  session: Session,
  targetSchoolId: string
): { authorized: boolean; response?: NextResponse } {
  const userRole = session.user.role as UserRole;

  // SUPER_ADMIN has access to all schools
  if (userRole === "SUPER_ADMIN") {
    return { authorized: true };
  }

  // Others can only access their own school
  if (session.user.schoolId !== targetSchoolId) {
    return {
      authorized: false,
      response: unauthorizedResponse("Vous n'avez pas accès à cet établissement"),
    };
  }

  return { authorized: true };
}

/**
 * Verify user belongs to a school (non-SUPER_ADMIN)
 */
export function requireSchoolMembership(
  session: Session
): { authorized: boolean; schoolId: string | null; response?: NextResponse } {
  const userRole = session.user.role as UserRole;

  // SUPER_ADMIN doesn't need school membership
  if (userRole === "SUPER_ADMIN") {
    return { authorized: true, schoolId: null };
  }

  // Others must have a schoolId
  if (!session.user.schoolId) {
    return {
      authorized: false,
      schoolId: null,
      response: NextResponse.json(
        { error: "Vous devez être affilié à un établissement" },
        { status: 400 }
      ),
    };
  }

  return { authorized: true, schoolId: session.user.schoolId };
}

// ============================================
// TEACHER SPECIFIC CHECKS
// ============================================

/**
 * Check if teacher owns a specific classSubject
 */
export function isTeacherOfSubject(
  teacherId: string,
  classSubjectTeacherId: string | null
): boolean {
  return classSubjectTeacherId === teacherId;
}

/**
 * Check if teacher can grade an evaluation
 */
export function canTeacherGrade(
  session: Session,
  evaluationTeacherId: string | null
): { authorized: boolean; response?: NextResponse } {
  const userRole = session.user.role as UserRole;

  // Admins can grade anything
  if (["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(userRole)) {
    return { authorized: true };
  }

  // Teachers can only grade their own subjects
  if (userRole === "TEACHER") {
    if (evaluationTeacherId !== session.user.id) {
      return {
        authorized: false,
        response: unauthorizedResponse("Vous ne pouvez noter que vos propres matières"),
      };
    }
  }

  return { authorized: true };
}

// ============================================
// PARENT SPECIFIC CHECKS
// ============================================

/**
 * Check if a student is a child of the parent
 */
export function isParentOfStudent(
  childrenIds: string[],
  studentId: string
): { authorized: boolean; response?: NextResponse } {
  if (!childrenIds.includes(studentId)) {
    return {
      authorized: false,
      response: unauthorizedResponse("Cet élève n'est pas votre enfant"),
    };
  }

  return { authorized: true };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a standardized forbidden response with role info
 */
export function forbiddenForRole(userRole: UserRole, action: string) {
  return NextResponse.json(
    {
      error: `Le rôle ${userRole} n'est pas autorisé à ${action}`,
      code: "FORBIDDEN",
    },
    { status: 403 }
  );
}

/**
 * Log authorization attempt (for audit)
 */
export function logAuthorizationAttempt(
  userId: string,
  action: string,
  resource: string,
  authorized: boolean
): void {
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[RBAC] User ${userId} ${authorized ? "✅ ALLOWED" : "❌ DENIED"} ${action} on ${resource}`
    );
  }
}
