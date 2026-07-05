"use client";

import { useState } from "react";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { fetcher } from "@/lib/fetcher";
import { Card, Chip, Icon, MetricCard, Progress } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import type { UxAnalytics } from "@/lib/ux/analytics";

const WINDOWS = [
    { value: 7, label: "7 jours" },
    { value: 30, label: "30 jours" },
    { value: 90, label: "90 jours" },
];

function pct(rate: number): string {
    return `${Math.round(rate * 100)} %`;
}

export default function UxAnalyticsPage() {
    const [windowDays, setWindowDays] = useState(30);
    const { data, error, isLoading } = useSWR<UxAnalytics>(
        `/api/ux/analytics?window=${windowDays}`,
        fetcher,
        { revalidateOnFocus: false },
    );

    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <PageShell className="max-w-6xl pb-12">
                <PageHeader
                    title="Analytics produit"
                    description="Activation, rétention et usage réels, agrégés depuis la télémétrie UX."
                    breadcrumbs={[
                        { label: "Root control", href: "/dashboard/root-control" },
                        { label: "Analytics produit" },
                    ]}
                    actions={
                        <div className="flex gap-1.5">
                            {WINDOWS.map((w) => (
                                <Chip
                                    key={w.value}
                                    active={windowDays === w.value}
                                    onClick={() => setWindowDays(w.value)}
                                >
                                    {w.label}
                                </Chip>
                            ))}
                        </div>
                    }
                />

                {error ? (
                    <PageError message="Impossible de charger les analytics produit." />
                ) : isLoading || !data ? (
                    <PageLoading label="Agrégation de la télémétrie…" />
                ) : data.totalEvents === 0 ? (
                    <PageEmpty
                        title="Aucune donnée de télémétrie"
                        description="Aucun événement UX n'a encore été enregistré sur cette fenêtre. Les métriques apparaîtront dès que les utilisateurs interagiront avec l'application."
                    />
                ) : (
                    <div className="flex flex-col gap-4">
                        {/* KPIs */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                gap: 14,
                            }}
                        >
                            <MetricCard
                                label="Événements"
                                value={data.totalEvents.toLocaleString("fr-FR")}
                                icon="cards"
                                variant="brand"
                            />
                            <MetricCard
                                label="Utilisateurs actifs"
                                value={data.distinctUsers.toLocaleString("fr-FR")}
                                icon="users"
                                variant="info"
                            />
                            <MetricCard
                                label="Onboarding terminé"
                                value={data.activation.completed.toLocaleString("fr-FR")}
                                unit={`/ ${data.activation.viewed}`}
                                icon="success"
                                variant="success"
                            />
                            <MetricCard
                                label="Taux de complétion"
                                value={pct(data.activation.completionRate)}
                                icon="check"
                                variant="neutral"
                            />
                        </div>

                        {/* Funnel d'activation */}
                        <Card padding={0}>
                            <SectionHeader icon="sparkle" title="Funnel d'activation (onboarding)" />
                            <div className="flex flex-col gap-3 px-5 py-5">
                                <FunnelBar
                                    label="A vu la checklist"
                                    value={data.activation.viewed}
                                    total={data.activation.viewed}
                                />
                                <FunnelBar
                                    label="A coché une étape"
                                    value={data.activation.checkedStep}
                                    total={data.activation.viewed}
                                />
                                <FunnelBar
                                    label="A terminé l'onboarding"
                                    value={data.activation.completed}
                                    total={data.activation.viewed}
                                />
                            </div>
                        </Card>

                        {/* Rétention */}
                        <Card padding={0}>
                            <SectionHeader icon="info" title="Rétention glissante" />
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                    gap: 14,
                                }}
                                className="px-5 py-5"
                            >
                                {data.retention.map((r) => (
                                    <div
                                        key={r.day}
                                        style={{
                                            border: "1px solid var(--eduflow-border-subtle)",
                                            borderRadius: 12,
                                            padding: 16,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.04em",
                                                fontWeight: 700,
                                            }}
                                        >
                                            Jour {r.day}
                                        </div>
                                        <div
                                            className="eduflow-display"
                                            style={{ fontSize: 28, margin: "6px 0 2px" }}
                                        >
                                            {pct(r.rate)}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                            }}
                                        >
                                            {r.retained} revenus / {r.eligible} éligibles
                                        </div>
                                        <div style={{ marginTop: 10 }}>
                                            <Progress value={Math.round(r.rate * 100)} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Top événements */}
                        <Card padding={0}>
                            <SectionHeader icon="cards" title="Événements les plus fréquents" />
                            <div className="flex flex-col">
                                {data.topEvents.map((e, i) => (
                                    <div
                                        key={e.event}
                                        className="flex items-center justify-between px-5 py-3"
                                        style={{
                                            borderTop:
                                                i === 0
                                                    ? "none"
                                                    : "1px solid var(--eduflow-border-subtle)",
                                        }}
                                    >
                                        <span
                                            className="eduflow-mono"
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                            }}
                                        >
                                            {e.event}
                                        </span>
                                        <span
                                            className="tabular"
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {e.count.toLocaleString("fr-FR")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                )}
            </PageShell>
        </PageGuard>
    );
}

function SectionHeader({ icon, title }: { icon: "sparkle" | "info" | "cards"; title: string }) {
    return (
        <div
            className="flex items-center gap-2 border-b px-5 py-4"
            style={{ borderColor: "var(--eduflow-border-subtle)" }}
        >
            <Icon name={icon} size={18} color="var(--brand-700)" />
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                {title}
            </h3>
        </div>
    );
}

function FunnelBar({
    label,
    value,
    total,
}: {
    label: string;
    value: number;
    total: number;
}) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div>
            <div className="mb-1 flex items-center justify-between">
                <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                    {label}
                </span>
                <span
                    className="tabular"
                    style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                >
                    {value} · {percent} %
                </span>
            </div>
            <Progress value={percent} />
        </div>
    );
}
