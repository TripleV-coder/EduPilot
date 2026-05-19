import type { UserRole } from "@prisma/client";
import { Permission, hasPermission } from "@/lib/rbac/permissions";

/**
 * Matrix row: one module × 4 action slots (read, create, update, delete).
 *
 * Each slot is either a Permission constant (then `hasPermission(role, p)`
 * gives the value) or `null` (action not applicable to that module — the
 * cell renders as a neutral dash instead of an on/off pill).
 */
export type ActionSlot = Permission | null;

export interface ModuleRow {
    label: string;
    slots: [ActionSlot, ActionSlot, ActionSlot, ActionSlot]; // [read, create, update, delete]
    /** Override the computed value (used for modules without a dedicated permission). */
    fallback?: (role: UserRole) => [boolean, boolean, boolean, boolean];
}

export const PERMISSION_MATRIX: ModuleRow[] = [
    {
        label: "Élèves & dossiers",
        slots: [
            Permission.STUDENT_READ,
            Permission.STUDENT_CREATE,
            Permission.STUDENT_UPDATE,
            Permission.STUDENT_DELETE,
        ],
    },
    {
        label: "Notes & bulletins",
        slots: [
            Permission.GRADE_READ,
            Permission.GRADE_CREATE,
            Permission.GRADE_UPDATE,
            Permission.GRADE_DELETE,
        ],
    },
    {
        label: "Présences",
        slots: [
            Permission.ATTENDANCE_READ,
            Permission.ATTENDANCE_CREATE,
            Permission.ATTENDANCE_UPDATE,
            Permission.ATTENDANCE_DELETE,
        ],
    },
    {
        label: "Finance & paiements",
        slots: [
            Permission.PAYMENT_READ,
            Permission.PAYMENT_CREATE,
            Permission.PAYMENT_UPDATE,
            Permission.PAYMENT_DELETE,
        ],
    },
    {
        label: "Santé · infirmerie",
        // Only read is modelled; other actions don't have dedicated perms yet.
        slots: [Permission.MEDICAL_READ, null, null, null],
    },
    {
        label: "Communication SMS",
        // No NOTIFICATION_UPDATE in the enum; mirror create for update.
        slots: [
            Permission.NOTIFICATION_READ,
            Permission.NOTIFICATION_CREATE,
            Permission.NOTIFICATION_CREATE,
            Permission.NOTIFICATION_DELETE,
        ],
    },
    {
        label: "Paramètres établissement",
        slots: [
            Permission.SCHOOL_READ,
            Permission.SCHOOL_CREATE,
            Permission.SCHOOL_UPDATE,
            Permission.SCHOOL_DELETE,
        ],
    },
    {
        label: "Audit log",
        // No AUDIT_* permission; only SUPER_ADMIN and SCHOOL_ADMIN/DIRECTOR
        // can read it (via SCHOOL_UPDATE check used by the route).
        slots: [null, null, null, null],
        fallback: (role) => {
            const canRead = hasPermission(role, Permission.SCHOOL_UPDATE);
            return [canRead, false, false, false];
        },
    },
];

export type CellState = "on" | "off" | "n/a";

export function evaluateRow(role: UserRole, row: ModuleRow): CellState[] {
    if (row.fallback) {
        return row.fallback(role).map((v) => (v ? "on" : "off"));
    }
    return row.slots.map((slot) => {
        if (slot === null) return "n/a";
        return hasPermission(role, slot) ? "on" : "off";
    });
}

export interface RoleDescriptor {
    role: UserRole;
    color: "brand" | "info" | "success" | "warning" | "neutral" | "danger";
    note: string;
}

export const ROLE_DESCRIPTORS: RoleDescriptor[] = [
    { role: "DIRECTOR",     color: "brand",   note: "Accès complet à l'établissement · pas d'accès cross-école" },
    { role: "SCHOOL_ADMIN", color: "brand",   note: "Configuration et administration de l'établissement" },
    { role: "TEACHER",      color: "info",    note: "Saisie de notes, présences et communication avec les parents" },
    { role: "PARENT",       color: "success", note: "Lecture seule sur le dossier de ses enfants" },
    { role: "STUDENT",      color: "warning", note: "Lecture seule sur son propre dossier" },
    { role: "ACCOUNTANT",   color: "neutral", note: "Recouvrement, encaissement et états financiers" },
    { role: "STAFF",        color: "neutral", note: "Personnel administratif · accès opérationnel limité" },
    { role: "SUPER_ADMIN",  color: "danger",  note: "Accès global multi-écoles · changement de rôle = log obligatoire" },
];
