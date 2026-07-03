"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { t } from "@/lib/i18n";
import { EvaluationList } from "@/components/evaluations/EvaluationList";
import { EvaluationSheet } from "@/components/evaluations/EvaluationSheet";
import { PerformanceBarChart } from "@/components/charts/PerformanceBarChart";
import { SubjectRadarChart } from "@/components/charts/SubjectRadarChart";

import { Badge, Button, Card, Chip, FilterBar, Icon, MetricCard } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageLoading } from "@/components/layout/page-states";

type GradeStats = {
    average: number;
    passRate: number;
    highest: number;
    lowest: number;
    gradeDistribution: {
        excellent: number;
        good: number;
        average: number;
        poor: number;
    };
    bySubject: Record<string, { average: number }>;
};

type StatsResponse = { statistics?: GradeStats };

const TABS = [
    { id: "list", label: "Liste des évaluations", icon: "cards" as const },
    { id: "stats", label: "Statistiques & analyse", icon: "chart" as const },
];

function exportEvaluationsCsv(evaluations: unknown) {
    const rows = Array.isArray(evaluations) ? evaluations : [];
    if (rows.length === 0) return;
    const headers = ["Titre", "Type", "Date", "Classe", "Matière"];
    const lines = rows.map((item: Record<string, unknown>) => [
        String(item.title ?? ""),
        String(item.type ?? ""),
        item.date ? new Date(String(item.date)).toLocaleDateString("fr-FR") : "",
        String((item.class as { name?: string } | undefined)?.name ?? ""),
        String((item.subject as { name?: string } | undefined)?.name ?? ""),
    ]);
    const csv = [headers, ...lines].map((line) => line.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "evaluations.csv";
    anchor.click();
    URL.revokeObjectURL(url);
}

export default function GradesPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <GradesContent />
        </PageGuard>
    );
}

function GradesContent() {
    const { data: session } = useSession();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"list" | "stats">("list");
    const [activeFilter, setActiveFilter] = useState<"all" | "devoir" | "interro" | "compo">("all");

    const { data: evaluations, isLoading: evalsLoading } = useSWR(
        activeFilter === "all"
            ? "/api/evaluations"
            : `/api/evaluations?type=${activeFilter.toUpperCase()}`,
        fetcher
    );
    const { data: statsData, isLoading: statsLoading } = useSWR<StatsResponse>(
        "/api/grades/statistics",
        fetcher
    );

    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(
        session?.user?.role || ""
    );
    const isTeacher = session?.user?.role === "TEACHER";

    const stats = statsData?.statistics;

    return (
        <PageShell className="max-w-[1400px] pb-12">
            <PageHeader
                title="Notes et évaluations"
                description="Gérez les devoirs, saisissez les notes et suivez les performances académiques."
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Notes et évaluations" },
                ]}
                actions={
                    <>
                        <Button variant="ghost" icon="download" onClick={() => exportEvaluationsCsv(evaluations)}>
                            {t("common.export")}
                        </Button>
                        <Link href="/dashboard/grades/bulletins">
                            <Button variant="secondary" icon="cards">
                                Bulletins
                            </Button>
                        </Link>
                        <Link href="/dashboard/grades/entry">
                            <Button variant="secondary" icon="pencil">
                                Saisie rapide
                            </Button>
                        </Link>
                        {isAdmin || isTeacher ? (
                            <Button icon="plus" onClick={() => setIsSheetOpen(true)}>
                                Nouvelle évaluation
                            </Button>
                        ) : null}
                    </>
                }
            />

            {/* Tabs */}
            <div
                className="flex flex-wrap items-center justify-between gap-3 border-b"
                style={{ borderColor: "var(--eduflow-border-subtle)" }}
            >
                <div className="flex flex-wrap gap-1">
                    {TABS.map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id as "list" | "stats")}
                                className="flex items-center gap-2 px-3 py-2.5"
                                style={{
                                    background: "transparent",
                                    border: 0,
                                    borderBottom: `2px solid ${
                                        active ? "var(--brand-700)" : "transparent"
                                    }`,
                                    fontSize: 12,
                                    fontWeight: active ? 700 : 600,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    color: active
                                        ? "var(--brand-700)"
                                        : "var(--eduflow-text-tertiary)",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    transition:
                                        "color var(--eduflow-motion-fast) var(--eduflow-ease-out), border-color var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                }}
                            >
                                <Icon name={tab.icon} size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filter chips — visible only on the list tab */}
            {activeTab === "list" ? (
                <FilterBar>
                    {(["all", "devoir", "interro", "compo"] as const).map((f) => (
                        <Chip
                            key={f}
                            active={activeFilter === f}
                            onClick={() => setActiveFilter(f)}
                        >
                            {f === "all" ? "Tous" : f === "devoir" ? "Devoirs" : f === "interro" ? "Interrogations" : "Compositions"}
                        </Chip>
                    ))}
                </FilterBar>
            ) : null}

            {/* Liste */}
            {activeTab === "list" ? (
                <Card padding={0}>
                    {evalsLoading ? (
                        <PageLoading label="Chargement des évaluations…" />
                    ) : (
                        <EvaluationList evaluations={evaluations || []} isLoading={false} />
                    )}
                </Card>
            ) : null}

            {/* Stats */}
            {activeTab === "stats" ? (
                <div className="flex flex-col gap-4">
                    {statsLoading ? <PageLoading label="Chargement des statistiques…" /> : null}

                    {!statsLoading && !stats ? (
                        <PageEmpty
                            icon="chart"
                            title="Aucune statistique disponible"
                            description="Les statistiques apparaîtront dès que des évaluations auront des notes enregistrées."
                            actions={[
                                { label: "Saisir des notes", href: "/dashboard/grades/entry" },
                                { label: "Créer une évaluation", onClick: () => setIsSheetOpen(true) },
                            ]}
                        />
                    ) : null}

                    {stats ? (
                        <>
                            {/* KPI strip */}
                            <div
                                className="edu-stagger"
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(220px, 1fr))",
                                    gap: 12,
                                }}
                            >
                                <MetricCard
                                    label="Moyenne générale"
                                    value={stats.average.toFixed(2).replace(".", ",")}
                                    unit="/20"
                                    icon="chart"
                                    variant={pickAverageVariant(stats.average)}
                                />
                                <MetricCard
                                    label="Taux de réussite"
                                    value={stats.passRate.toFixed(1).replace(".", ",")}
                                    unit="%"
                                    icon="check"
                                    variant={
                                        stats.passRate >= 75
                                            ? "success"
                                            : stats.passRate >= 50
                                            ? "warning"
                                            : "danger"
                                    }
                                />
                                <MetricCard
                                    label="Plus haute note"
                                    value={stats.highest.toFixed(1).replace(".", ",")}
                                    unit="/20"
                                    icon="trophy"
                                    variant="success"
                                />
                                <MetricCard
                                    label="Plus basse note"
                                    value={stats.lowest.toFixed(1).replace(".", ",")}
                                    unit="/20"
                                    icon="warning"
                                    variant={stats.lowest < 8 ? "danger" : "warning"}
                                />
                            </div>

                            {/* Charts */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
                                    gap: 16,
                                }}
                            >
                                <Card padding={20}>
                                    <div className="flex items-center justify-between">
                                        <p
                                            className="text-xs font-semibold uppercase tracking-wide"
                                            style={{ color: "var(--eduflow-text-tertiary)" }}
                                        >
                                            Distribution des résultats
                                        </p>
                                        <Badge variant="brand" size="sm">
                                            {stats.gradeDistribution.excellent +
                                                stats.gradeDistribution.good +
                                                stats.gradeDistribution.average +
                                                stats.gradeDistribution.poor}{" "}
                                            notes
                                        </Badge>
                                    </div>
                                    <div style={{ height: 280 }}>
                                        <PerformanceBarChart
                                            data={{
                                                excellent: stats.gradeDistribution.excellent,
                                                good: stats.gradeDistribution.good,
                                                average: stats.gradeDistribution.average,
                                                insufficient: stats.gradeDistribution.poor,
                                                veryGood: 0,
                                                weak: 0,
                                            }}
                                        />
                                    </div>
                                </Card>

                                <Card padding={20}>
                                    <div className="flex items-center justify-between">
                                        <p
                                            className="text-xs font-semibold uppercase tracking-wide"
                                            style={{ color: "var(--eduflow-text-tertiary)" }}
                                        >
                                            Radar par matière
                                        </p>
                                        <Badge variant="info" size="sm">
                                            {Object.keys(stats.bySubject).length} matières
                                        </Badge>
                                    </div>
                                    <div style={{ height: 280 }}>
                                        <SubjectRadarChart
                                            data={Object.entries(stats.bySubject).map(
                                                ([subject, s]) => ({
                                                    name: subject,
                                                    average: s.average,
                                                })
                                            )}
                                        />
                                    </div>
                                </Card>
                            </div>

                            {/* Subject ranking — bonus inspired du bundle Teacher */}
                            <Card padding={20}>
                                <div className="mb-3 flex items-center justify-between">
                                    <p
                                        className="text-xs font-semibold uppercase tracking-wide"
                                        style={{ color: "var(--eduflow-text-tertiary)" }}
                                    >
                                        Classement par matière
                                    </p>
                                    <Badge variant="neutral" size="sm">
                                        Top {Math.min(8, Object.keys(stats.bySubject).length)}
                                    </Badge>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {Object.entries(stats.bySubject)
                                        .sort(([, a], [, b]) => b.average - a.average)
                                        .slice(0, 8)
                                        .map(([subject, s]) => {
                                            const variant = pickAverageVariant(s.average);
                                            const ratio = Math.max(
                                                0,
                                                Math.min(100, (s.average / 20) * 100)
                                            );
                                            return (
                                                <div
                                                    key={subject}
                                                    className="grid items-center gap-3"
                                                    style={{
                                                        gridTemplateColumns:
                                                            "minmax(120px, 180px) minmax(0, 1fr) 64px",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: "var(--eduflow-text-primary)",
                                                        }}
                                                    >
                                                        {subject}
                                                    </div>
                                                    <div
                                                        style={{
                                                            height: 6,
                                                            background:
                                                                "var(--eduflow-neutral-200)",
                                                            borderRadius: 3,
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                height: "100%",
                                                                width: `${ratio}%`,
                                                                background: `var(--eduflow-${variant}-500)`,
                                                                transition:
                                                                    "width var(--eduflow-motion-base) var(--eduflow-ease-out)",
                                                            }}
                                                        />
                                                    </div>
                                                    <span
                                                        className="eduflow-display eduflow-tabular text-right"
                                                        style={{
                                                            fontSize: 16,
                                                            fontWeight: 700,
                                                            color: `var(--eduflow-${variant}-700)`,
                                                        }}
                                                    >
                                                        {s.average.toFixed(1).replace(".", ",")}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </Card>
                        </>
                    ) : null}
                </div>
            ) : null}

            <EvaluationSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} />
        </PageShell>
    );
}

function pickAverageVariant(
    avg: number
): "success" | "brand" | "warning" | "danger" {
    if (avg >= 14) return "success";
    if (avg >= 10) return "brand";
    if (avg >= 8) return "warning";
    return "danger";
}
