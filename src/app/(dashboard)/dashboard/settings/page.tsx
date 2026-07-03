"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { Badge, Card, Icon, type IconName } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

interface SettingItem {
    icon: IconName;
    title: string;
    desc: string;
    href: string;
    accent: "brand" | "info" | "success" | "warning" | "neutral";
}

const PERSONAL_SETTINGS: SettingItem[] = [
    {
        icon: "users",
        title: "Profil",
        desc: "Informations personnelles et photo",
        href: "/dashboard/settings/profile",
        accent: "brand",
    },
    {
        icon: "bell",
        title: "Notifications",
        desc: "Préférences d'alertes et rappels",
        href: "/dashboard/settings/notifications",
        accent: "warning",
    },
    {
        icon: "settings",
        title: "Sécurité",
        desc: "Mot de passe et authentification",
        href: "/dashboard/settings/security",
        accent: "success",
    },
    {
        icon: "sparkle",
        title: "Apparence",
        desc: "Thème, densité et mode focus",
        href: "/dashboard/settings/appearance",
        accent: "info",
    },
    {
        icon: "tag",
        title: "Langue & région",
        desc: "Fuseau horaire et localisation",
        href: "/dashboard/settings/locale",
        accent: "neutral",
    },
    {
        icon: "info",
        title: "Mes données",
        desc: "Export et droit à l'oubli (RGPD)",
        href: "/dashboard/settings/my-data",
        accent: "neutral",
    },
];

const ADMIN_SETTINGS: SettingItem[] = [
    {
        icon: "calendar",
        title: "Années académiques",
        desc: "Gérer les années et périodes",
        href: "/dashboard/settings/academic",
        accent: "brand",
    },
    {
        icon: "grid",
        title: "Cycles de l'établissement",
        desc: "Primaire, Collège, Lycée offerts",
        href: "/dashboard/settings/cycles",
        accent: "brand",
    },
    {
        icon: "school",
        title: "Niveaux d'étude",
        desc: "Configuration des cycles et classes",
        href: "/dashboard/settings/class-levels",
        accent: "info",
    },
    {
        icon: "book",
        title: "Matières & évaluations",
        desc: "Matières, coefficients et types",
        href: "/dashboard/settings/subjects",
        accent: "success",
    },
    {
        icon: "tag",
        title: "Catégories de matières",
        desc: "Référentiel des familles de matières",
        href: "/dashboard/settings/subject-categories",
        accent: "neutral",
    },
    {
        icon: "settings",
        title: "Options de configuration",
        desc: "Référentiels métiers du tenant",
        href: "/dashboard/settings/config-options",
        accent: "neutral",
    },
    {
        icon: "warning",
        title: "RGPD & conformité",
        desc: "Politiques, consentements et données",
        href: "/dashboard/settings/compliance",
        accent: "warning",
    },
    {
        icon: "school",
        title: "Profil établissement",
        desc: "Informations et identité visuelle",
        href: "/dashboard/settings/school",
        accent: "brand",
    },
    {
        icon: "grid",
        title: "Salles & espaces",
        desc: "Locaux disponibles pour l'EDT",
        href: "/dashboard/settings/rooms",
        accent: "neutral",
    },
    {
        icon: "users",
        title: "Rôles & permissions",
        desc: "Matrice d'accès des 8 rôles",
        href: "/dashboard/settings/roles",
        accent: "brand",
    },
];

export default function SettingsPage() {
    const { data: session } = useSession();
    const [search, setSearch] = useState("");

    const isGlobalSuperAdmin =
        session?.user?.role === "SUPER_ADMIN" && !session?.user?.schoolId;
    const isAdmin =
        (session?.user?.role === "SUPER_ADMIN" ||
            session?.user?.role === "SCHOOL_ADMIN" ||
            session?.user?.role === "DIRECTOR") &&
        !isGlobalSuperAdmin;

    const personalFiltered = useMemo(() => filterByQuery(PERSONAL_SETTINGS, search), [search]);
    const adminFiltered = useMemo(() => filterByQuery(ADMIN_SETTINGS, search), [search]);

    return (
        <PageShell className="pb-12">
            <PageHeader
                title="Paramètres"
                description="Préférences de ton compte et configuration de l'établissement."
            />

            <Card padding={14}>
                <div
                    className="flex h-[42px] items-center gap-2.5 px-3.5"
                    style={{
                        borderRadius: "var(--eduflow-radius-input)",
                        border: "1px solid var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-card)",
                    }}
                >
                    <Icon name="search" size={16} color="var(--eduflow-text-tertiary)" />
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Trouver un paramètre… (ex : mot de passe, thème, période)"
                        aria-label="Rechercher un paramètre"
                        className="flex-1 bg-transparent outline-none"
                        style={{
                            border: 0,
                            fontFamily: "inherit",
                            fontSize: 14,
                            color: "var(--eduflow-text-primary)",
                        }}
                    />
                </div>
            </Card>

            {/* Personnel */}
            <Section
                eyebrow="Compte"
                title="Paramètres personnels"
                empty={search ? personalFiltered.length === 0 : false}
            >
                <SettingsGrid items={personalFiltered} />
            </Section>

            {/* Admin */}
            {isAdmin ? (
                <Section
                    eyebrow="Établissement"
                    title="Administration"
                    empty={search ? adminFiltered.length === 0 : false}
                    badge={
                        <Badge variant="brand" size="sm">
                            Admin
                        </Badge>
                    }
                >
                    <SettingsGrid items={adminFiltered} variant="admin" />
                </Section>
            ) : null}

            <div
                className="mt-4 flex items-center justify-center gap-2 border-t pt-6"
                style={{
                    borderColor: "var(--eduflow-border-subtle)",
                    fontSize: 12,
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                <Icon name="settings" size={14} />
                Configuration centralisée EduPilot
            </div>
        </PageShell>
    );
}

function Section({
    eyebrow,
    title,
    badge,
    empty,
    children,
}: {
    eyebrow: string;
    title: string;
    badge?: React.ReactNode;
    empty?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <div>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: "var(--brand-700)",
                        }}
                    >
                        {eyebrow}
                    </div>
                    <h2
                        className="eduflow-display"
                        style={{
                            fontSize: 22,
                            margin: 0,
                            letterSpacing: "-0.02em",
                            color: "var(--eduflow-text-primary)",
                        }}
                    >
                        {title}
                    </h2>
                </div>
                {badge}
            </div>
            {empty ? (
                <Card padding={20}>
                    <div className="flex items-center gap-3">
                        <Icon name="info" size={16} color="var(--eduflow-text-tertiary)" />
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                color: "var(--eduflow-text-secondary)",
                            }}
                        >
                            Aucun paramètre ne correspond à la recherche dans cette section.
                        </p>
                    </div>
                </Card>
            ) : (
                children
            )}
        </div>
    );
}

function SettingsGrid({
    items,
    variant = "personal",
}: {
    items: SettingItem[];
    variant?: "personal" | "admin";
}) {
    if (items.length === 0) return null;
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 14,
            }}
        >
            {items.map((item) => (
                <SettingCard key={item.href} item={item} variant={variant} />
            ))}
        </div>
    );
}

function SettingCard({
    item,
    variant,
}: {
    item: SettingItem;
    variant: "personal" | "admin";
}) {
    const isAdmin = variant === "admin";
    const accent = item.accent;
    return (
        <Link href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
            <Card
                padding={16}
                style={{
                    cursor: "pointer",
                    transition:
                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out), border-color var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                    border: isAdmin
                        ? "1px solid var(--brand-100)"
                        : "1px solid var(--eduflow-border-subtle)",
                    background: isAdmin
                        ? "linear-gradient(135deg, var(--brand-50) 0%, var(--eduflow-surface-card) 60%)"
                        : "var(--eduflow-surface-card)",
                }}
                className="hover:-translate-y-0.5 hover:shadow-eduflow-card-brand"
            >
                <div className="flex items-start gap-3">
                    <div
                        className="grid place-items-center"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background:
                                accent === "brand"
                                    ? "var(--brand-50)"
                                    : `var(--eduflow-${accent}-50)`,
                            color:
                                accent === "brand"
                                    ? "var(--brand-700)"
                                    : `var(--eduflow-${accent}-700)`,
                            flexShrink: 0,
                        }}
                    >
                        <Icon name={item.icon} size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div
                            style={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                lineHeight: 1.25,
                            }}
                        >
                            {item.title}
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 4,
                                lineHeight: 1.45,
                            }}
                        >
                            {item.desc}
                        </div>
                    </div>
                    <Icon
                        name="chevron"
                        size={14}
                        color="var(--eduflow-text-tertiary)"
                        style={{ marginTop: 6, flexShrink: 0 }}
                    />
                </div>
            </Card>
        </Link>
    );
}

function filterByQuery(items: SettingItem[], query: string): SettingItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
        (item) =>
            item.title.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.href.toLowerCase().includes(q)
    );
}
