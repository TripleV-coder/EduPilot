"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarItem {
    label: string;
    href: string;
}

interface SidebarCategory {
    label: string;
    items: SidebarItem[];
}

export const SETTINGS_NAV: SidebarCategory[] = [
    {
        label: "Compte",
        items: [
            { label: "Profil", href: "/dashboard/settings/profile" },
            { label: "Sécurité · MFA", href: "/dashboard/settings/security" },
            { label: "Notifications", href: "/dashboard/settings/notifications" },
            { label: "Apparence", href: "/dashboard/settings/appearance" },
            { label: "Langue · région", href: "/dashboard/settings/locale" },
        ],
    },
    {
        label: "Établissement",
        items: [
            { label: "Identité & branding", href: "/dashboard/settings/school" },
            { label: "Année scolaire", href: "/dashboard/settings/academic" },
            { label: "Cycles & classes", href: "/dashboard/settings/class-levels" },
            { label: "Matières & coeffs", href: "/dashboard/settings/subjects" },
            { label: "Salles & espaces", href: "/dashboard/settings/rooms" },
        ],
    },
    {
        label: "Équipe & accès",
        items: [
            { label: "Utilisateurs", href: "/dashboard/users" },
            { label: "Rôles & permissions", href: "/dashboard/settings/roles" },
        ],
    },
    {
        label: "Conformité",
        items: [
            { label: "RGPD · conformité", href: "/dashboard/settings/compliance" },
            { label: "Mes données", href: "/dashboard/settings/my-data" },
            { label: "Audit log", href: "/dashboard/audit-logs" },
        ],
    },
];

export function SettingsSidebar() {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Navigation des paramètres"
            className="rounded-xl p-2.5 self-start sticky"
            style={{
                background: "var(--eduflow-surface-card)",
                border: "1px solid var(--eduflow-border-subtle)",
                top: 16,
            }}
        >
            {SETTINGS_NAV.map((cat) => (
                <div key={cat.label} className="mb-2.5 last:mb-0">
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: "var(--eduflow-text-tertiary)",
                            padding: "8px 8px 4px",
                        }}
                    >
                        {cat.label}
                    </div>
                    {cat.items.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="block w-full text-left rounded-lg transition-colors"
                                style={{
                                    padding: "8px 10px",
                                    background: active ? "var(--eduflow-brand-50)" : "transparent",
                                    color: active ? "var(--eduflow-brand-800)" : "var(--eduflow-text-primary)",
                                    fontSize: 13,
                                    fontWeight: active ? 700 : 500,
                                    textDecoration: "none",
                                }}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </nav>
    );
}
