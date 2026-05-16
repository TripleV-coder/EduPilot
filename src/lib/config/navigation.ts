import type { LucideIcon } from "lucide-react";
import {
    LayoutDashboard, Users, GraduationCap, Clock, DollarSign,
    BookOpen, MessageSquare, Settings, Activity, Shield, Bot,
    Bell, UserCheck, CalendarClock, HeartPulse, Utensils, FileText,
    ShieldAlert, Building2, AlertCircle, Zap,
    Network, BarChart3, Calendar, Trophy, Compass
} from "lucide-react";
import { Permission } from "@/lib/rbac/permissions";

export interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    roleRequired?: string[];
    permissionRequired?: Permission | Permission[];
    requiresOrganizationManager?: boolean;
    badge?: string;
    notifications?: number;
    badgeVariant?: "default" | "destructive" | "warning" | "info";
}

export interface NavGroup {
    id: string;
    title: string;
    icon: LucideIcon;
    items: NavItem[];
    badge?: string | number;
    badgeVariant?: "destructive" | "info" | "warning";
    roleRequired?: string[];
    permissionRequired?: Permission | Permission[];
    requiresOrganizationManager?: boolean;
}

export type SidebarSection = "dashboard" | "root" | "config" | "users" | "pedagogy" | "school-life" | "finance" | "communication" | "risk" | "administration";

// ────────────────────────────────────────────────────────────────
// Navigation groups — ordered by business logic chain
// ────────────────────────────────────────────────────────────────
export const navGroups: NavGroup[] = [
    // ── TABLEAU DE BORD ──
    {
        id: "dashboard",
        title: "Tableau de Bord",
        icon: LayoutDashboard,
        items: [
            { name: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
            {
                name: "Analytics",
                href: "/dashboard/analytics",
                icon: BarChart3,
                permissionRequired: [Permission.ANALYTICS_VIEW]
            },
        ]
    },
    // ── SUPER_ADMIN Root Console ──
    {
        id: "root",
        title: "Console Racine",
        icon: Shield,
        roleRequired: ["SUPER_ADMIN"],
        items: [
            { name: "Établissements", href: "/dashboard/root-control/schools", icon: Building2 },
            { name: "Cartographie Système", href: "/dashboard/root-control/system-map", icon: Network },
            { name: "Curriculum & Réformes", href: "/dashboard/root-control/curriculum", icon: BookOpen },
            { name: "Plans & Formules", href: "/dashboard/root-control/plans", icon: Zap },
            { name: "Finances Plateforme", href: "/dashboard/root-control/finance", icon: DollarSign },
            { name: "Utilisateurs Globaux", href: "/dashboard/root-control/users", icon: Users },
            { name: "Monitoring Système", href: "/dashboard/root-control/monitoring", icon: Activity },
        ]
    },
    // ── Multi-site Organization ──
    {
        id: "organization",
        title: "Organisation",
        icon: Network,
        requiresOrganizationManager: true,
        items: [
            { name: "Pilotage multisites", href: "/dashboard/organization", icon: Network, requiresOrganizationManager: true },
        ]
    },
    // ── Configuration ──
    {
        id: "config",
        title: "Configuration",
        icon: Settings,
        items: [
            { name: "Années & Périodes", href: "/dashboard/settings/academic", icon: CalendarClock, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], permissionRequired: [Permission.SCHOOL_UPDATE] },
            { name: "Niveaux & Matières", href: "/dashboard/settings/levels", icon: BookOpen, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], permissionRequired: [Permission.SUBJECT_READ] },
            { name: "Salles & Lieux", href: "/dashboard/settings/rooms", icon: LayoutDashboard, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"], permissionRequired: [Permission.SCHOOL_READ] },
        ]
    },
    // ── Utilisateurs ──
    {
        id: "users",
        title: "Utilisateurs",
        icon: Users,
        items: [
            {
                name: "Élèves",
                href: "/dashboard/students",
                icon: Users,
                roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "ACCOUNTANT", "PARENT", "STUDENT"],
                permissionRequired: [Permission.STUDENT_READ, Permission.STUDENT_READ_OWN],
            },
            {
                name: "Parents",
                href: "/dashboard/parents",
                icon: Users,
                roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
                permissionRequired: [Permission.USER_READ],
            },
            {
                name: "Enseignants",
                href: "/dashboard/teachers",
                icon: GraduationCap,
                roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
                permissionRequired: [Permission.TEACHER_READ],
            },
            {
                name: "Personnel Admin",
                href: "/dashboard/staff",
                icon: Shield,
                roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
                permissionRequired: [Permission.USER_READ],
            },
        ]
    },
    // ── Pédagogie ──
    {
        id: "pedagogy",
        title: "Pédagogie",
        icon: GraduationCap,
        items: [
            { name: "Classes", href: "/dashboard/classes", icon: Users, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissionRequired: [Permission.CLASS_READ] },
            { name: "Emplois du temps", href: "/dashboard/schedules", icon: Clock, permissionRequired: [Permission.SCHEDULE_READ] },
            { name: "Présences", href: "/dashboard/attendance", icon: UserCheck, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"], permissionRequired: [Permission.ATTENDANCE_READ] },
            {
                name: "Cours & LMS",
                href: "/dashboard/lms",
                icon: BookOpen,
                roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"],
                permissionRequired: [Permission.CLASS_READ, Permission.SUBJECT_READ, Permission.SCHEDULE_READ],
            },
            { name: "Notes & Bulletins", href: "/dashboard/grades", icon: FileText, permissionRequired: [Permission.GRADE_READ, Permission.GRADE_READ_OWN, Permission.GRADE_READ_CHILDREN] },
        ]
    },
    // ── Vie Scolaire ──
    {
        id: "school-life",
        title: "Vie Scolaire",
        icon: HeartPulse,
        items: [
            { name: "Discipline", href: "/dashboard/discipline", icon: Shield, permissionRequired: [Permission.INCIDENT_READ] },
            { name: "Infirmerie", href: "/dashboard/health", icon: HeartPulse, permissionRequired: [Permission.MEDICAL_READ] },
            { name: "Cantine", href: "/dashboard/cafeteria", icon: Utensils, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "STUDENT"] },
            { name: "Orientation", href: "/dashboard/orientation", icon: Compass, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"], permissionRequired: [Permission.SCHOOL_READ] },
            { name: "Gamification", href: "/dashboard/gamification", icon: Trophy, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"], permissionRequired: [Permission.SCHOOL_READ] },
        ]
    },
    // ── Finances ──
    {
        id: "finance",
        title: "Finances",
        icon: DollarSign,
        items: [
            {
                name: "Frais & Paiements",
                href: "/dashboard/finance/fees",
                icon: DollarSign,
                roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
                permissionRequired: [Permission.FINANCE_CREATE, Permission.FINANCE_READ, Permission.FEE_READ, Permission.PAYMENT_READ],
            },
            {
                name: "Bourses",
                href: "/dashboard/finance/scholarships",
                icon: HeartPulse,
                roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
                permissionRequired: [Permission.SCHOOL_UPDATE],
            },
        ]
    },
    // ── Communication ──
    {
        id: "communication",
        title: "Communication",
        icon: MessageSquare,
        items: [
            { name: "Messages", href: "/dashboard/messages", icon: MessageSquare, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"], permissionRequired: [Permission.SCHOOL_READ] },
            { name: "Annonces", href: "/dashboard/announcements", icon: Bell, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"], permissionRequired: [Permission.SCHOOL_READ] },
            { name: "Événements", href: "/dashboard/events", icon: Calendar, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"], permissionRequired: [Permission.SCHOOL_READ] },
            { name: "Rendez-vous", href: "/dashboard/appointments", icon: CalendarClock, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT"], permissionRequired: [Permission.SCHOOL_READ] },
            { name: "Assistant IA", href: "/dashboard/ai-assistant", icon: Bot, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"], permissionRequired: [Permission.SCHOOL_READ], badge: "Bêta" },
        ]
    },
    // ── Alertes & Risques ──
    {
        id: "risk",
        title: "Alertes & Risques",
        icon: ShieldAlert,
        items: [
            { name: "Décrochage", href: "/dashboard/risks/dropout", icon: AlertCircle, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissionRequired: [Permission.ANALYTICS_VIEW] },
            { name: "Échec Scolaire", href: "/dashboard/risks/failure", icon: AlertCircle, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissionRequired: [Permission.ANALYTICS_VIEW] },
            { name: "Dettes & Impayés", href: "/dashboard/risks/debts", icon: DollarSign, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissionRequired: [Permission.FINANCE_READ, Permission.PAYMENT_READ] },
            { name: "Log des Alertes", href: "/dashboard/risks/logs", icon: FileText, roleRequired: ["SUPER_ADMIN", "SCHOOL_ADMIN"], permissionRequired: [Permission.REPORT_VIEW] },
        ]
    },
    // ── Administration ──
    {
        id: "admin",
        title: "Administration",
        icon: Shield,
        roleRequired: ["SCHOOL_ADMIN"],
        items: [
            { name: "Sécurité & Accès", href: "/dashboard/admin/security", icon: Shield, permissionRequired: [Permission.USER_UPDATE] },
            { name: "RGPD", href: "/dashboard/admin/rgpd", icon: Shield, permissionRequired: [Permission.SCHOOL_UPDATE] },
            { name: "Logs Système", href: "/dashboard/admin/logs", icon: FileText, permissionRequired: [Permission.REPORT_VIEW] },
        ]
    }
];

export const groupSectionMap: Record<string, SidebarSection> = {
    dashboard: "dashboard",
    root: "root",
    organization: "root",
    config: "config",
    users: "users",
    pedagogy: "pedagogy",
    "school-life": "school-life",
    finance: "finance",
    communication: "communication",
    risk: "risk",
    admin: "administration",
};

export const sectionLabelMap: Record<SidebarSection, string> = {
    dashboard: "Tableau de Bord",
    root: "Pilotage Racine",
    config: "Configuration",
    users: "Utilisateurs",
    pedagogy: "Pédagogie",
    "school-life": "Vie Scolaire",
    finance: "Finances",
    communication: "Communication",
    risk: "Alertes & Risques",
    administration: "Administration",
};
