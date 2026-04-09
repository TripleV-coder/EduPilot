/**
 * Role-Based Access Control (RBAC) Permissions Matrix
 * Defines what each role can do in the system
 */

import { UserRole } from "@prisma/client";

// ============================================
// PERMISSION DEFINITIONS
// ============================================

export enum Permission {
  // School Management
  SCHOOL_CREATE = "school:create",
  SCHOOL_READ = "school:read",
  SCHOOL_UPDATE = "school:update",
  SCHOOL_DELETE = "school:delete",

  // User Management
  USER_CREATE = "user:create",
  USER_READ = "user:read",
  USER_UPDATE = "user:update",
  USER_DELETE = "user:delete",

  // Student Management
  STUDENT_CREATE = "student:create",
  STUDENT_READ = "student:read",
  STUDENT_UPDATE = "student:update",
  STUDENT_DELETE = "student:delete",
  STUDENT_READ_OWN = "student:read:own",

  // Teacher Management
  TEACHER_CREATE = "teacher:create",
  TEACHER_READ = "teacher:read",
  TEACHER_UPDATE = "teacher:update",
  TEACHER_DELETE = "teacher:delete",

  // Class Management
  CLASS_CREATE = "class:create",
  CLASS_READ = "class:read",
  CLASS_UPDATE = "class:update",
  CLASS_DELETE = "class:delete",

  // Subject Management
  SUBJECT_CREATE = "subject:create",
  SUBJECT_READ = "subject:read",
  SUBJECT_UPDATE = "subject:update",
  SUBJECT_DELETE = "subject:delete",

  // Grade Management
  GRADE_CREATE = "grade:create",
  GRADE_READ = "grade:read",
  GRADE_UPDATE = "grade:update",
  GRADE_DELETE = "grade:delete",
  GRADE_READ_OWN = "grade:read:own",
  GRADE_READ_CHILDREN = "grade:read:children",

  // Evaluation Management
  EVALUATION_CREATE = "evaluation:create",
  EVALUATION_READ = "evaluation:read",
  EVALUATION_UPDATE = "evaluation:update",
  EVALUATION_DELETE = "evaluation:delete",

  // Schedule Management
  SCHEDULE_CREATE = "schedule:create",
  SCHEDULE_READ = "schedule:read",
  SCHEDULE_UPDATE = "schedule:update",
  SCHEDULE_DELETE = "schedule:delete",

  // Finance Management
  FEE_CREATE = "fee:create",
  FEE_READ = "fee:read",
  FEE_UPDATE = "fee:update",
  FEE_DELETE = "fee:delete",

  FINANCE_CREATE = "finance:create",
  FINANCE_READ = "finance:read",
  FINANCE_UPDATE = "finance:update",
  FINANCE_DELETE = "finance:delete",

  PAYMENT_CREATE = "payment:create",
  PAYMENT_READ = "payment:read",
  PAYMENT_UPDATE = "payment:update",
  PAYMENT_DELETE = "payment:delete",
  PAYMENT_READ_OWN = "payment:read:own",

  // Reports & Statistics
  REPORT_VIEW = "report:view",
  STATISTICS_VIEW = "statistics:view",

  // Notifications
  NOTIFICATION_CREATE = "notification:create",
  NOTIFICATION_READ = "notification:read",
  NOTIFICATION_DELETE = "notification:delete",

  // Academic Year Management
  ACADEMIC_YEAR_CREATE = "academic_year:create",
  ACADEMIC_YEAR_READ = "academic_year:read",
  ACADEMIC_YEAR_UPDATE = "academic_year:update",
  ACADEMIC_YEAR_DELETE = "academic_year:delete",
  ACADEMIC_YEAR_CLOSE = "academic_year:close",

  // Student Promotion
  STUDENT_PROMOTION = "student:promotion",

  // Calendar Management
  CALENDAR_EVENT_CREATE = "calendar_event:create",
  CALENDAR_EVENT_READ = "calendar_event:read",
  CALENDAR_EVENT_UPDATE = "calendar_event:update",
  CALENDAR_EVENT_DELETE = "calendar_event:delete",

  HOLIDAY_CREATE = "holiday:create",
  HOLIDAY_READ = "holiday:read",
  HOLIDAY_UPDATE = "holiday:update",
  HOLIDAY_DELETE = "holiday:delete",

  // Orientation Management
  ORIENTATION_CREATE = "orientation:create",
  ORIENTATION_READ = "orientation:read",
  ORIENTATION_UPDATE = "orientation:update",
  ORIENTATION_DELETE = "orientation:delete",
  ORIENTATION_READ_OWN = "orientation:read:own",
  ORIENTATION_READ_CHILDREN = "orientation:read:children",
  ORIENTATION_VALIDATE = "orientation:validate",

  // Analytics Management
  ANALYTICS_VIEW = "analytics:view",
  ANALYTICS_VIEW_OWN = "analytics:view:own",
  ANALYTICS_VIEW_CHILDREN = "analytics:view:children",
  ANALYTICS_GENERATE = "analytics:generate",

  // AI Predictions
  AI_PREDICT_STUDENT = "ai:predict:student",
  AI_PREDICT_CLASS = "ai:predict:class",
  AI_PREDICT_VIEW_OWN = "ai:predict:view:own",
  AI_PREDICT_VIEW_CHILDREN = "ai:predict:view:children",

  // Attendance Management
  ATTENDANCE_READ = "attendance:read",
  ATTENDANCE_CREATE = "attendance:create",
  ATTENDANCE_UPDATE = "attendance:update",
  ATTENDANCE_DELETE = "attendance:delete",

  // Incident Management
  INCIDENT_READ = "incident:read",
  INCIDENT_CREATE = "incident:create",
  INCIDENT_UPDATE = "incident:update",
  INCIDENT_DELETE = "incident:delete",

  // Specific Modules
  MEDICAL_READ = "medical:read",
  CANTEEN_READ = "canteen:read",
  LIBRARY_READ = "library:read",

  // System Management
  SYSTEM_BACKUP_CREATE = "system:backup:create",
  SYSTEM_BACKUP_VIEW = "system:backup:view",
  SYSTEM_BACKUP_RESTORE = "system:backup:restore",
  SYSTEM_READ = "system:read",
  SYSTEM_WRITE = "system:write",
}

// ============================================
// ROLE PERMISSIONS MATRIX
// ============================================

// ============================================
// SHARED BASE PERMISSIONS (P5: Composition-based to avoid duplication)
// ============================================

/** Shared permissions for school-level administrative roles (SCHOOL_ADMIN, DIRECTOR) */
const SCHOOL_LEVEL_BASE_PERMISSIONS: Permission[] = [
  Permission.SCHOOL_READ,
  Permission.SCHOOL_UPDATE,
  Permission.USER_CREATE,
  Permission.USER_READ,
  Permission.USER_UPDATE,
  Permission.STUDENT_CREATE,
  Permission.STUDENT_READ,
  Permission.STUDENT_UPDATE,
  Permission.STUDENT_DELETE,
  Permission.TEACHER_CREATE,
  Permission.TEACHER_READ,
  Permission.TEACHER_UPDATE,
  Permission.TEACHER_DELETE,
  Permission.CLASS_CREATE,
  Permission.CLASS_READ,
  Permission.CLASS_UPDATE,
  Permission.CLASS_DELETE,
  Permission.SUBJECT_CREATE,
  Permission.SUBJECT_READ,
  Permission.SUBJECT_UPDATE,
  Permission.SUBJECT_DELETE,
  Permission.GRADE_CREATE,
  Permission.GRADE_READ,
  Permission.GRADE_UPDATE,
  Permission.GRADE_DELETE,
  Permission.EVALUATION_CREATE,
  Permission.EVALUATION_READ,
  Permission.EVALUATION_UPDATE,
  Permission.EVALUATION_DELETE,
  Permission.SCHEDULE_CREATE,
  Permission.SCHEDULE_READ,
  Permission.SCHEDULE_UPDATE,
  Permission.SCHEDULE_DELETE,
  Permission.FEE_CREATE,
  Permission.FEE_READ,
  Permission.FEE_UPDATE,
  Permission.FINANCE_CREATE,
  Permission.FINANCE_READ,
  Permission.FINANCE_UPDATE,
  Permission.PAYMENT_CREATE,
  Permission.PAYMENT_READ,
  Permission.PAYMENT_UPDATE,
  Permission.REPORT_VIEW,
  Permission.STATISTICS_VIEW,
  Permission.NOTIFICATION_CREATE,
  Permission.NOTIFICATION_READ,
  Permission.ACADEMIC_YEAR_CREATE,
  Permission.ACADEMIC_YEAR_READ,
  Permission.ACADEMIC_YEAR_UPDATE,
  Permission.ACADEMIC_YEAR_DELETE,
  Permission.ACADEMIC_YEAR_CLOSE,
  Permission.STUDENT_PROMOTION,
  Permission.CALENDAR_EVENT_CREATE,
  Permission.CALENDAR_EVENT_READ,
  Permission.CALENDAR_EVENT_UPDATE,
  Permission.CALENDAR_EVENT_DELETE,
  Permission.HOLIDAY_CREATE,
  Permission.HOLIDAY_READ,
  Permission.HOLIDAY_UPDATE,
  Permission.HOLIDAY_DELETE,
  Permission.ORIENTATION_CREATE,
  Permission.ORIENTATION_READ,
  Permission.ORIENTATION_UPDATE,
  Permission.ORIENTATION_VALIDATE,
  Permission.ANALYTICS_VIEW,
  Permission.ANALYTICS_GENERATE,
  Permission.AI_PREDICT_STUDENT,
  Permission.AI_PREDICT_CLASS,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_CREATE,
  Permission.ATTENDANCE_UPDATE,
  Permission.MEDICAL_READ,
  Permission.CANTEEN_READ,
  Permission.LIBRARY_READ,
];

export const rolePermissions: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    // All permissions - God mode
    Permission.SCHOOL_CREATE,
    Permission.SCHOOL_READ,
    Permission.SCHOOL_UPDATE,
    Permission.SCHOOL_DELETE,
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.STUDENT_CREATE,
    Permission.STUDENT_READ,
    Permission.STUDENT_UPDATE,
    Permission.STUDENT_DELETE,
    Permission.TEACHER_CREATE,
    Permission.TEACHER_READ,
    Permission.TEACHER_UPDATE,
    Permission.TEACHER_DELETE,
    Permission.CLASS_CREATE,
    Permission.CLASS_READ,
    Permission.CLASS_UPDATE,
    Permission.CLASS_DELETE,
    Permission.SUBJECT_CREATE,
    Permission.SUBJECT_READ,
    Permission.SUBJECT_UPDATE,
    Permission.SUBJECT_DELETE,
    Permission.GRADE_CREATE,
    Permission.GRADE_READ,
    Permission.GRADE_UPDATE,
    Permission.GRADE_DELETE,
    Permission.EVALUATION_CREATE,
    Permission.EVALUATION_READ,
    Permission.EVALUATION_UPDATE,
    Permission.EVALUATION_DELETE,
    Permission.SCHEDULE_CREATE,
    Permission.SCHEDULE_READ,
    Permission.SCHEDULE_UPDATE,
    Permission.SCHEDULE_DELETE,
    Permission.FEE_CREATE,
    Permission.FEE_READ,
    Permission.FEE_UPDATE,
    Permission.FEE_DELETE,
    Permission.FINANCE_CREATE,
    Permission.FINANCE_READ,
    Permission.FINANCE_UPDATE,
    Permission.FINANCE_DELETE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_UPDATE,
    Permission.PAYMENT_DELETE,
    Permission.REPORT_VIEW,
    Permission.STATISTICS_VIEW,
    Permission.NOTIFICATION_CREATE,
    Permission.NOTIFICATION_READ,
    Permission.NOTIFICATION_DELETE,
    Permission.ACADEMIC_YEAR_CREATE,
    Permission.ACADEMIC_YEAR_READ,
    Permission.ACADEMIC_YEAR_UPDATE,
    Permission.ACADEMIC_YEAR_DELETE,
    Permission.CALENDAR_EVENT_CREATE,
    Permission.CALENDAR_EVENT_READ,
    Permission.CALENDAR_EVENT_UPDATE,
    Permission.CALENDAR_EVENT_DELETE,
    Permission.HOLIDAY_CREATE,
    Permission.HOLIDAY_READ,
    Permission.HOLIDAY_UPDATE,
    Permission.HOLIDAY_DELETE,
    Permission.ORIENTATION_CREATE,
    Permission.ORIENTATION_READ,
    Permission.ORIENTATION_UPDATE,
    Permission.ORIENTATION_DELETE,
    Permission.ORIENTATION_VALIDATE,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_GENERATE,
    Permission.AI_PREDICT_STUDENT,
    Permission.AI_PREDICT_CLASS,
    Permission.SYSTEM_BACKUP_CREATE,
    Permission.SYSTEM_BACKUP_VIEW,
    Permission.SYSTEM_BACKUP_RESTORE,
    Permission.SYSTEM_READ,
    Permission.SYSTEM_WRITE,
    Permission.ACADEMIC_YEAR_CLOSE,
    Permission.STUDENT_PROMOTION,
    Permission.MEDICAL_READ,
    Permission.CANTEEN_READ,
    Permission.LIBRARY_READ,
  ],

  SCHOOL_ADMIN: [
    // School-level admin: inherits base + full CRUD extras (DELETE on users, fees, finance, notifications)
    ...SCHOOL_LEVEL_BASE_PERMISSIONS,
    Permission.USER_DELETE,
    Permission.FEE_DELETE,
    Permission.FINANCE_DELETE,
    Permission.PAYMENT_DELETE,
    Permission.NOTIFICATION_DELETE,
    Permission.ORIENTATION_DELETE,
  ],

  DIRECTOR: [
    // Director: inherits base (no DELETE on users, fees, finance, notifications — intentional)
    ...SCHOOL_LEVEL_BASE_PERMISSIONS,
  ],

  TEACHER: [
    // Teaching and grading
    Permission.SCHOOL_READ,
    Permission.STUDENT_READ,
    Permission.CLASS_READ,
    Permission.SUBJECT_READ,
    Permission.GRADE_CREATE,
    Permission.GRADE_READ,
    Permission.GRADE_UPDATE,
    Permission.EVALUATION_CREATE,
    Permission.EVALUATION_READ,
    Permission.EVALUATION_UPDATE,
    Permission.EVALUATION_DELETE,
    Permission.SCHEDULE_READ,
    Permission.NOTIFICATION_READ,
    Permission.CALENDAR_EVENT_READ,
    Permission.HOLIDAY_READ,
    Permission.ORIENTATION_CREATE,
    Permission.ORIENTATION_READ,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_GENERATE,
    Permission.AI_PREDICT_STUDENT,
    Permission.AI_PREDICT_CLASS,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CREATE,
    Permission.ATTENDANCE_UPDATE,
    Permission.CANTEEN_READ,
    Permission.LIBRARY_READ,
  ],

  STUDENT: [
    // View own data only
    Permission.SCHOOL_READ,
    Permission.STUDENT_READ_OWN,
    Permission.EVALUATION_READ,
    Permission.GRADE_READ,
    Permission.GRADE_READ_OWN,
    Permission.SCHEDULE_READ,
    Permission.NOTIFICATION_READ,
    Permission.CALENDAR_EVENT_READ,
    Permission.HOLIDAY_READ,
    Permission.ORIENTATION_READ_OWN,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.AI_PREDICT_VIEW_OWN,
    Permission.CANTEEN_READ,
    Permission.LIBRARY_READ,
  ],

  PARENT: [
    // View children's data only
    Permission.SCHOOL_READ,
    Permission.STUDENT_READ,
    Permission.EVALUATION_READ,
    Permission.GRADE_READ,
    Permission.GRADE_READ_CHILDREN,
    Permission.PAYMENT_READ_OWN,
    Permission.SCHEDULE_READ,
    Permission.NOTIFICATION_READ,
    Permission.CALENDAR_EVENT_READ,
    Permission.HOLIDAY_READ,
    Permission.ORIENTATION_READ_CHILDREN,
    Permission.ANALYTICS_VIEW_CHILDREN,
    Permission.AI_PREDICT_VIEW_CHILDREN,
    Permission.CANTEEN_READ,
  ],

  ACCOUNTANT: [
    // Financial operations (P3: added SCHOOL_READ for tenant-isolation consistency)
    Permission.SCHOOL_READ,
    Permission.STUDENT_READ,
    Permission.FEE_CREATE,
    Permission.FEE_READ,
    Permission.FEE_UPDATE,
    Permission.FINANCE_CREATE,
    Permission.FINANCE_READ,
    Permission.FINANCE_UPDATE,
    Permission.FINANCE_DELETE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_UPDATE,
    Permission.REPORT_VIEW,
    Permission.NOTIFICATION_READ,
  ],

  STAFF: [
    // General school staff (secretariat, supervisors)
    Permission.SCHOOL_READ,
    Permission.STUDENT_READ,
    Permission.USER_READ,
    Permission.CLASS_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CREATE,
    Permission.INCIDENT_READ,
    Permission.INCIDENT_CREATE,
    Permission.CALENDAR_EVENT_READ,
    Permission.NOTIFICATION_READ,
    Permission.MEDICAL_READ,
    Permission.CANTEEN_READ,
    Permission.LIBRARY_READ,
  ],
};

// ============================================
// PERMISSION CHECKING FUNCTIONS
// ============================================

/**
 * Check if a role or set of roles has a specific permission
 */
export function hasPermission(roleOrRoles: UserRole | UserRole[], permission: Permission): boolean {
  if (Array.isArray(roleOrRoles)) {
    // Union of permissions: true if ANY of the roles have the permission
    return roleOrRoles.some((role) => rolePermissions[role]?.includes(permission));
  }
  return rolePermissions[roleOrRoles]?.includes(permission) ?? false;
}

/**
 * Check if a role or set of roles has ANY of the specified permissions
 */
export function hasAnyPermission(roleOrRoles: UserRole | UserRole[], permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(roleOrRoles, permission));
}

/**
 * Check if a role or set of roles has ALL of the specified permissions
 */
export function hasAllPermissions(roleOrRoles: UserRole | UserRole[], permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(roleOrRoles, permission));
}

/**
 * Get all permissions for a set of roles (union)
 */
export function getRolePermissions(roleOrRoles: UserRole | UserRole[]): Permission[] {
  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  const allPermissions = new Set<Permission>();
  roles.forEach((role) => {
    const perms = rolePermissions[role] || [];
    perms.forEach((p) => allPermissions.add(p));
  });
  return Array.from(allPermissions);
}

/**
 * Check if user can perform an action on a resource
 */
export function canPerformAction(
  userRole: UserRole,
  action: "create" | "read" | "update" | "delete",
  resource: string
): boolean {
  const permission = `${resource}:${action}` as Permission;
  return hasPermission(userRole, permission);
}

// ============================================
// ROLE HIERARCHY (for inheritance)
// ============================================

export const roleHierarchy: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  SCHOOL_ADMIN: 80,
  DIRECTOR: 80,
  ACCOUNTANT: 60,
  STAFF: 55,
  TEACHER: 50,
  PARENT: 20,
  STUDENT: 10,
};

export const roleCreationMatrix: Record<UserRole, UserRole[]> = {
  SUPER_ADMIN: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF", "STUDENT", "PARENT"],
  SCHOOL_ADMIN: ["DIRECTOR", "TEACHER", "ACCOUNTANT", "STAFF", "STUDENT", "PARENT"],
  DIRECTOR: ["TEACHER", "STAFF", "STUDENT", "PARENT"],
  TEACHER: ["PARENT"],
  ACCOUNTANT: [],
  STAFF: ["STUDENT", "PARENT"],
  STUDENT: [],
  PARENT: [],
};

/**
 * Check if a role can create another role
 */
export function canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  return roleCreationMatrix[creatorRole]?.includes(targetRole) || false;
}

/**
 * Check if roleA has higher privileges than roleB
 */
export function isHigherRole(roleA: UserRole, roleB: UserRole): boolean {
  return roleHierarchy[roleA] > roleHierarchy[roleB];
}

/**
 * Check if roleA can manage (create/update/delete) roleB
 */
export function canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
  // SUPER_ADMIN can manage anyone
  if (managerRole === "SUPER_ADMIN") return true;

  // P6: School-level admins can only manage roles STRICTLY below them in the hierarchy.
  // A SCHOOL_ADMIN cannot manage another SCHOOL_ADMIN; a DIRECTOR cannot manage another DIRECTOR.
  if (["SCHOOL_ADMIN", "DIRECTOR"].includes(managerRole)) {
    return targetRole !== "SUPER_ADMIN" && isHigherRole(managerRole, targetRole);
  }

  // Others cannot manage users
  return false;
}

// ============================================
// RESOURCE ACCESS HELPERS
// ============================================

/**
 * Roles that can access authenticated dashboard-only pages
 */
export const AUTHENTICATED_DASHBOARD_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "DIRECTOR",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "ACCOUNTANT",
  "STAFF",
];

/**
 * Roles that can access admin panel
 */
export const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN"];

/**
 * Roles that can access school management
 */
export const SCHOOL_ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * Roles that can manage students
 */
export const STUDENT_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * Roles that can manage teachers
 */
export const TEACHER_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * Roles that can manage grades
 */
export const GRADE_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];

/**
 * Roles that can manage finances
 */
export const FINANCE_MANAGER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"];

/**
 * Roles that can view reports
 */
export const REPORT_VIEWER_ROLES: UserRole[] = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

// ============================================
// PERMISSION CHECK HELPERS
// ============================================

/**
 * Check if user role is in allowed roles
 */
export function isAllowedRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Get human-readable role name
 */
export function getRoleName(role: UserRole): string {
  const roleNames: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Administrateur",
    SCHOOL_ADMIN: "Administrateur d'Établissement",
    DIRECTOR: "Directeur",
    STAFF: "Personnel Administratif",
    TEACHER: "Enseignant",
    STUDENT: "Élève",
    PARENT: "Parent",
    ACCOUNTANT: "Comptable",
  };

  return roleNames[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    SUPER_ADMIN: "Accès complet à tous les établissements et fonctionnalités",
    SCHOOL_ADMIN: "Gestion complète de l'établissement",
    DIRECTOR: "Direction pédagogique et administrative",
    STAFF: "Personnel administratif et surveillance",
    TEACHER: "Gestion des cours et des notes",
    STUDENT: "Consultation des notes et emplois du temps",
    PARENT: "Suivi de la scolarité des enfants",
    ACCOUNTANT: "Gestion financière de l'établissement",
  };

  return descriptions[role] || "";
}
