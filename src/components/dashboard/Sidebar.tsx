"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
    LayoutDashboard, Users, GraduationCap, Clock, DollarSign,
    BookOpen, MessageSquare, Settings, Activity, Shield, Bot,
    Bell, UserCheck, CalendarClock, HeartPulse, Utensils, FileText, ChevronDown, LogOut, ShieldAlert, Building2, AlertCircle, Zap, ArrowUpRight, FileSpreadsheet
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
}

type SidebarSection = "pilotage" | "operations" | "communication" | "admin";

const navGroups: NavGroup[] = [
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
    {
        id: "config",
        title: "Configuration",
        icon: Settings,
        permissionRequired: [Permission.SCHOOL_UPDATE],
        items: [
            { name: "Années & Périodes", href: "/dashboard/settings/academic", icon: CalendarClock, permissionRequired: [Permission.ACADEMIC_YEAR_READ] },
            { name: "Niveaux & Matières", href: "/dashboard/settings/subjects", icon: BookOpen, permissionRequired: [Permission.SUBJECT_READ] },
            { name: "Salles & Lieux", href: "/dashboard/settings/rooms", icon: LayoutDashboard, permissionRequired: [Permission.SCHOOL_READ] },
            { name: "Promotion d'Année", href: "/dashboard/settings/academic/promotion", icon: ArrowUpRight, permissionRequired: [Permission.ACADEMIC_YEAR_CLOSE] },
            { name: "Assistant d'Importation", href: "/dashboard/import", icon: FileSpreadsheet, permissionRequired: [Permission.SCHOOL_UPDATE] },
        ]
    },
    {
        id: "users",
        title: "Utilisateurs",
        icon: Users,
        items: [
            { name: "Élèves", href: "/dashboard/students", icon: Users, permissionRequired: [Permission.STUDENT_READ] },
            { name: "Parents", href: "/dashboard/parents", icon: Users, permissionRequired: [Permission.USER_READ] },
            { name: "Enseignants", href: "/dashboard/teachers", icon: GraduationCap, permissionRequired: [Permission.USER_READ] },
            { name: "Personnel Admin", href: "/dashboard/users", icon: Shield, permissionRequired: [Permission.USER_READ] },
        ]
    },
    {
        id: "pedagogy",
        title: "Pédagogie",
        icon: GraduationCap,
        items: [
            { name: "Classes", href: "/dashboard/classes", icon: Users, permissionRequired: [Permission.CLASS_READ] },
            { name: "Emplois du temps", href: "/dashboard/schedule", icon: Clock, permissionRequired: [Permission.SCHEDULE_READ] },
            { name: "Présences (Appel)", href: "/dashboard/attendance", icon: UserCheck, permissionRequired: [Permission.ATTENDANCE_READ] },
            { name: "Cours & LMS", href: "/dashboard/courses", icon: BookOpen, permissionRequired: [Permission.USER_READ as any] },
            { name: "Notes & Bulletins", href: "/dashboard/grades", icon: FileText, permissionRequired: [Permission.GRADE_READ] },
        ]
    },
    {
        id: "school-life",
        title: "Vie Scolaire",
        icon: HeartPulse,
        items: [
            { name: "Discipline", href: "/dashboard/incidents", icon: Shield, permissionRequired: [Permission.INCIDENT_READ] },
            { name: "Infirmerie", href: "/dashboard/medical", icon: HeartPulse, permissionRequired: [Permission.USER_READ as any] },
            { name: "Cantine", href: "/dashboard/canteen", icon: Utensils, permissionRequired: [Permission.USER_READ as any] },
            { name: "Orientation", href: "/dashboard/orientation", icon: GraduationCap, permissionRequired: [Permission.SCHOOL_READ] },
            { name: "Gamification", href: "/dashboard/gamification", icon: Shield, permissionRequired: [Permission.SCHOOL_READ] },
        ]
    },
    {
        id: "alerts",
        title: "Alertes & Risques",
        icon: ShieldAlert,
        permissionRequired: [Permission.REPORT_VIEW],
        items: [
            { name: "Décrochage & Risques", href: "/dashboard/alerts/risks", icon: AlertCircle, permissionRequired: [Permission.ANALYTICS_VIEW] },
            { name: "Gestion des Dettes", href: "/dashboard/finance/debts", icon: DollarSign, permissionRequired: [Permission.FINANCE_READ] },
            { name: "Logs d'alertes", href: "/dashboard/alerts/logs", icon: FileText, permissionRequired: [Permission.REPORT_VIEW] },
        ]
    },
    {
        id: "finances",
        title: "Finances",
        icon: DollarSign,
        permissionRequired: [Permission.FINANCE_READ],
        items: [
            { name: "Frais & Paiements", href: "/dashboard/finance", icon: DollarSign, permissionRequired: [Permission.FEE_READ] },
            { name: "Bourses", href: "/dashboard/scholarships", icon: HeartPulse, permissionRequired: [Permission.FEE_READ] },
        ]
    },
    {
        id: "communication",
        title: "Communication",
        icon: MessageSquare,
        items: [
            { name: "Messages", href: "/dashboard/messages", icon: MessageSquare },
            { name: "Annonces", href: "/dashboard/announcements", icon: Bell },
            { name: "Rendez-vous", href: "/dashboard/appointments", icon: CalendarClock },
            { name: "Assistant IA", href: "/dashboard/ai", icon: Bot, badge: "Bêta" },
        ]
    },
    {
        id: "admin",
        title: "Administration",
        icon: Shield,
        items: [
            { name: "Sécurité & Accès", href: "/dashboard/users", icon: Shield, permissionRequired: [Permission.USER_UPDATE] },
            { name: "RGPD", href: "/dashboard/compliance", icon: Shield, permissionRequired: [Permission.SCHOOL_UPDATE] },
            { name: "Logs système", href: "/dashboard/audit-logs", icon: Shield, permissionRequired: [Permission.REPORT_VIEW] },
            { name: "Paramètres Généraux", href: "/dashboard/settings", icon: Settings },
        ]
    }
];

const groupSectionMap: Record<string, SidebarSection> = {
    root: "pilotage",
    alerts: "pilotage",
    finances: "pilotage",
    config: "operations",
    users: "operations",
    pedagogy: "operations",
    "school-life": "operations",
    communication: "communication",
    admin: "admin",
};

const sectionLabelMap: Record<SidebarSection, string> = {
    pilotage: "Pilotage",
    operations: "Operations",
    communication: "Communication",
    admin: "Administration",
};

function NavContent({ role, onClose, isCollapsed = false }: { role: string; onClose?: () => void; isCollapsed?: boolean }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { schoolName, currentPeriodName, academicYearId } = useSchool();
    
    const userRole = session?.user?.role || role;
    const isGlobalMode = userRole === "SUPER_ADMIN" && !session?.user?.schoolId;

    const [openGroups, setOpenGroups] = useState<string[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem("edupilot_sidebar_open");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setOpenGroups(parsed);
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }, []);

    // Effect for saving state
    useEffect(() => {
        if (!isCollapsed && openGroups.length > 0) {
            localStorage.setItem('edupilot_sidebar_open', JSON.stringify(openGroups));
        } else if (!isCollapsed && openGroups.length === 0) {
            // Still save empty state if it's legitimately empty, but usually it's fine.
            localStorage.setItem('edupilot_sidebar_open', JSON.stringify([]));
        }
    }, [openGroups, isCollapsed]);

    const userName = session?.user?.name || "Utilisateur";

    const displayRole = formatUserRoleLabel(userRole);
    const { data: riskStudentsData } = useSWR("/api/analytics/students?riskLevel=HIGH&limit=1", fetcher);

    const criticalAlertsCount = useMemo(() => {
        if (Array.isArray(riskStudentsData?.data)) return riskStudentsData.data.length;
        if (Array.isArray(riskStudentsData?.students)) return riskStudentsData.students.length;
        if (Array.isArray(riskStudentsData)) return riskStudentsData.length;
        if (typeof riskStudentsData?.total === "number") return riskStudentsData.total;
        if (typeof riskStudentsData?.pagination?.total === "number") return riskStudentsData.pagination.total;
        return 0;
    }, [riskStudentsData]);

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
                        ? "text-white bg-white/10 font-semibold" 
                        : "text-[#9A9A92] hover:text-[#E8E8E2] hover:bg-white/5",
                    isCollapsed && "justify-center px-0 mx-auto w-10 h-10"
                )}
            >
                {isActive && (
                    <div className={cn(
                        "absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[hsl(var(--primary))] rounded-r-full",
                        isCollapsed && "left-[-4px]"
                    )} />
                )}
                <item.icon className={cn(
                    "shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-white" : "text-[#8A8A82] group-hover:text-[#E8E8E2]",
                    isCollapsed ? "w-5 h-5" : "w-5 h-5"
                )} />
                {!isCollapsed && <span className="truncate flex-1 font-medium">{item.name}</span>}
                {!isCollapsed && (item.badge || (item.notifications ?? 0) > 0) && (
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-black uppercase",
                        item.badgeVariant === "destructive" || (item.notifications ?? 0) > 0 ? "bg-destructive text-white" : "bg-primary/20 text-primary"
                    )}>
                        {item.badge || item.notifications}
                    </span>
                )}
                {isCollapsed && (item.notifications ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-card" />
                )}
            </Link>
        );

        if (isCollapsed) {
            return (
                <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                        {content}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-bold text-xs uppercase tracking-widest">
                        {item.name}
                    </TooltipContent>
                </Tooltip>
            );
        }

        return content;
    };

    const computedGroups = useMemo(() => {
        return navGroups
            .map((group) => {
                if (group.roleRequired && !group.roleRequired.includes(userRole)) return null;

                if (group.permissionRequired && userRole) {
                    const perms = Array.isArray(group.permissionRequired) ? group.permissionRequired : [group.permissionRequired];
                    const hasGroupPerm = perms.some(p => hasPermission(userRole as any, p));
                    if (!hasGroupPerm && userRole !== "SUPER_ADMIN") return null;
                }

                if (isGlobalMode && !["root", "admin", "communication"].includes(group.id)) return null;

                const visibleItems = group.items.filter(item => {
                    const isRoleAllowed = !item.roleRequired || item.roleRequired.includes(userRole);
                    let isPermAllowed = true;
                    if (item.permissionRequired && userRole) {
                        const perms = Array.isArray(item.permissionRequired) ? item.permissionRequired : [item.permissionRequired];
                        isPermAllowed = perms.some(p => hasPermission(userRole as any, p));
                    }

                    const isAllowed = isRoleAllowed && (isPermAllowed || userRole === "SUPER_ADMIN");
                    if (isGlobalMode && group.id === "communication") {
                        return isAllowed && (item.name.includes("IA") || item.name.includes("Assistant"));
                    }
                    return isAllowed;
                });
                if (visibleItems.length === 0) return null;

                const section = groupSectionMap[group.id] ?? "operations";
                return {
                    group: {
                        ...group,
                        badge: group.id === "alerts" && criticalAlertsCount > 0 ? criticalAlertsCount : group.badge,
                        badgeVariant: group.id === "alerts" && criticalAlertsCount > 0 ? "destructive" : group.badgeVariant,
                    },
                    section,
                    visibleItems,
                    hasActiveItem: visibleItems.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`)),
                };
            })
            .filter(Boolean) as Array<{
            group: NavGroup;
            section: SidebarSection;
            visibleItems: NavItem[];
            hasActiveItem: boolean;
        }>;
    }, [criticalAlertsCount, isGlobalMode, pathname, userRole]);

    return (
        <TooltipProvider>
            <div className="sidebar-shell flex flex-col h-full">
                {/* Zone Logo */}
                <div className={cn("h-[60px] px-4 border-b border-white/8 flex items-center", isCollapsed && "justify-center")}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
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

                {/* Navigation principale */}
                <div className="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar space-y-1">
                    {/* Toujours visibles : Dashboard items */}
                    <div className="space-y-1 mb-4">
                        {renderNavItem({ name: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard })}
                        {!isGlobalMode && renderNavItem({ 
                            name: "Performances", 
                            href: "/dashboard/performances", 
                            icon: Activity, 
                            roleRequired: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] 
                        })}
                    </div>

                    {/* Groupes Accordéons */}
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

                            if (isCollapsed) {
                                return (
                                    <Tooltip key={group.id}>
                                        <TooltipTrigger asChild>
                                            <div 
                                                className={cn(
                                                    "flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-all duration-200 cursor-pointer mb-1",
                                                    hasActiveItem ? "bg-white/10 text-white" : "text-[#8A8A82] hover:bg-white/5 hover:text-white"
                                                )}
                                                onClick={() => {
                                                    // On could imagine expanding sidebar on click, but for now just highlight
                                                }}
                                            >
                                                <group.icon className="w-5 h-5" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="bg-[#1A1A18] text-white border-white/10 font-semibold text-xs tracking-wide">
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
                                            group.id === "alerts" && Number(group.badge || 0) > 0
                                                ? "bg-[#5A2E2E]/40 text-white"
                                                : hasActiveItem && !isGroupOpen ? "text-white" : "text-[#9A9A92]"
                                        )}>
                                            <div className="flex items-center gap-3 flex-1 text-left">
                                                <group.icon className={cn("w-5 h-5 shrink-0", group.id === "alerts" && Number(group.badge || 0) > 0 && "text-[#C0392B]")} />
                                                {!isCollapsed && <span className="truncate">{group.title}</span>}
                                            </div>
                                            {!isCollapsed && group.badge && !isGroupOpen && (
                                                <span className={cn(
                                                    "mr-2 px-2 py-0.5 rounded-full text-[11px] font-black",
                                                    group.badgeVariant === "info"
                                                        ? "bg-blue-500/20 text-blue-600"
                                                        : "bg-destructive text-white"
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

                {/* Zone Utilisateur fixe */}
                <div className="h-[60px] px-3 border-t border-white/8 bg-white/[0.02] flex items-center">
                    <div className={cn("flex items-center gap-3 group", isCollapsed && "justify-center")}>
                        <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold text-xs shrink-0">
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

    useEffect(() => {
        // Fermer le menu mobile lors d'un changement de route
        setIsMobileOpen(false);
    }, [pathname, setIsMobileOpen]);

    return (
        <>
            <aside className={cn(
                "hidden md:flex flex-col fixed inset-y-0 left-0 z-40 border-r border-white/10 transition-all duration-300 ease-in-out bg-[#1A1A18]",
                isOpen ? "w-[220px]" : "w-[56px]"
            )}>
                <NavContent role={role} isCollapsed={!isOpen} />
            </aside>

            {isMobileOpen && (
                <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setIsMobileOpen(false)} />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] border-r border-white/10 flex flex-col md:hidden transition-transform duration-300 ease-in-out bg-[#1A1A18]",
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <NavContent role={role} onClose={() => setIsMobileOpen(false)} isCollapsed={false} />
            </aside>
        </>
    );
}
