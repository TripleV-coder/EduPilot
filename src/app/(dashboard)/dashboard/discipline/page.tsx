"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Chip,
    Icon,
    MetricCard,
    Progress,
    Sparkline,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Incident = {
    id: string;
    incidentType: string;
    severity: Severity;
    date: string;
    location: string | null;
    description: string;
    actionTaken: string | null;
    isResolved: boolean;
    student?: {
        id: string;
        firstName?: string;
        lastName?: string;
        user?: { firstName: string; lastName: string };
        enrollments?: { class?: { name: string } | null }[];
        matricule?: string;
    };
    reportedBy?: {
        firstName?: string;
        lastName?: string;
    } | null;
};

type IncidentsResponse =
    | Incident[]
    | { data?: Incident[]; incidents?: Incident[]; total?: number };

type StatsBucket = { count: number };

type Statistics = {
    total?: number;
    inProgress?: number;
    bySeverity?: Record<Severity, StatsBucket | number>;
    byType?: Record<string, StatsBucket | number>;
    weeklyTrend?: number[];
    weeklyCount?: number;
    weekOverWeekChange?: number;
};

type FilterCategory = "all" | "late" | "behavior" | "dress" | "cheating" | "fight";

const CATEGORY_MAP: Record<FilterCategory, string[]> = {
    all: [],
    late: ["LATE"],
    behavior: ["DISRESPECT", "DISRUPTION", "INAPPROPRIATE_LANGUAGE", "BULLYING"],
    dress: ["DRESS_CODE"],
    cheating: ["CHEATING"],
    fight: ["VIOLENCE", "VANDALISM"],
};

const TYPE_LABEL: Record<string, string> = {
    LATE: "Retard",
    ABSENCE_UNEXCUSED: "Absence non excusée",
    DISRESPECT: "Manque de respect",
    DISRUPTION: "Bavardages / perturbation",
    CHEATING: "Tricherie",
    BULLYING: "Harcèlement",
    VIOLENCE: "Bagarre",
    VANDALISM: "Vandalisme",
    THEFT: "Vol",
    SUBSTANCE: "Substance interdite",
    INAPPROPRIATE_LANGUAGE: "Langage inapproprié",
    DRESS_CODE: "Tenue non conforme",
};

const SEVERITY_VARIANT: Record<
    Severity,
    "info" | "warning" | "danger" | "neutral"
> = {
    LOW: "info",
    MEDIUM: "warning",
    HIGH: "danger",
    CRITICAL: "danger",
};

const SEVERITY_LABEL: Record<Severity, string> = {
    LOW: "Rappel verbal",
    MEDIUM: "Avertissement",
    HIGH: "Sanction",
    CRITICAL: "Conseil de discipline",
};

const FR_DATE = (iso: string): string => {
    try {
        const d = new Date(iso);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const isToday = d.toDateString() === today.toDateString();
        const isYesterday = d.toDateString() === yesterday.toDateString();
        const time = d.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
        if (isToday) return `aujourd'hui ${time}`;
        if (isYesterday) return `hier ${time}`;
        return d.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
        });
    } catch {
        return iso;
    }
};

function studentName(s: Incident["student"]): string {
    if (!s) return "Élève";
    if (s.user) return `${s.user.firstName} ${s.user.lastName}`;
    if (s.firstName || s.lastName)
        return `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
    return s.matricule ?? "Élève";
}

function reporterName(r: Incident["reportedBy"]): string {
    if (!r) return "Vie scolaire";
    return `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Vie scolaire";
}

function studentClass(s: Incident["student"]): string {
    return s?.enrollments?.[0]?.class?.name ?? "";
}

function getCount(b: StatsBucket | number | undefined): number {
    if (b === undefined || b === null) return 0;
    if (typeof b === "number") return b;
    return b.count ?? 0;
}

export default function DisciplinePage() {
    const [filter, setFilter] = useState<FilterCategory>("all");

    const { data: incRaw, isLoading: incLoading } = useSWR<IncidentsResponse>(
        "/api/incidents?limit=50",
        fetcher
    );
    const { data: stats, isLoading: statsLoading } = useSWR<Statistics>(
        "/api/incidents/statistics?period=week",
        fetcher
    );
    const { data: trendStats } = useSWR<Statistics>(
        "/api/incidents/statistics?period=year",
        fetcher
    );

    const incidents: Incident[] = useMemo(() => {
        if (!incRaw) return [];
        if (Array.isArray(incRaw)) return incRaw;
        return incRaw.incidents ?? incRaw.data ?? [];
    }, [incRaw]);

    const filtered = useMemo(() => {
        if (filter === "all") return incidents;
        const types = CATEGORY_MAP[filter];
        return incidents.filter((i) => types.includes(i.incidentType));
    }, [incidents, filter]);

    // Chip counts
    const countOf = (cat: FilterCategory): number => {
        if (cat === "all") return incidents.length;
        const types = CATEGORY_MAP[cat];
        return incidents.filter((i) => types.includes(i.incidentType)).length;
    };

    // Trend
    const weeklyTrend = useMemo(() => {
        if (trendStats?.weeklyTrend && trendStats.weeklyTrend.length > 0)
            return trendStats.weeklyTrend.slice(-8);
        return [];
    }, [trendStats]);

    // Top motifs (across all incidents)
    const topMotifs = useMemo<
        { label: string; value: number; variant: "success" | "warning" | "danger" | "brand" }[]
    >(() => {
        const counts = new Map<string, number>();
        for (const i of incidents) {
            counts.set(i.incidentType, (counts.get(i.incidentType) ?? 0) + 1);
        }
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, value]) => ({
                label: TYPE_LABEL[type] ?? type,
                value,
                variant: motifVariant(type),
            }));
    }, [incidents]);

    const weeklyCount =
        stats?.weeklyCount ?? stats?.total ?? incidents.length;
    const weeklyChange = stats?.weekOverWeekChange ?? null;
    const inProgress =
        stats?.inProgress ??
        incidents.filter((i) => !i.isResolved).length;
    const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;

    return (
        <PageGuard
            permission={Permission.INCIDENT_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Discipline & comportement"
                    sub="Suivi des sanctions, retards, manquements"
                    breadcrumb={["Vie scolaire", "Discipline"]}
                    actions={
                        <>
                            <Link href="/dashboard/incidents" style={{ textDecoration: "none" }}>
                                <Button variant="secondary" icon="download">
                                    Registre
                                </Button>
                            </Link>
                            <Link href="/dashboard/incidents/new" style={{ textDecoration: "none" }}>
                                <Button icon="plus">Nouveau rapport</Button>
                            </Link>
                        </>
                    }
                />

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 12,
                    }}
                    className="kpi-grid"
                >
                    <MetricCard
                        label="Rapports semaine"
                        value={String(weeklyCount)}
                        trend={weeklyChange ?? undefined}
                        icon="warning"
                        variant={weeklyCount > 15 ? "warning" : "info"}
                    />
                    <MetricCard
                        label="En cours"
                        value={String(inProgress)}
                        icon="clock"
                        variant="info"
                    />
                    <MetricCard
                        label="Conseil de discipline"
                        value={String(criticalCount)}
                        icon="danger"
                        variant={criticalCount > 0 ? "danger" : "neutral"}
                    />
                    <MetricCard
                        label="Climat global"
                        value={weeklyCount < 10 ? "Excellent" : weeklyCount < 20 ? "Bon" : "À surveiller"}
                        icon="check"
                        variant={
                            weeklyCount < 10 ? "success" : weeklyCount < 20 ? "success" : "warning"
                        }
                    />
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 1fr",
                        gap: 14,
                    }}
                    className="disc-grid"
                >
                    <Card padding={0}>
                        <div
                            style={{
                                padding: "12px 18px",
                                display: "flex",
                                gap: 8,
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                                alignItems: "center",
                                flexWrap: "wrap",
                            }}
                        >
                            <Chip
                                active={filter === "all"}
                                onClick={() => setFilter("all")}
                            >
                                Tous
                            </Chip>
                            <Chip
                                active={filter === "late"}
                                count={countOf("late")}
                                onClick={() => setFilter("late")}
                            >
                                Retards
                            </Chip>
                            <Chip
                                active={filter === "behavior"}
                                count={countOf("behavior")}
                                onClick={() => setFilter("behavior")}
                            >
                                Comportement
                            </Chip>
                            <Chip
                                active={filter === "dress"}
                                count={countOf("dress")}
                                onClick={() => setFilter("dress")}
                            >
                                Tenue
                            </Chip>
                            <Chip
                                active={filter === "cheating"}
                                count={countOf("cheating")}
                                onClick={() => setFilter("cheating")}
                            >
                                Tricherie
                            </Chip>
                            <Chip
                                active={filter === "fight"}
                                count={countOf("fight")}
                                onClick={() => setFilter("fight")}
                            >
                                Bagarre
                            </Chip>
                        </div>
                        <div>
                            {incLoading ? (
                                <div
                                    style={{
                                        padding: "32px 18px",
                                        textAlign: "center",
                                    }}
                                >
                                    <Spinner size={24} color="var(--brand-600)" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div
                                    style={{
                                        padding: "32px 18px",
                                        textAlign: "center",
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    Aucun incident dans cette catégorie.
                                </div>
                            ) : (
                                filtered.map((r, i) => {
                                    const name = studentName(r.student);
                                    const klass = studentClass(r.student);
                                    const by = reporterName(r.reportedBy);
                                    return (
                                        <div
                                            key={r.id}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                    "40px 1fr 140px 110px",
                                                gap: 14,
                                                padding: "14px 18px",
                                                borderTop:
                                                    i > 0
                                                        ? "1px solid var(--eduflow-border-subtle)"
                                                        : 0,
                                                alignItems: "center",
                                            }}
                                            className="disc-row"
                                        >
                                            <Avatar name={name} size="sm" />
                                            <div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {name}
                                                    </span>
                                                    {klass ? (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                color:
                                                                    "var(--eduflow-text-tertiary)",
                                                            }}
                                                        >
                                                            · {klass}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color:
                                                            "var(--eduflow-text-secondary)",
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {TYPE_LABEL[r.incidentType] ??
                                                        r.incidentType}
                                                    {r.location
                                                        ? ` · ${r.location}`
                                                        : ""}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color:
                                                            "var(--eduflow-text-tertiary)",
                                                        marginTop: 3,
                                                    }}
                                                >
                                                    par {by} · {FR_DATE(r.date)}
                                                </div>
                                            </div>
                                            <Badge
                                                variant={
                                                    SEVERITY_VARIANT[r.severity]
                                                }
                                                size="sm"
                                            >
                                                {SEVERITY_LABEL[r.severity]}
                                            </Badge>
                                            <Link
                                                href={`/dashboard/incidents/${r.id}`}
                                                style={{ textDecoration: "none" }}
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    iconRight="chevron"
                                                >
                                                    Détail
                                                </Button>
                                            </Link>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Card>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card>
                            <SubLabel>Évolution sur 8 semaines</SubLabel>
                            {weeklyTrend.length > 0 ? (
                                <>
                                    <Sparkline
                                        data={weeklyTrend}
                                        color="var(--eduflow-warning-600)"
                                        height={56}
                                    />
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 4,
                                        }}
                                    >
                                        S{Math.max(1, 9 - weeklyTrend.length)} → S8 · rapports / semaine
                                    </div>
                                </>
                            ) : (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        padding: "12px 0",
                                    }}
                                >
                                    Pas encore assez de données.
                                </div>
                            )}
                            {weeklyChange !== null && weeklyChange !== undefined ? (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        marginTop: 8,
                                        fontSize: 12,
                                        color:
                                            weeklyChange < 0
                                                ? "var(--eduflow-success-700)"
                                                : "var(--eduflow-danger-700)",
                                        fontWeight: 600,
                                    }}
                                >
                                    {weeklyChange < 0 ? "↓" : "↑"}{" "}
                                    {Math.abs(weeklyChange).toFixed(0)}% vs semaine dernière
                                </div>
                            ) : null}
                        </Card>

                        <Card>
                            <SubLabel>Top motifs</SubLabel>
                            {statsLoading ? (
                                <div
                                    style={{
                                        padding: 8,
                                        textAlign: "center",
                                    }}
                                >
                                    <Spinner size={18} color="var(--brand-600)" />
                                </div>
                            ) : topMotifs.length === 0 ? (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        padding: "12px 0",
                                    }}
                                >
                                    Aucun motif récent.
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 10,
                                        marginTop: 8,
                                    }}
                                >
                                    {topMotifs.map((m) => (
                                        <Progress
                                            key={m.label}
                                            label={m.label}
                                            sublabel={String(m.value)}
                                            value={
                                                Math.min(
                                                    100,
                                                    (m.value / (topMotifs[0]?.value || 1)) *
                                                        100
                                                )
                                            }
                                            variant={m.variant}
                                        />
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card
                            style={{
                                background: "var(--brand-50)",
                                border: "1px solid var(--brand-200)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 10 }}>
                                <Icon
                                    name="sparkle"
                                    size={16}
                                    color="var(--brand-700)"
                                    style={{ marginTop: 2 }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "var(--brand-900, var(--brand-800))",
                                        }}
                                    >
                                        Insight
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: "var(--brand-800)",
                                            margin: "4px 0 0",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        {generateInsight(incidents, topMotifs)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .disc-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .disc-row {
                        grid-template-columns: 40px 1fr !important;
                    }
                    .disc-row > :nth-child(3),
                    .disc-row > :nth-child(4) {
                        grid-column: 2;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function motifVariant(
    type: string
): "success" | "warning" | "danger" | "brand" {
    if (["VIOLENCE", "CHEATING", "BULLYING", "SUBSTANCE"].includes(type))
        return "danger";
    if (["DISRESPECT", "DISRUPTION", "INAPPROPRIATE_LANGUAGE"].includes(type))
        return "warning";
    return "brand";
}

function generateInsight(
    incidents: Incident[],
    motifs: { label: string; value: number }[]
): string {
    if (incidents.length === 0)
        return "Aucun incident enregistré sur la période. Continue à observer pour repérer les signaux faibles.";
    const top = motifs[0];
    if (!top)
        return "Période calme. Les rapports restent isolés — pas de motif dominant détecté.";
    const sameClass = new Map<string, number>();
    for (const i of incidents) {
        const k = i.student?.enrollments?.[0]?.class?.name;
        if (k) sameClass.set(k, (sameClass.get(k) ?? 0) + 1);
    }
    const topClass = Array.from(sameClass.entries()).sort(
        (a, b) => b[1] - a[1]
    )[0];
    if (topClass && topClass[1] >= 3) {
        return `Le motif "${top.label}" domine cette semaine, surtout en ${topClass[0]} (${topClass[1]} rapports). Suggère une intervention ciblée du professeur principal.`;
    }
    return `Le motif "${top.label}" est le plus fréquent (${top.value} rapports). Considère un point de communication global avec les enseignants.`;
}
