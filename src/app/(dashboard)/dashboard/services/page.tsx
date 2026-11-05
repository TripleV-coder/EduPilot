"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { useRBAC } from "@/lib/hooks/use-rbac";
import { useSchool } from "@/components/providers/school-provider";
import { isPageAllowedByModules } from "@/lib/modules/catalog";
import { SERVICE_CATALOG, SERVICE_GROUP_ORDER, filterServices, type ServiceEntry } from "@/lib/navigation/service-catalog";
import { Card, Icon } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty } from "@/components/layout/page-states";

/**
 * « Tous les services » : chaque fonction de l'école accessible à la personne,
 * rangée par domaine. Le menu garde 5 à 8 actions clés ; tout le reste vit ici
 * (37 pages n'avaient plus aucun point d'entrée).
 */
export default function ServicesPage() {
    return (
        <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
            <ServicesPageContent />
        </PageGuard>
    );
}

function normalize(text: string) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function ServicesPageContent() {
    const { canAccess } = useRBAC();
    const { enabledModules, offeredLevels } = useSchool();
    const [query, setQuery] = useState("");

    const visible = useMemo(
        () =>
            filterServices(SERVICE_CATALOG, {
                canAccess: (check) =>
                    canAccess({
                        roles: check.roles ? [...check.roles] : undefined,
                        permission: Array.isArray(check.permission) ? [...check.permission] : (check.permission as string | undefined),
                    }),
                enabledModules,
                offeredLevels,
                isPageAllowedByModules,
            }),
        [canAccess, enabledModules, offeredLevels],
    );

    const matching = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return visible;
        return visible.filter((s) => normalize(`${s.label} ${s.description} ${s.group}`).includes(q));
    }, [visible, query]);

    const groups = SERVICE_GROUP_ORDER.map((group) => ({
        group,
        entries: matching.filter((s) => s.group === group),
    })).filter((g) => g.entries.length > 0);

    return (
        <PageShell>
            <PageHeader
                title="Tous les services"
                description="Toutes les fonctions de l'école auxquelles vous avez accès, rangées par domaine."
                breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Tous les services" }]}
            />

            <label className="flex max-w-md items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Icon name="search" size={16} color="var(--eduflow-text-tertiary)" />
                <span className="sr-only">Rechercher un service</span>
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher : bibliothèque, transport, bulletins…"
                    className="w-full bg-transparent text-sm outline-none"
                />
            </label>

            {groups.length === 0 ? (
                <PageEmpty
                    icon="search"
                    title={query ? "Aucun service ne correspond" : "Aucun service supplémentaire"}
                    description={query ? "Essayez un autre mot." : "Vos fonctions principales sont dans le menu."}
                />
            ) : (
                groups.map(({ group, entries }) => (
                    <section key={group} aria-labelledby={`services-${group}`} className="space-y-3">
                        <h2 id={`services-${group}`} className="text-sm font-semibold" style={{ color: "var(--eduflow-text-secondary)" }}>
                            {group}
                        </h2>
                        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                            {entries.map((entry) => (
                                <ServiceCard key={entry.href} entry={entry} />
                            ))}
                        </div>
                    </section>
                ))
            )}
        </PageShell>
    );
}

function ServiceCard({ entry }: { entry: ServiceEntry }) {
    return (
        <Link href={entry.href} className="block rounded-xl no-underline focus-visible:outline focus-visible:outline-2" style={{ color: "inherit" }}>
            <Card padding={16} className="h-full hover:shadow-eduflow-card-brand">
                <div className="flex items-start gap-3">
                    <span
                        className="grid shrink-0 place-items-center"
                        style={{ width: 40, height: 40, borderRadius: 12, background: "var(--brand-50)", color: "var(--brand-700)" }}
                        aria-hidden="true"
                    >
                        <Icon name={entry.icon} size={18} />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-semibold" style={{ color: "var(--eduflow-text-primary)" }}>{entry.label}</span>
                        <span className="mt-1 block text-[13px] leading-snug" style={{ color: "var(--eduflow-text-secondary)" }}>{entry.description}</span>
                    </span>
                </div>
            </Card>
        </Link>
    );
}
