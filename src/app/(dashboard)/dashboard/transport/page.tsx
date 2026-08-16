"use client";

import { useEffect, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Chip,
    Icon,
    MetricCard,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";

type Variant = "success" | "warning" | "danger";

type TransportLine = {
    id: string;
    number: string;
    label: string;
    driverName: string | null;
    status: string;
    statusVariant: Variant;
    note: string | null;
    studentCount: number;
};

type TransportData = {
    configured: boolean;
    metrics: {
        activeBuses: number | null;
        totalBuses: number | null;
        transportedStudents: number | null;
        morningLatencyAvg: number | null;
        weekIncidents: number | null;
    };
    lines: TransportLine[];
    notifications: { id: string; message: string }[];
};

type DirectionFilter = "all" | "outbound" | "return";

export default function TransportPage() {
    const [data, setData] = useState<TransportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [direction, setDirection] = useState<DirectionFilter>("all");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/transport/lines");
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || "Erreur");
                setData(body);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}
        >
            <PageShell className="max-w-6xl pb-12">
                <PageHeader
                    title="Transport scolaire"
                    description={
                        data && data.configured
                            ? `${data.metrics.totalBuses ?? "?"} bus · ${data.lines.length} lignes · ${data.metrics.transportedStudents ?? "?"} élèves transportés · suivi GPS temps réel`
                            : "Suivi GPS · lignes · alertes parents (module à configurer)"
                    }
                    breadcrumbs={[
                        { label: "Vie scolaire" },
                        { label: "Transport" },
                    ]}
                    actions={
                        <>
                            <Button variant="secondary" icon="download">
                                Liste passagers PDF
                            </Button>
                            <Button icon="plus">Nouvelle ligne</Button>
                        </>
                    }
                />

                {loading ? (
                    <PageLoading label="Chargement du module transport…" />
                ) : null}

                {error ? <PageError message={error} /> : null}

                {data ? (
                    <>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: 12,
                            }}
                            className="kpi-grid"
                        >
                            <MetricCard
                                label="Bus actifs"
                                value={
                                    data.metrics.activeBuses !== null && data.metrics.totalBuses !== null
                                        ? `${data.metrics.activeBuses}/${data.metrics.totalBuses}`
                                        : "—"
                                }
                                icon="school"
                                variant={data.configured ? "success" : "neutral"}
                            />
                            <MetricCard
                                label="Élèves transportés"
                                value={
                                    data.metrics.transportedStudents !== null
                                        ? String(data.metrics.transportedStudents)
                                        : "—"
                                }
                                icon="users"
                                variant={data.configured ? "brand" : "neutral"}
                            />
                            <MetricCard
                                label="Retards moy. matin"
                                value={
                                    data.metrics.morningLatencyAvg !== null
                                        ? String(data.metrics.morningLatencyAvg).replace(
                                              ".",
                                              ","
                                          )
                                        : "—"
                                }
                                unit={
                                    data.metrics.morningLatencyAvg !== null
                                        ? "min"
                                        : undefined
                                }
                                icon="clock"
                                variant={data.configured ? "success" : "neutral"}
                            />
                            <MetricCard
                                label="Incidents · semaine"
                                value={
                                    data.metrics.weekIncidents !== null
                                        ? String(data.metrics.weekIncidents)
                                        : "—"
                                }
                                icon="check"
                                variant={data.configured ? "success" : "neutral"}
                            />
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.4fr 1fr",
                                gap: 14,
                                minHeight: 480,
                            }}
                            className="transport-grid"
                        >
                            {/* Zone carte GPS — pas de carte factice */}
                            <Card padding={0} style={{ overflow: "hidden", position: "relative", minHeight: 420 }}>
                                <div
                                    style={{
                                        padding: "12px 18px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        borderBottom:
                                            "1px solid var(--eduflow-border-subtle)",
                                        zIndex: 2,
                                        position: "relative",
                                        background: "var(--eduflow-surface-card)",
                                        flexWrap: "wrap",
                                        gap: 8,
                                    }}
                                >
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Suivi GPS
                                    </h3>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <Chip
                                            active={direction === "all"}
                                            onClick={() => setDirection("all")}
                                        >
                                            Tous
                                        </Chip>
                                        <Chip
                                            active={direction === "outbound"}
                                            onClick={() => setDirection("outbound")}
                                        >
                                            Aller
                                        </Chip>
                                        <Chip
                                            active={direction === "return"}
                                            onClick={() => setDirection("return")}
                                        >
                                            Retour
                                        </Chip>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: "grid",
                                        placeItems: "center",
                                        padding: 32,
                                        minHeight: 340,
                                        background: "var(--eduflow-surface-sunken)",
                                        textAlign: "center",
                                    }}
                                >
                                    <div style={{ maxWidth: 380 }}>
                                        <div
                                            style={{
                                                width: 56,
                                                height: 56,
                                                borderRadius: 14,
                                                background: "var(--brand-50)",
                                                display: "grid",
                                                placeItems: "center",
                                                margin: "0 auto 12px",
                                            }}
                                        >
                                            <Icon name="school" size={26} color="var(--brand-700)" />
                                        </div>
                                        <h3
                                            className="eduflow-display"
                                            style={{ fontSize: 18, margin: "0 0 6px" }}
                                        >
                                            {data.configured
                                                ? "Carte GPS non branchée"
                                                : "Module GPS à configurer"}
                                        </h3>
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                                lineHeight: 1.55,
                                                margin: 0,
                                            }}
                                        >
                                            {data.configured
                                                ? "Les lignes et bus sont déclarés, mais aucun fournisseur de géolocalisation n'est encore connecté. Les positions en direct s'afficheront ici après intégration des balises."
                                                : "Déclarez vos bus, lignes et chauffeurs, puis connectez les balises GPS. Les positions, retards et alertes s'afficheront ici en temps réel."}
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            <Card
                                padding={0}
                                style={{ display: "flex", flexDirection: "column" }}
                            >
                                <div
                                    style={{
                                        padding: "12px 18px",
                                        borderBottom:
                                            "1px solid var(--eduflow-border-subtle)",
                                    }}
                                >
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Lignes · état temps réel
                                    </h3>
                                </div>
                                <div style={{ flex: 1, overflow: "auto" }}>
                                    {data.lines.length === 0 ? (
                                        <div
                                            style={{
                                                padding: "32px 18px",
                                                textAlign: "center",
                                                fontSize: 12,
                                                color: "var(--eduflow-text-tertiary)",
                                                lineHeight: 1.55,
                                            }}
                                        >
                                            Aucune ligne configurée pour l'instant.
                                            <br />
                                            Créez votre première ligne pour démarrer le suivi.
                                        </div>
                                    ) : (
                                        data.lines.map((l, i) => (
                                            <div
                                                key={l.id}
                                                style={{
                                                    padding: "12px 18px",
                                                    borderTop:
                                                        i > 0
                                                            ? "1px solid var(--eduflow-border-subtle)"
                                                            : 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 12,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        borderRadius: 10,
                                                        background: `var(--eduflow-${l.statusVariant}-100, var(--brand-100))`,
                                                        color: `var(--eduflow-${l.statusVariant}-800)`,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        fontSize: 14,
                                                        fontWeight: 800,
                                                    }}
                                                >
                                                    {l.number}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {l.label}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        {l.driverName ?? "—"}
                                                        {l.note ? ` · ${l.note}` : ""}
                                                    </div>
                                                </div>
                                                <Badge variant={l.statusVariant} size="sm" dot>
                                                    {l.status}
                                                </Badge>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {data.notifications.length > 0 ? (
                                    <div
                                        style={{
                                            padding: 14,
                                            borderTop:
                                                "1px solid var(--eduflow-border-subtle)",
                                            background: "var(--brand-50)",
                                            display: "flex",
                                            gap: 10,
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        <Icon
                                            name="sparkle"
                                            size={14}
                                            color="var(--brand-700)"
                                            style={{ marginTop: 2 }}
                                        />
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--brand-800)",
                                                lineHeight: 1.55,
                                            }}
                                        >
                                            {data.notifications.map((n) => (
                                                <div key={n.id}>{n.message}</div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </Card>
                        </div>
                    </>
                ) : null}
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .transport-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
