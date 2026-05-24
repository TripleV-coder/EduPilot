"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { Icon, type IconName } from "@/components/edu";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";

type MobileNavItem = {
    key: string;
    label: string;
    icon: IconName;
    href?: string;
    matchPrefix?: boolean;
    onClick?: () => void;
};

function mobileItemsForRole(role: string | undefined | null): Omit<MobileNavItem, "onClick">[] {
    switch (role) {
        case "PARENT":
            return [
                { key: "home", label: "Accueil", icon: "home", href: "/dashboard" },
                { key: "kids", label: "Enfants", icon: "users", href: "/dashboard/students", matchPrefix: true },
                { key: "pay", label: "Paiements", icon: "money", href: "/dashboard/finance", matchPrefix: true },
                { key: "msg", label: "Messages", icon: "sms", href: "/dashboard/messages", matchPrefix: true },
            ];
        case "STUDENT":
            return [
                { key: "home", label: "Accueil", icon: "home", href: "/dashboard" },
                { key: "edt", label: "EDT", icon: "calendar", href: "/dashboard/schedule", matchPrefix: true },
                { key: "grades", label: "Notes", icon: "pencil", href: "/dashboard/grades", matchPrefix: true },
                { key: "hw", label: "Devoirs", icon: "book", href: "/dashboard/homework", matchPrefix: true },
            ];
        case "TEACHER":
            return [
                { key: "home", label: "Accueil", icon: "home", href: "/dashboard" },
                { key: "attend", label: "Appel", icon: "check", href: "/dashboard/attendance", matchPrefix: true },
                { key: "entry", label: "Notes", icon: "pencil", href: "/dashboard/grades/entry", matchPrefix: true },
                { key: "edt", label: "EDT", icon: "calendar", href: "/dashboard/schedule", matchPrefix: true },
            ];
        case "ACCOUNTANT":
            return [
                { key: "home", label: "Accueil", icon: "home", href: "/dashboard" },
                { key: "fin", label: "Finance", icon: "money", href: "/dashboard/finance", matchPrefix: true },
                { key: "wallet", label: "Wallet", icon: "money", href: "/dashboard/wallet", matchPrefix: true },
                { key: "acct", label: "OHADA", icon: "cards", href: "/dashboard/accounting", matchPrefix: true },
            ];
        case "SUPER_ADMIN":
            return [
                { key: "home", label: "Réseau", icon: "grid", href: "/dashboard" },
                { key: "schools", label: "Écoles", icon: "school", href: "/dashboard/root-control/schools", matchPrefix: true },
                { key: "users", label: "Users", icon: "users", href: "/dashboard/users", matchPrefix: true },
                { key: "analytics", label: "Analytics", icon: "chart", href: "/dashboard/analytics", matchPrefix: true },
            ];
        case "DIRECTOR":
        case "SCHOOL_ADMIN":
        default:
            return [
                { key: "home", label: "Accueil", icon: "home", href: "/dashboard" },
                { key: "kids", label: "Élèves", icon: "users", href: "/dashboard/students", matchPrefix: true },
                { key: "fin", label: "Finance", icon: "money", href: "/dashboard/finance", matchPrefix: true },
                { key: "edt", label: "EDT", icon: "calendar", href: "/dashboard/schedule", matchPrefix: true },
            ];
    }
}

function isActive(pathname: string | null, item: MobileNavItem): boolean {
    if (!pathname || !item.href) return false;
    if (item.matchPrefix) {
        return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === item.href;
}

export function EduMobileNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { setIsMobileOpen } = useSidebar();

    const role = session?.user?.role ?? null;

    const items: MobileNavItem[] = React.useMemo(() => {
        const base = mobileItemsForRole(role);
        return [
            ...base,
            {
                key: "menu",
                label: "Menu",
                icon: "grid",
                onClick: () => setIsMobileOpen(true),
            },
        ];
    }, [role, setIsMobileOpen]);

    if (!session?.user) return null;

    return (
        <nav
            aria-label="Navigation mobile"
            className="eduflow-scope edu-mobile-nav"
            style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 35,
                background: "var(--eduflow-surface-card)",
                borderTop: "1px solid var(--eduflow-border-subtle)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                boxShadow: "0 -2px 12px rgba(15,23,42,0.06)",
            }}
        >
            <ul
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${items.length}, 1fr)`,
                    listStyle: "none",
                    margin: 0,
                    padding: "6px 4px 8px",
                }}
            >
                {items.map((item) => {
                    const active = isActive(pathname, item);
                    const color = active
                        ? "var(--brand-700)"
                        : "var(--eduflow-text-tertiary)";
                    const content = (
                        <span
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 2,
                                padding: "4px 0",
                                color,
                                fontFamily: "inherit",
                            }}
                        >
                            <Icon name={item.icon} size={20} color={color} />
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: active ? 700 : 600,
                                    letterSpacing: "-0.005em",
                                }}
                            >
                                {item.label}
                            </span>
                            {active ? (
                                <span
                                    aria-hidden
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        height: 3,
                                        width: 24,
                                        borderRadius: 2,
                                        background: "var(--brand-600)",
                                    }}
                                />
                            ) : null}
                        </span>
                    );

                    return (
                        <li
                            key={item.key}
                            style={{ position: "relative" }}
                        >
                            {item.href ? (
                                <Link
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    style={{
                                        display: "block",
                                        textDecoration: "none",
                                        position: "relative",
                                        textAlign: "center",
                                    }}
                                >
                                    {content}
                                </Link>
                            ) : (
                                <button
                                    type="button"
                                    onClick={item.onClick}
                                    aria-label={`Ouvrir ${item.label}`}
                                    style={{
                                        width: "100%",
                                        background: "transparent",
                                        border: 0,
                                        padding: 0,
                                        cursor: "pointer",
                                        position: "relative",
                                    }}
                                >
                                    {content}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            <style jsx global>{`
                .edu-mobile-nav {
                    display: none;
                }
                @media (max-width: 767px) {
                    .edu-mobile-nav {
                        display: block;
                    }
                    body {
                        padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
                    }
                }
            `}</style>
        </nav>
    );
}
