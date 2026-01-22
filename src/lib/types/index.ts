// ============================================
// TYPES centraux - EduPilot
// ============================================

import type {
  User,
  UserRole,
  School,
  ClassLevel,
  Class,
  Subject,
  ClassSubject,
  Enrollment,
  AcademicYear,
  Period,
  Evaluation,
  EvaluationType,
  Grade,
  Attendance,
  Homework,
  HomeworkSubmission,
  Resource,
  Course,
  CourseModule,
  Lesson,
  CourseEnrollment,
  LessonCompletion,
  ExamTemplate,
  Question,
  ExamSession,
  ExamAnswer,
  MedicalRecord,
  Allergy,
  Vaccination,
  EmergencyContact,
  SchoolEvent,
  EventParticipation,
  BehaviorIncident,
  Sanction,
  Appointment,
  DataConsent,
  DataAccessRequest,
  DataRetentionPolicy,
  SchoolHoliday,
  PublicHoliday,
  StudentOrientation,
  OrientationRecommendation,
  SubjectGroupAnalysis,
  Fee,
  Payment,
  PaymentPlan,
  InstallmentPayment,
  Scholarship,
  AuditLog,
  Notification,
  Schedule,
  TeacherAvailability,
  StudentAnalytics,
  SubjectPerformance,
  GradeHistory,
  City,
  Profession,
  Nationality,
  SubjectCategory,
  ConfigOption,
  SystemSetting,
} from "@prisma/client";

// ============================================
// TYPES UTILISATEURS
// ============================================

export type { User, UserRole, School };

export interface UserWithProfile extends User {
  teacherProfile?: TeacherProfile;
  studentProfile?: StudentProfile;
  parentProfile?: ParentProfile;
}

export interface TeacherProfile {
  id: string;
  userId: string;
  employeeId: string | null;
  subjectSpecialization: string | null;
  qualification: string | null;
  hireDate: Date | null;
  contractType: "FULL_TIME" | "PART_TIME" | "CONTRACT" | null;
  user: User;
}

export interface StudentProfile {
  id: string;
  userId: string;
  studentId: string;
  birthDate: Date | null;
  birthPlace: string | null;
  gender: "MALE" | "FEMALE" | null;
  address: string | null;
  cityId: string | null;
  previousSchool: string | null;
  entryDate: Date | null;
  user: User;
  enrollments: Enrollment[];
}

export interface ParentProfile {
  id: string;
  userId: string;
  profession: string | null;
  workplace: string | null;
  children: ParentStudent[];
  user: User;
}

export interface ParentStudent {
  id: string;
  parentId: string;
  studentId: string;
  relationship: "FATHER" | "MOTHER" | "TUTOR" | "OTHER";
  isPrimary: boolean;
  student: StudentProfile;
}

// ============================================
// TYPES SCOLAIRES
// ============================================

export type { ClassLevel, Class, Subject, ClassSubject, Enrollment };

export interface ClassWithDetails extends Class {
  classLevel: ClassLevel;
  classSubjects: ClassSubjectWithTeacher[];
  _count: { enrollments: number };
}

export interface ClassSubjectWithTeacher extends ClassSubject {
  teacher: { user: User };
  subject: Subject;
}

export type { AcademicYear, Period };

export interface PeriodWithYear extends Period {
  academicYear: AcademicYear;
}

// ============================================
// TYPES NOTES & ÉVALUATIONS
// ============================================

export type { EvaluationType, Evaluation, Grade };

export interface GradeWithDetails extends Grade {
  evaluation: EvaluationWithClassSubject;
  student: { user: User };
}

export interface EvaluationWithClassSubject extends Evaluation {
  classSubject: ClassSubject;
  period: Period;
  type: EvaluationType;
}

export interface EvaluationWithGrades extends Evaluation {
  grades: Grade[];
  classSubject: ClassSubject;
  period: Period;
  type: EvaluationType;
  _count: { grades: number };
}

export type { StudentAnalytics, SubjectPerformance, GradeHistory };

// ============================================
// TYPES PRÉSENCE
// ============================================

export type { Attendance };

export interface AttendanceWithStudent extends Attendance {
  student: {
    id: string;
    user: User;
  };
  recordedBy: {
    id: string;
    user: User;
  };
}

// ============================================
// TYPES DEVOIRS
// ============================================

export type { Homework, HomeworkSubmission };

export interface HomeworkWithDetails extends Homework {
  classSubject: ClassSubject;
  submissions: HomeworkSubmission[];
  _count: { submissions: number };
}

// ============================================
// TYPES RESSOURCES
// ============================================

export type { Resource };

export interface ResourceWithUploader extends Resource {
  uploadedBy: {
    id: string;
    user: User;
  };
}

// ============================================
// TYPES LMS
// ============================================

export type { Course, CourseModule, Lesson, CourseEnrollment, LessonCompletion };

export interface CourseWithDetails extends Course {
  modules: CourseModule[];
  enrollments: CourseEnrollment[];
  classSubject?: ClassSubject;
  _count: { enrollments: number; modules: number };
}

export interface LessonWithCompletion extends Lesson {
  completions: LessonCompletion[];
  module: CourseModule;
}

// ============================================
// TYPES EXAMENS
// ============================================

export type { ExamTemplate, Question, ExamSession, ExamAnswer };

export interface QuestionWithExam extends Question {
  examTemplate: ExamTemplate;
}

export interface ExamSessionWithDetails extends ExamSession {
  examTemplate: ExamTemplate;
  student: { user: User };
  answers: ExamAnswer[];
}

// ============================================
// TYPES MÉDICAUX
// ============================================

export type { MedicalRecord, Allergy, Vaccination, EmergencyContact };

export interface MedicalRecordWithDetails extends MedicalRecord {
  allergies: Allergy[];
  vaccinations: Vaccination[];
  emergencyContacts: EmergencyContact[];
  student: { user: User };
}

// ============================================
// TYPES ÉVÉNEMENTS
// ============================================

export type { SchoolEvent, EventParticipation };

export interface SchoolEventWithDetails extends SchoolEvent {
  participations: EventParticipation[];
  _count: { participations: number };
}

// ============================================
// TYPES DISCIPLINE
// ============================================

export type { BehaviorIncident, Sanction };

export interface IncidentWithStudent extends BehaviorIncident {
  student: { user: User };
  reporter: { user: User };
  sanctions: Sanction[];
}

// ============================================
// TYPES RENDEZ-VOUS
// ============================================

export type { Appointment };

export interface AppointmentWithDetails extends Appointment {
  student: { user: User };
  parent: { user: User };
  teacher: { user: User };
}

// ============================================
// TYPES FINANCES
// ============================================

export type { Fee, Payment, PaymentPlan, InstallmentPayment, Scholarship };

export interface PaymentWithDetails extends Payment {
  student: { user: User };
  fee: Fee;
  verifiedBy?: { user: User };
}

export interface PaymentPlanWithDetails {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  studentId: string;
  feeId: string;
  totalAmount: any;
  installmentsCount: number;
  paidAmount: any;
  student: { user: User };
  fee: Fee;
  installmentPayments: InstallmentPayment[];
}

// ============================================
// TYPES ORIENTATION
// ============================================

export type { StudentOrientation, OrientationRecommendation, SubjectGroupAnalysis };

export interface OrientationWithDetails extends StudentOrientation {
  recommendations: OrientationRecommendation[];
  subjectAnalyses: SubjectGroupAnalysis[];
  student: { user: User };
}

// ============================================
// TYPES CALENDRIER
// ============================================

export type { SchoolHoliday, PublicHoliday, Schedule, TeacherAvailability };

export interface ScheduleWithDetails extends Schedule {
  class: Class;
  classSubject: ClassSubject;
}

// ============================================
// TYPES SYSTÈME
// ============================================

export type { AuditLog, Notification, DataConsent, DataAccessRequest, DataRetentionPolicy };

export interface NotificationWithUser extends Notification {
  user: User;
}

export interface AuditLogWithUser extends AuditLog {
  user?: User;
}

// ============================================
// TYPES RÉFÉRENCE
// ============================================

export type { City, Profession, Nationality, SubjectCategory, ConfigOption, SystemSetting };

// ============================================
// TYPES API
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string | number | boolean | null>;
}

// ============================================
// TYPES SESSION (NextAuth)
// ============================================

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  schoolId: string | null;
  image?: string | null;
}

// ============================================
// ENUMS
// ============================================

export const UserRoleEnum = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SCHOOL_ADMIN: "SCHOOL_ADMIN",
  DIRECTOR: "DIRECTOR",
  TEACHER: "TEACHER",
  ACCOUNTANT: "ACCOUNTANT",
  PARENT: "PARENT",
  STUDENT: "STUDENT",
} as const;

export const AttendanceStatusEnum = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  LATE: "LATE",
  EXCUSED: "EXCUSED",
} as const;

export const PaymentStatusEnum = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  RECONCILED: "RECONCILED",
  CANCELLED: "CANCELLED",
} as const;

export const RiskLevelEnum = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export const PerformanceLevelEnum = {
  EXCELLENT: "EXCELLENT",
  VERY_GOOD: "VERY_GOOD",
  GOOD: "GOOD",
  FAIR: "FAIR",
  WEAK: "WEAK",
} as const;

export const IncidentSeverityEnum = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export const AppointmentStatusEnum = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;

export const QuestionTypeEnum = {
  MCQ: "MCQ",
  TRUE_FALSE: "TRUE_FALSE",
  SHORT_ANSWER: "SHORT_ANSWER",
  ESSAY: "ESSAY",
  FILL_BLANK: "FILL_BLANK",
} as const;

export const DataRequestTypeEnum = {
  EXPORT: "EXPORT",
  RECTIFICATION: "RECTIFICATION",
  DELETION: "DELETION",
  PORTABILITY: "PORTABILITY",
} as const;

export const DataRequestStatusEnum = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
} as const;
