"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";

import { Avatar, Icon, Logo, type IconName } from "@/components/edu";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { useSchool } from "@/components/providers/school-provider";
import { fetcher } from "@/lib/fetcher";
import { ROLE_LABELS, isActiveLink, navForRole, type NavCounts } from "./role-nav";

export function EduSidebar() {
    const pathname = usePathname() || "/dashboard";
    const { data: session } = useSession();
    const { isMobileOpen, setIsMobileOpen } = useSidebar();
    const role = session?.user?.role ?? "STAFF";
    const schoolCtx = useSchool();
    const links = React.useMemo(() => navForRole(role), [role]);

    const { data: counts } = useSWR<NavCounts>(
        session?.user ? `/api/dashboard/nav-counts?role=${role}` : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000, shouldRetryOnError: false }
    );

    return (
        <>
            <div
                aria-hidden={!isMobileOpen}
                onClick={() => setIsMobileOpen(false)}
                className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
                style={{
                    opacity: isMobileOpen ? 1 : 0,
                    pointerEvents: isMobileOpen ? "auto" : "none",
                    transition: "opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            />

            <aside
                className="eduflow-scope fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col gap-1 border-r p-4 md:translate-x-0"
                style={{
                    background: "var(--eduflow-surface-card)",
                    borderColor: "var(--eduflow-border-subtle)",
                    color: "var(--eduflow-text-primary)",
                    fontFamily: "var(--eduflow-font-body)",
                    transform: isMobileOpen ? "translateX(0)" : "translateX(-110%)",
                    transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            >
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5 px-2 pb-4 pt-1"
                    onClick={() => setIsMobileOpen(false)}
                >
                    <Logo size={28} />
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
                </Link>

                <nav className="flex flex-col gap-0.5">
                    {links.map((link) => (
                        <SidebarLink
                            key={link.href + link.label}
                            href={link.href}
                            icon={link.icon}
                            label={link.label}
                            count={link.countKey ? counts?.[link.countKey] : undefined}
                            active={isActiveLink(pathname, link)}
                            onNavigate={() => setIsMobileOpen(false)}
                        />
                    ))}
                </nav>

                <div className="flex-1" />

                <div
                    className="mt-2 flex items-center gap-2.5 border-t pt-3"
                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                >
                    <Avatar name={schoolCtx?.schoolName ?? "École"} size="sm" />
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
                    <Icon name="chevronDown" size={14} color="var(--eduflow-text-tertiary)" />
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
    onNavigate?: () => void;
}

function SidebarLink({ href, icon, label, count, active, onNavigate }: SidebarLinkProps) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            className="flex h-9 items-center gap-2.5 rounded-md px-3 text-left"
            style={{
                background: active ? "var(--brand-700)" : "transparent",
                color: active ? "var(--eduflow-neutral-0)" : "var(--eduflow-text-secondary)",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                transition: "background var(--eduflow-motion-fast) var(--eduflow-ease-out), color var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                textDecoration: "none",
            }}
        >
            <Icon name={icon} size={16} />
            <span className="flex-1 truncate">{label}</span>
            {count != null && count > 0 ? (
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
