"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { Avatar, Icon, Logo, type IconName } from "@/components/edu";
import {
    SIDEBAR_COLLAPSED_WIDTH,
    SIDEBAR_EXPANDED_WIDTH,
    useSidebar,
} from "@/components/dashboard/DashboardLayoutClient";
import { useSchool } from "@/components/providers/school-provider";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/fetcher";
import { ROLE_LABELS, isActiveLink, visibleNavGroups, type NavCounts } from "./role-nav";

export function EduSidebar() {
    const pathname = usePathname() || "/dashboard";
    const { data: session } = useSession();
    const { isOpen, isMobileOpen, setIsMobileOpen } = useSidebar();
    const role = session?.user?.role ?? "STAFF";
    const schoolCtx = useSchool();
    const offeredLevels = schoolCtx.offeredLevels;
    const groups = React.useMemo(
        () => visibleNavGroups(role, offeredLevels),
        [role, offeredLevels]
    );

    const { data: counts } = useSWR<NavCounts>(
        session?.user ? `/api/dashboard/nav-counts?role=${role}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000, shouldRetryOnError: false }
    );

    const sidebarWidth = isOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

    return (
        <>
            <div
                aria-hidden={!isMobileOpen}
                onClick={() => setIsMobileOpen(false)}
                className="fixed inset-0 z-30 bg-[var(--eduflow-overlay)] backdrop-blur-sm md:hidden"
                style={{
                    opacity: isMobileOpen ? 1 : 0,
                    pointerEvents: isMobileOpen ? "auto" : "none",
                    transition: "opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            />

            <aside
                className={cn(
                    "eduflow-scope fixed left-0 top-0 z-40 flex h-screen flex-col gap-1 border-r transition-[width,padding,transform] duration-300",
                    isOpen ? "p-4" : "p-2",
                    isMobileOpen ? "translate-x-0" : "-translate-x-[110%]",
                    "md:translate-x-0"
                )}
                style={{
                    width: sidebarWidth,
                    background: "var(--eduflow-surface-card)",
                    borderColor: "var(--eduflow-border-subtle)",
                    color: "var(--eduflow-text-primary)",
                    fontFamily: "var(--eduflow-font-body)",
                }}
            >
                <Link
                    href="/dashboard"
                    className={cn(
                        "flex items-center pb-4 pt-1",
                        isOpen ? "gap-2.5 px-2" : "justify-center px-0"
                    )}
                    onClick={() => setIsMobileOpen(false)}
                    title="EduPilot"
                >
                    <Logo size={28} />
                    {isOpen ? (
                        <div>
                            <div
                                className="eduflow-display"
                                style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}
                            >
                                EduPilot
                            </div>
                            <div style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)", marginTop: -1 }}>
                                {ROLE_LABELS[role] ?? role}
                            </div>
                        </div>
                    ) : null}
                </Link>

                <nav
                    aria-label="Navigation principale"
                    className="flex flex-col gap-0.5 overflow-y-auto"
                >
                    {groups.map((group, gi) => (
                        <div key={group.title ?? `group-${gi}`} className="flex flex-col gap-0.5">
                            {group.title && isOpen ? (
                                <div
                                    className="px-3 pb-1 pt-3"
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {group.title}
                                </div>
                            ) : null}
                            {group.links.map((link) => (
                                <SidebarLink
                                    key={link.href + link.label}
                                    href={link.href}
                                    icon={link.icon}
                                    label={link.label}
                                    count={link.countKey ? counts?.[link.countKey] : undefined}
                                    active={isActiveLink(pathname, link)}
                                    collapsed={!isOpen}
                                    onNavigate={() => setIsMobileOpen(false)}
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="flex-1" />

                <div
                    className={cn(
                        "mt-2 flex items-center border-t pt-3",
                        isOpen ? "gap-2.5" : "justify-center"
                    )}
                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                >
                    <Avatar name={schoolCtx?.schoolName ?? "École"} size="sm" />
                    {isOpen ? (
                        <div className="min-w-0 flex-1">
                            <div
                                className="truncate"
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "var(--eduflow-text-primary)",
                                }}
                            >
                                {schoolCtx?.schoolName ?? "Établissement"}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                                {schoolCtx?.currentPeriodName
                                    ? `${schoolCtx.currentPeriodName}`
                                    : "Année en cours"}
                            </div>
                        </div>
                    ) : null}
                </div>
            </aside>
        </>
    );
}

interface SidebarLinkProps {
    href: string;
    icon: IconName;
    label: string;
    count?: number | null;
    active?: boolean;
    collapsed?: boolean;
    onNavigate?: () => void;
}

function SidebarLink({
    href,
    icon,
    label,
    count,
    active,
    collapsed,
    onNavigate,
}: SidebarLinkProps) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
                "sidebar-link flex h-9 items-center rounded-md text-left outline-none transition-colors",
                collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                active
                    ? "bg-[var(--brand-700)] text-[var(--eduflow-neutral-0)]"
                    : "text-[var(--eduflow-text-secondary)] hover:bg-[var(--eduflow-surface-sunken)] hover:text-[var(--eduflow-text-primary)]"
            )}
            style={{
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                textDecoration: "none",
            }}
        >
            <Icon name={icon} size={16} />
            {!collapsed ? <span className="flex-1 truncate">{label}</span> : null}
            {!collapsed && count != null && count > 0 ? (
                <span
                    className="eduflow-tabular"
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "1px 7px",
                        borderRadius: "var(--eduflow-radius-full)",
                        background: active ? "rgba(255,255,255,0.18)" : "var(--eduflow-neutral-200)",
                        color: active ? "var(--eduflow-neutral-0)" : "var(--eduflow-text-secondary)",
                    }}
                >
                    {count > 999 ? `${Math.round(count / 100) / 10}k` : count}
                </span>
            ) : null}
        </Link>
    );
}
