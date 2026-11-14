"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";
import { Card, Icon, type IconName } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

/**
 * Langue et région : les réglages EFFECTIVEMENT appliqués par l'application.
 * L'ancienne page proposait quatre langues (dont trois jamais traduites), trois
 * fuseaux, trois formats de date et trois monnaies qu'aucun code ne lisait, et
 * situait Cotonou à GMT (le Bénin est à UTC+1).
 */
const EFFECTIVE: { icon: IconName; label: string; value: string; detail: string }[] = [
    { icon: "sms", label: "Langue de l'interface", value: "Français", detail: "Toute l'application, les bulletins et les messages sont en français." },
    { icon: "clock", label: "Fuseau horaire", value: "Afrique de l'Ouest — Cotonou (UTC+1)", detail: "Heures des cours, des appels et des échéances." },
    { icon: "calendar", label: "Format des dates", value: "JJ/MM/AAAA", detail: "Exemple : 06/11/2026." },
    { icon: "money", label: "Monnaie", value: "Franc CFA (XOF)", detail: "Montants en francs entiers, sans centimes." },
];

export default function LocaleSettingsPage() {
    return (
        <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
            <PageShell className="max-w-3xl pb-12">
                <PageHeader
                    title="Langue et région"
                    description="Réglages appliqués à tout EduPilot pour les établissements du Bénin."
                    breadcrumbs={[
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Langue et région" },
                    ]}
                />
                <Card padding={0}>
                    <ul className="divide-y" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                        {EFFECTIVE.map((row) => (
                            <li key={row.label} className="flex items-start gap-4 px-5 py-4">
                                <span
                                    className="grid shrink-0 place-items-center"
                                    style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-50)", color: "var(--brand-700)" }}
                                    aria-hidden="true"
                                >
                                    <Icon name={row.icon} size={16} />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm" style={{ color: "var(--eduflow-text-secondary)" }}>{row.label}</p>
                                    <p className="text-base font-semibold" style={{ color: "var(--eduflow-text-primary)" }}>{row.value}</p>
                                    <p className="mt-0.5 text-[13px]" style={{ color: "var(--eduflow-text-tertiary)" }}>{row.detail}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            </PageShell>
        </PageGuard>
    );
}
