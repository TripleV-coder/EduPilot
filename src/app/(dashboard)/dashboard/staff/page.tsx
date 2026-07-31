"use client";

import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, Icon, type IconName } from "@/components/edu";
import { STAFF_MEMBER_ROLES } from "@/lib/staff/hr";

const SECTIONS: { href: string; title: string; description: string; icon: IconName }[] = [
    {
        href: "/dashboard/users",
        title: "Personnel",
        description: "Comptes, rôles et coordonnées des membres de l'établissement.",
        icon: "users",
    },
    {
        href: "/dashboard/staff/attendance",
        title: "Présence",
        description: "Pointage quotidien : présents, retards, absents, congés.",
        icon: "check",
    },
    {
        href: "/dashboard/staff/leaves",
        title: "Congés",
        description: "Demandes de congé et circuit de validation.",
        icon: "calendar",
    },
    {
        href: "/dashboard/staff/payroll",
        title: "Paie",
        description: "Fiches de paie, validation comptable OHADA et bulletins.",
        icon: "money",
    },
];

export default function StaffHubPage() {
    return (
        <PageGuard roles={[...STAFF_MEMBER_ROLES]}>
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Ressources humaines"
                    description="Gestion du personnel : présence, congés et paie."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Personnel" },
                    ]}
                />
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                    {SECTIONS.map((s) => (
                        <Link key={s.href} href={s.href} className="block">
                            <Card padding={18} className="h-full transition-shadow hover:shadow-md">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="grid place-items-center"
                                        style={{ width: 40, height: 40, borderRadius: 10, background: "var(--brand-50)", color: "var(--brand-700)", flexShrink: 0 }}
                                    >
                                        <Icon name={s.icon} size={20} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--eduflow-text-primary)" }}>{s.title}</div>
                                        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--eduflow-text-secondary)", lineHeight: 1.5 }}>
                                            {s.description}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </PageShell>
        </PageGuard>
    );
}
