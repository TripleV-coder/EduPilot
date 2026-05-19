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
    Spinner,
} from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

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
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Transport scolaire"
                    sub={
                        data && data.configured
                            ? `${data.metrics.totalBuses ?? "?"} bus · ${data.lines.length} lignes · ${data.metrics.transportedStudents ?? "?"} élèves transportés · suivi GPS temps réel`
                            : "Suivi GPS · lignes · alertes parents (module à configurer)"
                    }
                    breadcrumb={["Vie scolaire", "Transport"]}
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
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement du module transport…
                        </span>
                    </div>
                ) : null}

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-danger-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </Card>
                ) : null}

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
                            {/* Map mock */}
                            <Card padding={0} style={{ overflow: "hidden", position: "relative" }}>
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
                                        position: "absolute",
                                        inset: "60px 0 0 0",
                                        background:
                                            "radial-gradient(circle at 30% 20%, rgba(16,185,129,0.10), transparent 40%), radial-gradient(circle at 70% 60%, rgba(245,158,11,0.10), transparent 40%), linear-gradient(135deg, #f0f7f5, #f3f6fc)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <svg
                                        width="100%"
                                        height="100%"
                                        style={{ position: "absolute", inset: 0 }}
                                        viewBox="0 0 800 500"
                                        preserveAspectRatio="xMidYMid slice"
                                    >
                                        <path
                                            d="M0 200 Q 200 150 400 230 T 800 250"
                                            stroke="rgba(15,23,42,0.12)"
                                            strokeWidth="6"
                                            fill="none"
                                        />
                                        <path
                                            d="M100 0 Q 200 200 350 300 T 500 500"
                                            stroke="rgba(15,23,42,0.10)"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            d="M0 400 Q 250 380 500 430 T 800 410"
                                            stroke="rgba(15,23,42,0.10)"
                                            strokeWidth="5"
                                            fill="none"
                                        />
                                        <circle cx="400" cy="260" r="14" fill="var(--brand-700)" />
                                        <text
                                            x="400"
                                            y="290"
                                            textAnchor="middle"
                                            fill="var(--eduflow-text-primary)"
                                            fontSize="11"
                                            fontWeight="700"
                                        >
                                            École
                                        </text>
                                    </svg>
                                    {!data.configured ? (
                                        <div
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                display: "grid",
                                                placeItems: "center",
                                                background: "rgba(255,255,255,0.55)",
                                                backdropFilter: "blur(2px)",
                                                padding: 20,
                                                textAlign: "center",
                                            }}
                                        >
                                            <div style={{ maxWidth: 360 }}>
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
                                                    style={{
                                                        fontSize: 18,
                                                        margin: "0 0 6px",
                                                    }}
                                                >
                                                    Module GPS à configurer
                                                </h3>
                                                <p
                                                    style={{
                                                        fontSize: 12,
                                                        color: "var(--eduflow-text-secondary)",
                                                        lineHeight: 1.55,
                                                        margin: 0,
                                                    }}
                                                >
                                                    Active le suivi en déclarant tes bus, lignes et chauffeurs,
                                                    puis connecte les balises GPS. Les positions, retards et
                                                    alertes SMS s'afficheront ici en temps réel.
                                                </p>
                                            </div>
                                        </div>
                                    ) : null}
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
                                            Crée ta première ligne pour démarrer le suivi.
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
            </div>

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
