"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import gsap from "gsap";
import {
    LayoutDashboard, Users, GraduationCap, Clock, DollarSign,
    BookOpen, MessageSquare, Settings, Activity, Shield, Bot,
    Bell, UserCheck, CalendarClock, HeartPulse, Utensils, FileText,
    ChevronDown, LogOut, ShieldAlert, Building2, AlertCircle, Zap,
    Network, BarChart3, Calendar, Trophy, Compass
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { useSchool } from "@/components/providers/school-provider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Permission, hasPermission } from "@/lib/rbac/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatUserRoleLabel } from "@/lib/utils/role-label";
import { fetcher } from "@/lib/fetcher";

interface NavItem {
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

interface NavGroup {
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

type SidebarSection = "dashboard" | "root" | "config" | "users" | "pedagogy" | "school-life" | "finance" | "communication" | "risk" | "administration";

// ────────────────────────────────────────────────────────────────
// Navigation groups — ordered by business logic chain
// ────────────────────────────────────────────────────────────────
const navGroups: NavGroup[] = [
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

const groupSectionMap: Record<string, SidebarSection> = {
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

const sectionLabelMap: Record<SidebarSection, string> = {
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

function NavContent({ role, onClose, isCollapsed = false }: { role: string; onClose?: () => void; isCollapsed?: boolean }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { schoolId, schoolName } = useSchool();

    const userRole = session?.user?.role || role;
    const isGlobalMode = userRole === "SUPER_ADMIN" && !session?.user?.schoolId;

    const [openGroups, setOpenGroups] = useState<string[]>([]);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const saved = localStorage.getItem("edupilot_sidebar_open");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) setOpenGroups(parsed);
                } catch { /* ignore */ }
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!isCollapsed) {
            localStorage.setItem("edupilot_sidebar_open", JSON.stringify(openGroups));
        }
    }, [openGroups, isCollapsed]);

    const userName = session?.user?.name || "Utilisateur";
    const displayRole = formatUserRoleLabel(userRole);

    // ── Dynamic badges data ──
    const { data: riskStudentsData } = useSWR(
        "/api/analytics/students?riskLevel=CRITICAL&latestOnly=true&limit=200",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );

    const { data: attendanceAlertsData } = useSWR(
        schoolId ? `/api/attendance/alerts?schoolId=${schoolId}&daysBack=1` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );

    const { data: incidentsData } = useSWR(
        "/api/incidents?resolved=false&page=1&limit=1",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );

    const { data: messagesData } = useSWR(
        "/api/messages?type=inbox&page=1&limit=1",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );

    const { data: overduePlansData } = useSWR(
        "/api/payment-plans?status=OVERDUE",
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 }
    );

    const criticalAlertsCount = useMemo(() => {
        if (Array.isArray(riskStudentsData?.data)) return riskStudentsData.data.length;
        if (Array.isArray(riskStudentsData?.students)) return riskStudentsData.students.length;
        if (Array.isArray(riskStudentsData)) return riskStudentsData.length;
        if (typeof riskStudentsData?.total === "number") return riskStudentsData.total;
        if (typeof riskStudentsData?.pagination?.total === "number") return riskStudentsData.pagination.total;
        return 0;
    }, [riskStudentsData]);

    const attendanceAlertsCount = useMemo(() => {
        if (Array.isArray(attendanceAlertsData)) return attendanceAlertsData.length;
        if (Array.isArray(attendanceAlertsData?.alerts)) return attendanceAlertsData.alerts.length;
        if (typeof attendanceAlertsData?.total === "number") return attendanceAlertsData.total;
        return 0;
    }, [attendanceAlertsData]);

    const openIncidentsCount = useMemo(() => {
        if (typeof incidentsData?.pagination?.total === "number") return incidentsData.pagination.total;
        if (Array.isArray(incidentsData?.incidents)) return incidentsData.incidents.length;
        if (Array.isArray(incidentsData)) return incidentsData.length;
        return 0;
    }, [incidentsData]);

    const unreadMessagesCount = useMemo(() => {
        if (typeof messagesData?.unreadCount === "number") return messagesData.unreadCount;
        return 0;
    }, [messagesData]);

    const overduePlansCount = useMemo(() => {
        if (Array.isArray(overduePlansData)) return overduePlansData.length;
        if (Array.isArray(overduePlansData?.paymentPlans)) return overduePlansData.paymentPlans.length;
        return 0;
    }, [overduePlansData]);

    // ── Render a single nav item ──
    const renderNavItem = (item: NavItem) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        const content = (
            <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                    "flex items-center gap-3 h-[34px] px-3 rounded-md text-sm transition-all duration-150 relative group",
                    isActive
                        ? "text-white bg-[#222220] font-semibold"
                        : "text-[#9A9A92] hover:text-[#E8E8E2] hover:bg-white/5",
                    isCollapsed && "justify-center px-0 mx-auto w-10 h-10"
                )}
            >
                {/* Active indicator bar */}
                {isActive && (
                    <div className={cn(
                        "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[#2D6A4F]",
                        isCollapsed && "left-[-4px]"
                    )} />
                )}
                <item.icon className={cn(
                    "shrink-0 w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-white" : "text-[#8A8A82] group-hover:text-[#E8E8E2]"
                )} />
                {!isCollapsed && <span className="truncate flex-1 font-medium">{item.name}</span>}
                {!isCollapsed && (item.badge || (item.notifications ?? 0) > 0) && (
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-black uppercase",
                        item.badgeVariant === "warning"
                            ? "bg-[#D4830F]/20 text-[#D4830F]"
                            : item.badgeVariant === "info"
                                ? "bg-[#2E6DA4]/20 text-[#2E6DA4]"
                                : item.badgeVariant === "destructive" || (item.notifications ?? 0) > 0
                                    ? "bg-[#C0392B] text-white"
                                    : "bg-[#2D6A4F]/20 text-[#4A9E7A]"
                    )}>
                        {item.badge || item.notifications}
                    </span>
                )}
                {isCollapsed && (item.notifications ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#C0392B] rounded-full border-2 border-[#1A1A18]" />
                )}
            </Link>
        );

        if (isCollapsed) {
            return (
                <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent
                        side="right"
                        sideOffset={8}
                        className="bg-[#1A1A18] text-white border-white/10 font-bold text-xs uppercase tracking-widest"
                    >
                        {item.name}
                    </TooltipContent>
                </Tooltip>
            );
        }
        return content;
    };

    // ── Compute visible groups based on RBAC ──
    const computedGroups = useMemo(() => {
        return navGroups
            .map((group) => {
                if (group.roleRequired && !group.roleRequired.includes(userRole)) return null;
                if (group.requiresOrganizationManager && userRole !== "SUPER_ADMIN" && !session?.user?.isOrganizationManager) return null;

                if (group.permissionRequired && userRole) {
                    const perms = Array.isArray(group.permissionRequired) ? group.permissionRequired : [group.permissionRequired];
                    const hasGroupPerm = perms.some(p => hasPermission(userRole as any, p));
                    if (!hasGroupPerm && userRole !== "SUPER_ADMIN") return null;
                }

                if (isGlobalMode && !["dashboard", "root", "organization", "admin", "communication"].includes(group.id)) return null;

                const visibleItems = group.items.filter(item => {
                    const isRoleAllowed = !item.roleRequired || item.roleRequired.includes(userRole);
                    let isPermAllowed = true;
                    if (item.requiresOrganizationManager && userRole !== "SUPER_ADMIN" && !session?.user?.isOrganizationManager) {
                        return false;
                    }
                    if (item.permissionRequired && userRole) {
                        const perms = Array.isArray(item.permissionRequired) ? item.permissionRequired : [item.permissionRequired];
                        isPermAllowed = perms.some(p => hasPermission(userRole as any, p));
                    }
                    const isAllowed = isRoleAllowed && (isPermAllowed || userRole === "SUPER_ADMIN");
                    if (isGlobalMode && group.id === "communication") {
                        return isAllowed && (item.name.includes("IA") || item.name.includes("Assistant"));
                    }
                    // For dashboard in global mode, we might only want to show Vue d'ensemble if we don't have schoolId
                    if (isGlobalMode && group.id === "dashboard" && item.name === "Analytics") {
                        return false;
                    }
                    return isAllowed;
                });
                if (visibleItems.length === 0) return null;

                const decoratedItems = visibleItems.map((item) => {
                    if (item.href === "/dashboard/attendance") {
                        return {
                            ...item,
                            notifications: attendanceAlertsCount,
                            badgeVariant: attendanceAlertsCount > 0 ? "destructive" as const : item.badgeVariant,
                        };
                    }

                    if (item.href === "/dashboard/discipline") {
                        return {
                            ...item,
                            notifications: openIncidentsCount,
                            badgeVariant: openIncidentsCount > 0 ? "destructive" as const : item.badgeVariant,
                        };
                    }

                    if (item.href === "/dashboard/messages") {
                        return {
                            ...item,
                            notifications: unreadMessagesCount,
                            badgeVariant: unreadMessagesCount > 0 ? "destructive" as const : item.badgeVariant,
                        };
                    }

                    if (item.href === "/dashboard/finance/fees") {
                        return {
                            ...item,
                            notifications: overduePlansCount,
                            badgeVariant: overduePlansCount > 0 ? "warning" as const : item.badgeVariant,
                        };
                    }

                    return item;
                });

                const section = groupSectionMap[group.id] ?? "operations";
                return {
                    group: {
                        ...group,
                        badge: group.id === "alerts" && criticalAlertsCount > 0 ? criticalAlertsCount : group.badge,
                        badgeVariant: group.id === "alerts" && criticalAlertsCount > 0 ? "destructive" as const : group.badgeVariant,
                    },
                    section,
                    visibleItems: decoratedItems,
                    hasActiveItem: decoratedItems.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`)),
                };
            })
            .filter(Boolean) as Array<{
            group: NavGroup;
            section: SidebarSection;
            visibleItems: NavItem[];
            hasActiveItem: boolean;
        }>;
    }, [
        attendanceAlertsCount,
        criticalAlertsCount,
        isGlobalMode,
        openIncidentsCount,
        overduePlansCount,
        pathname,
        session?.user?.isOrganizationManager,
        unreadMessagesCount,
        userRole,
    ]);

    return (
        <TooltipProvider delayDuration={300}>
            <div className="sidebar-shell flex flex-col h-full">
                {/* ── Logo zone ── */}
                <div className={cn("h-[60px] px-4 border-b border-white/8 flex items-center", isCollapsed && "justify-center")}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#2D6A4F] flex items-center justify-center shrink-0">
                            <GraduationCap className="text-white w-5 h-5" />
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-semibold text-sm text-white truncate">EduPilot</span>
                                <span className="text-[11px] font-medium text-[#8A8A82] truncate flex items-center gap-1">
                                    {schoolName || (userRole === "SUPER_ADMIN" ? "Console Globale" : "Chargement...")}
                                    {userRole === "SUPER_ADMIN" && <ChevronDown className="w-3 h-3" />}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Navigation ── */}
                <div className="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar space-y-1">
                    {/* Accordion groups */}
                    <Accordion
                        type="multiple"
                        value={isCollapsed ? [] : openGroups}
                        onValueChange={setOpenGroups}
                        className="w-full space-y-1"
                    >
                        {computedGroups.map(({ group, section, visibleItems, hasActiveItem }, idx) => {
                            const prevSection = idx > 0 ? computedGroups[idx - 1]?.section : null;
                            const showSectionLabel = !isCollapsed && section !== prevSection;
                            const isGroupOpen = !isCollapsed && openGroups.includes(group.id);
                            const isAlertsWithCritical = group.id === "alerts" && Number(group.badge || 0) > 0;

                            if (isCollapsed) {
                                return (
                                    <Tooltip key={group.id}>
                                        <TooltipTrigger asChild>
                                            <div className={cn(
                                                "flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-all duration-200 cursor-pointer mb-1",
                                                hasActiveItem ? "bg-[#222220] text-white" : "text-[#8A8A82] hover:bg-white/5 hover:text-white",
                                                isAlertsWithCritical && "bg-[#5A2E2E]/40"
                                            )}>
                                                <group.icon className={cn("w-5 h-5", isAlertsWithCritical && "text-[#C0392B]")} />
                                                {isAlertsWithCritical && (
                                                    <span className="absolute top-0 right-0 w-2 h-2 bg-[#C0392B] rounded-full" />
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="right"
                                            sideOffset={8}
                                            className="bg-[#1A1A18] text-white border-white/10 font-semibold text-xs tracking-wide"
                                        >
                                            {group.title}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            return (
                                <div key={group.id}>
                                    {showSectionLabel && (
                                        <div className="pt-2 pb-1 px-3">
                                            <div className="h-px w-full bg-white/10 mb-2" />
                                            <p className="text-[10px] uppercase tracking-[0.08em] text-[#4A4A44] font-semibold">
                                                {sectionLabelMap[section]}
                                            </p>
                                        </div>
                                    )}
                                    <AccordionItem value={group.id} className="border-none">
                                        <AccordionTrigger className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 hover:no-underline transition-colors text-sm font-semibold",
                                            isAlertsWithCritical
                                                ? "bg-[#5A2E2E]/40 text-white"
                                                : hasActiveItem && !isGroupOpen ? "text-white" : "text-[#9A9A92]"
                                        )}>
                                            <div className="flex items-center gap-3 flex-1 text-left">
                                                <group.icon className={cn("w-5 h-5 shrink-0", isAlertsWithCritical && "text-[#C0392B]")} />
                                                <span className="truncate">{group.title}</span>
                                            </div>
                                            {group.badge && !isGroupOpen && (
                                                <span className={cn(
                                                    "mr-2 px-2 py-0.5 rounded-full text-[11px] font-black",
                                                    group.badgeVariant === "info"
                                                        ? "bg-[#2E6DA4]/20 text-[#5B9BD5]"
                                                        : "bg-[#C0392B] text-white"
                                                )}>
                                                    {group.badge}
                                                </span>
                                            )}
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-1 pb-0 pl-4 space-y-1">
                                            {visibleItems.map(renderNavItem)}
                                        </AccordionContent>
                                    </AccordionItem>
                                </div>
                            );
                        })}
                    </Accordion>
                </div>

                {/* ── User zone ── */}
                <div className="h-[60px] px-3 border-t border-white/8 bg-white/[0.02] flex items-center">
                    <div className={cn("flex items-center gap-3 group w-full", isCollapsed && "justify-center")}>
                        <div className="w-8 h-8 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-semibold text-white truncate">{userName}</p>
                                <p className="text-[11px] font-medium text-[#8A8A82] truncate tracking-tight">{displayRole}</p>
                            </div>
                        )}
                        {!isCollapsed && (
                            <button
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="p-1.5 rounded-md hover:bg-red-500/15 hover:text-red-300 text-[#8A8A82] transition-colors"
                                title="Déconnexion"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

export function Sidebar() {
    const { isOpen, isMobileOpen, setIsMobileOpen } = useSidebar();
    const { data: session } = useSession();
    const role = session?.user?.role || "USER";
    const pathname = usePathname();
    const sidebarRef = useRef<HTMLElement>(null);

    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname, setIsMobileOpen]);

    // ── GSAP sidebar width animation ──
    useEffect(() => {
        if (!sidebarRef.current) return;
        gsap.to(sidebarRef.current, {
            width: isOpen ? 220 : 56,
            duration: 0.28,
            ease: "power2.out",
        });
    }, [isOpen]);

    return (
        <>
            {/* Desktop sidebar */}
            <aside
                ref={sidebarRef}
                className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 border-r border-white/10 bg-[#1A1A18] overflow-hidden"
                style={{ width: isOpen ? 220 : 56 }}
            >
                <NavContent role={role} isCollapsed={!isOpen} />
            </aside>

            {/* Mobile overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] border-r border-white/10 flex flex-col md:hidden transition-transform duration-300 ease-in-out bg-[#1A1A18]",
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <NavContent role={role} onClose={() => setIsMobileOpen(false)} isCollapsed={false} />
            </aside>
        </>
    );
}
