"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    Settings,
    LogOut,
    Calendar,
    MessageSquare,
    BarChart3,
    ShieldAlert,
    FileText,
    CheckSquare,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Pin,
    PinOff,
    LucideIcon
} from "lucide-react";
import { useSidebar } from "@/lib/hooks/use-sidebar";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";

// ============================================
// ROLE-BASED MENU CONFIGURATION
// ============================================

type UserRole = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "PARENT" | "STUDENT";

interface MenuItem {
    href: string;
    label: string;
    icon: LucideIcon;
    roles: UserRole[];
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

const menuConfig: MenuSection[] = [
    {
        title: "Principal",
        items: [
            { href: "/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT"] },
            { href: "/school/students", label: "Élèves", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
            { href: "/school/teachers", label: "Enseignants", icon: GraduationCap, roles: ["SUPER_ADMIN", "ADMIN"] },
            { href: "/school/classes", label: "Classes", icon: BookOpen, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
        ]
    },
    {
        title: "Gestion",
        items: [
            { href: "/grades", label: "Notes", icon: FileText, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT"] },
            { href: "/attendance", label: "Présences", icon: CheckSquare, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"] },
            { href: "/schedule", label: "Emploi du temps", icon: Calendar, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT"] },
            { href: "/payments", label: "Paiements", icon: CreditCard, roles: ["SUPER_ADMIN", "ADMIN", "PARENT"] },
            { href: "/messages", label: "Messages", icon: MessageSquare, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT"] },
            { href: "/analytics", label: "Statistiques", icon: BarChart3, roles: ["SUPER_ADMIN", "ADMIN"] },
        ]
    },
    {
        title: "Système",
        items: [
            { href: "/admin/subjects", label: "Matières", icon: BookOpen, roles: ["SUPER_ADMIN", "ADMIN"] },
            { href: "/settings", label: "Paramètres", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "PARENT", "STUDENT"] },
            { href: "/admin", label: "Administration", icon: ShieldAlert, roles: ["SUPER_ADMIN"] },
        ]
    }
];

// ============================================
// SIDEBAR CONTEXT HOOK (Enhanced)
// ============================================

const SIDEBAR_STORAGE_KEY = "edupilot-sidebar-state";
const AUTO_COLLAPSE_BREAKPOINT = 1280;
const HOVER_EXPAND_DELAY = 300;

interface SidebarState {
    isPinned: boolean;
    customWidth: number | null;
}

function useSidebarState() {
    const [isPinned, setIsPinned] = useState(true);
    const [customWidth, setCustomWidth] = useState<number | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [shouldAutoCollapse, setShouldAutoCollapse] = useState(false);

    // Load persisted state
    useEffect(() => {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored) {
            try {
                const state: SidebarState = JSON.parse(stored);
                setIsPinned(state.isPinned);
                setCustomWidth(state.customWidth);
            } catch { }
        }
    }, []);

    // Persist state changes
    useEffect(() => {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ isPinned, customWidth }));
    }, [isPinned, customWidth]);

    // Auto-collapse on small screens
    useEffect(() => {
        const checkWidth = () => {
            setShouldAutoCollapse(window.innerWidth < AUTO_COLLAPSE_BREAKPOINT);
        };
        checkWidth();
        window.addEventListener("resize", checkWidth);
        return () => window.removeEventListener("resize", checkWidth);
    }, []);

    const togglePin = useCallback(() => setIsPinned(prev => !prev), []);

    return {
        isPinned,
        togglePin,
        customWidth,
        setCustomWidth,
        isHovering,
        setIsHovering,
        shouldAutoCollapse,
        isExpanded: isPinned || isHovering,
    };
}

// ============================================
// MOBILE SIDEBAR TRIGGER
// ============================================

export function MobileSidebarTrigger() {
    const { openMobile } = useSidebar();

    return (
        <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={openMobile}
            aria-label="Ouvrir le menu"
        >
            <Menu className="h-5 w-5" />
        </Button>
    );
}

// ============================================
// DESKTOP SIDEBAR (Dynamic & Adaptive)
// ============================================

export function Sidebar() {
    const { isCollapsed, toggleCollapsed } = useSidebar();
    const [isPinned, setIsPinned] = useState(true);
    const [isHovering, setIsHovering] = useState(false);
    const [shouldAutoCollapse, setShouldAutoCollapse] = useState(false);

    // Load persisted pin state
    useEffect(() => {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored) {
            try {
                const state = JSON.parse(stored);
                setIsPinned(state.isPinned ?? true);
            } catch { }
        }
    }, []);

    // Persist pin state
    useEffect(() => {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ isPinned }));
    }, [isPinned]);

    // Auto-collapse on small screens
    useEffect(() => {
        const checkWidth = () => {
            const shouldCollapse = window.innerWidth < AUTO_COLLAPSE_BREAKPOINT;
            setShouldAutoCollapse(shouldCollapse);
        };
        checkWidth();
        window.addEventListener("resize", checkWidth);
        return () => window.removeEventListener("resize", checkWidth);
    }, []);

    const effectivelyCollapsed = !isPinned || shouldAutoCollapse;
    const showExpanded = !effectivelyCollapsed || isHovering;

    let hoverTimeout: NodeJS.Timeout;

    const handleMouseEnter = () => {
        if (effectivelyCollapsed) {
            hoverTimeout = setTimeout(() => setIsHovering(true), HOVER_EXPAND_DELAY);
        }
    };

    const handleMouseLeave = () => {
        clearTimeout(hoverTimeout);
        setIsHovering(false);
    };

    return (
        <aside
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
                "hidden lg:flex flex-col border-r border-border bg-card shrink-0 transition-all duration-300 relative z-40",
                showExpanded ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-collapsed)]",
                isHovering && effectivelyCollapsed && "shadow-xl"
            )}
            style={{
                height: "calc(100vh - var(--header-height))",
            }}
        >
            <SidebarContent collapsed={!showExpanded} />
        </aside>
    );
}

// ============================================
// MOBILE SIDEBAR OVERLAY
// ============================================

export function MobileSidebar() {
    const { isMobileOpen, closeMobile } = useSidebar();

    return (
        <AnimatePresence>
            {isMobileOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                        onClick={closeMobile}
                    />

                    {/* Panel */}
                    <motion.aside
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border bg-card lg:hidden"
                    >
                        {/* Close button */}
                        <button
                            onClick={closeMobile}
                            className="absolute top-4 right-4 p-2 rounded-md hover:bg-muted transition-colors"
                            aria-label="Fermer le menu"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <SidebarContent collapsed={false} onItemClick={closeMobile} />
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

// ============================================
// SIDEBAR CONTENT (Role-based)
// ============================================

interface SidebarContentProps {
    collapsed?: boolean;
    onItemClick?: () => void;
}

export function SidebarContent({ collapsed = false, onItemClick }: SidebarContentProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const userRole = (session?.user?.role as UserRole) || "STUDENT";

    // Filter menu items by role
    const filteredMenu = menuConfig.map(section => ({
        ...section,
        items: section.items.filter(item => item.roles.includes(userRole))
    })).filter(section => section.items.length > 0);

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className={cn(
                "flex items-center h-16 border-b border-border shrink-0",
                collapsed ? "justify-center px-2" : "px-4"
            )}>
                <Link href="/" className="flex items-center gap-3 font-semibold text-lg">
                    <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                        <span className="text-sm font-bold">EP</span>
                    </div>
                    {!collapsed && (
                        <span className="text-foreground">EduPilot</span>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
                {filteredMenu.map((section) => (
                    <div key={section.title}>
                        {!collapsed && (
                            <div className="px-3 mb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {section.title}
                            </div>
                        )}
                        <div className="space-y-0.5">
                            {section.items.map((item) => (
                                <SidebarItem
                                    key={item.href}
                                    item={item}
                                    collapsed={collapsed}
                                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                                    onClick={onItemClick}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="p-2 border-t border-border">
                <button
                    className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10",
                        collapsed && "justify-center"
                    )}
                    title={collapsed ? "Déconnexion" : undefined}
                >
                    <LogOut className="h-4 w-4" />
                    {!collapsed && "Déconnexion"}
                </button>
            </div>
        </div>
    );
}

// ============================================
// SIDEBAR ITEM
// ============================================

interface SidebarItemProps {
    item: MenuItem;
    collapsed: boolean;
    isActive: boolean;
    onClick?: () => void;
}

function SidebarItem({ item, collapsed, isActive, onClick }: SidebarItemProps) {
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2"
            )}
            title={item.label}
        >
            {/* Active indicator bar */}
            {isActive && (
                <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-foreground rounded-r-full"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}

            <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary-foreground")} />

            {!collapsed && (
                <span className="truncate">{item.label}</span>
            )}
        </Link>
    );
}
