/**
 * Type definitions for API routes
 * Replacing 'any' types with proper definitions
 */

import { Prisma, UserRole } from "@prisma/client";

// ============================================
// FILTER TYPES FOR API ROUTES
// ============================================

export interface UserWhereFilter {
  schoolId?: string | null;
  role?: UserRole;
  isActive?: boolean;
  email?: { contains: string; mode: "insensitive" };
  OR?: Array<{
    firstName?: { contains: string; mode: "insensitive" };
    lastName?: { contains: string; mode: "insensitive" };
    email?: { contains: string; mode: "insensitive" };
  }>;
}

export interface StudentWhereFilter {
  user?: {
    schoolId?: string | null;
    firstName?: { contains: string; mode: "insensitive" };
    lastName?: { contains: string; mode: "insensitive" };
  };
  matricule?: { contains: string; mode: "insensitive" };
  enrollments?: {
    some: {
      classId?: string;
      academicYearId?: string;
      status?: "ACTIVE" | "TRANSFERRED" | "GRADUATED" | "DROPPED" | "SUSPENDED";
    };
  };
  OR?: Array<{
    matricule?: { contains: string; mode: "insensitive" };
    user?: {
      firstName?: { contains: string; mode: "insensitive" };
      lastName?: { contains: string; mode: "insensitive" };
    };
  }>;
}

export interface GradeWhereFilter {
  evaluationId?: string;
  studentId?: string;
  evaluation?: {
    classSubject?: {
      class?: {
        schoolId?: string;
      };
    };
  };
}

export interface PaymentWhereFilter {
  studentId?: string;
  feeId?: string;
  fee?: {
    schoolId?: string;
  };
}

export interface NotificationWhereFilter {
  userId?: string;
  isRead?: boolean;
}

export interface EvaluationWhereFilter {
  classSubjectId?: string;
  periodId?: string;
  classSubject?: {
    classId?: string;
    class?: {
      schoolId?: string;
    };
  };
}

export interface ClassWhereFilter {
  schoolId?: string;
  classLevelId?: string;
}

export interface SubjectWhereFilter {
  schoolId?: string;
  isActive?: boolean;
}

export interface FeeWhereFilter {
  schoolId?: string;
  academicYearId?: string;
  classLevelCode?: string;
  isActive?: boolean;
}

export interface ScheduleWhereFilter {
  classId?: string;
  classSubjectId?: string;
  class?: {
    schoolId?: string;
  };
}

// ============================================
// UPDATE DATA TYPES
// ============================================

export type UserUpdateData = Prisma.UserUpdateInput;
export type StudentProfileUpdateData = Prisma.StudentProfileUpdateInput;
export type TeacherProfileUpdateData = Prisma.TeacherProfileUpdateInput;
export type ClassUpdateData = Prisma.ClassUpdateInput;
export type SubjectUpdateData = Prisma.SubjectUpdateInput;
export type EvaluationUpdateData = Prisma.EvaluationUpdateInput;
export type GradeUpdateData = Prisma.GradeUpdateInput;
export type PaymentUpdateData = Prisma.PaymentUpdateInput;
export type FeeUpdateData = Prisma.FeeUpdateInput;
export type ScheduleUpdateData = Prisma.ScheduleUpdateInput;

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiErrorResponse {
  error: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// PROFILE TYPES
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  school?: {
    id: string;
    name: string;
  } | null;
  teacherProfile?: {
    id: string;
    matricule: string | null;
    specialization: string | null;
  } | null;
  studentProfile?: {
    id: string;
    matricule: string;
  } | null;
}

// ============================================
// BULLETIN TYPES
// ============================================

export interface BulletinSubjectResult {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  average: number | null;
  appreciation: string;
  evaluationsCount: number;
  grades: Array<{
    title: string;
    date: Date;
    maxGrade: number;
    value: number | null;
    isAbsent: boolean;
  }>;
}

export interface Bulletin {
  student: {
    id: string;
    matricule: string;
    firstName: string;
    lastName: string;
  };
  class: {
    id: string;
    name: string;
    level: string;
  };
  academicYear: string;
  period: string;
  subjects: BulletinSubjectResult[];
  generalAverage: number | null;
  rank: number | null;
  classSize: number;
  appreciation: string;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if a string is a valid CUID
 */
export function isValidCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/.test(id);
}

/**
 * Validate and sanitize a CUID parameter
 */
export function validateCuid(id: string | null | undefined, fieldName: string = "id"): string {
  if (!id) {
    throw new Error(`${fieldName} est requis`);
  }
  if (!isValidCuid(id)) {
    throw new Error(`${fieldName} invalide`);
  }
  return id;
}
