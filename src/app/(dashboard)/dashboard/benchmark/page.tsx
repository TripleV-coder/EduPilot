"use client";

import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Card, Icon } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";

type BenchmarkIndicator = {
    id: string;
    label: string;
    schoolValue: number;
    nationalValue: number | null;
    departmentValue: number | null;
    peerValue: number | null;
    unit: string | null;
    tone: string | null;
};

type BenchmarkSnapshot = {
    id: string;
    capturedAt: string;
    periodLabel: string | null;
    rankNational: number | null;
    rankDept: number | null;
    rankPeerGroup: number | null;
    totalNational: number | null;
    totalDept: number | null;
    totalPeer: number | null;
    scoreOverall: number | null;
    indicators: BenchmarkIndicator[];
};

type BenchmarkResponse = {
    schoolId: string;
    snapshot: BenchmarkSnapshot | null;
};

const numberFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function formatValue(value: number | null, unit: string | null): string {
    if (value === null || value === undefined) return "—";
    return `${numberFr.format(value)}${unit ?? ""}`;
}

function RankBlock({
    label,
    rank,
    total,
    subtitle,
}: {
    label: string;
    rank: number | null;
    total: number | null;
    subtitle: string;
}) {
    return (
        <div style={{ padding: 24 }}>
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    opacity: 0.85,
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 72,
                    fontWeight: 800,
                    lineHeight: 0.95,
                    letterSpacing: "-0.04em",
                    marginTop: 8,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {rank !== null ? rank : "—"}
                {rank !== null ? (
                    <span style={{ fontSize: 24, fontWeight: 700, opacity: 0.8 }}> ᵉ</span>
                ) : null}
            </div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                {total !== null ? `sur ${numberFr.format(total)} ${subtitle}` : subtitle}
            </div>
        </div>
    );
}

export default function BenchmarkPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <BenchmarkPageContent />
        </PageGuard>
    );
}

const BENCHMARK_BREADCRUMBS = [
    { label: "Analytics" },
    { label: "Benchmark" },
] as const;

function BenchmarkPageContent() {
    const { data, error, isLoading } = useSWR<BenchmarkResponse>(
        "/api/benchmark/latest",
        fetcher,
        { revalidateOnFocus: false, refreshInterval: 300_000 },
    );

    if (isLoading) {
        return (
            <PageShell className="pb-12">
                <PageHeader
                    title="Benchmark national · MEMP open data"
                    description="Chargement du dernier snapshot…"
                    breadcrumbs={[...BENCHMARK_BREADCRUMBS]}
                />
                <PageLoading label="Chargement du benchmark…" />
            </PageShell>
        );
    }

    if (error || !data) {
        return (
            <PageShell className="pb-12">
                <PageHeader
                    title="Benchmark national · MEMP open data"
                    description="Impossible de charger le benchmark"
                    breadcrumbs={[...BENCHMARK_BREADCRUMBS]}
                />
                <PageError message="Le service benchmark est momentanément indisponible. Réessayez dans quelques instants ou contactez l'administrateur." />
            </PageShell>
        );
    }

    const snapshot = data.snapshot;

    if (!snapshot) {
        return (
            <PageShell className="pb-12">
                <PageHeader
                    title="Benchmark national · MEMP open data"
                    description="Positionnement de votre établissement parmi les collèges du Bénin · anonymisé"
                    breadcrumbs={[...BENCHMARK_BREADCRUMBS]}
                />
                <PageEmpty
                    icon="trophy"
                    title="Aucun snapshot benchmark disponible"
                    description="Le premier classement apparaîtra dès que les données MEMP / DEC de la période en cours auront été ingérées. L'ingestion est mensuelle et automatique."
                />
            </PageShell>
        );
    }

    const strengths = snapshot.indicators.filter((i) => i.tone === "success");
    const improvements = snapshot.indicators.filter(
        (i) => i.tone === "warning" || i.tone === "danger",
    );
    const capturedAt = new Date(snapshot.capturedAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    return (
        <>
        <PageShell className="pb-12">
            <PageHeader
                title="Benchmark national · MEMP open data"
                description={`Positionnement de votre établissement · anonymisé · snapshot du ${capturedAt}`}
                breadcrumbs={[...BENCHMARK_BREADCRUMBS]}
                actions={
                    <Badge variant="brand" size="sm">
                        {snapshot.periodLabel ?? "Période courante"}
                    </Badge>
                }
            />

            <Card
                style={{
                    background:
                        "linear-gradient(135deg, var(--brand-800), var(--brand-accent-600))",
                    color: "#fff",
                    border: 0,
                }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 0,
                        alignItems: "stretch",
                    }}
                    className="bench-rank-grid"
                >
                    <RankBlock
                        label="Classement national"
                        rank={snapshot.rankNational}
                        total={snapshot.totalNational}
                        subtitle="collèges du Bénin"
                    />
                    <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
                        <RankBlock
                            label="Rang département"
                            rank={snapshot.rankDept}
                            total={snapshot.totalDept}
                            subtitle="collèges du département"
                        />
                    </div>
                    <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
                        <RankBlock
                            label="Groupe pair"
                            rank={snapshot.rankPeerGroup}
                            total={snapshot.totalPeer}
                            subtitle="collèges similaires"
                        />
                    </div>
                </div>
            </Card>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: 14,
                }}
                className="bench-grid"
            >
                <Card padding={0} style={{ overflow: "hidden" }}>
                    <div
                        style={{
                            padding: "14px 18px",
                            borderBottom: "1px solid var(--border-subtle)",
                        }}
                    >
                        <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                            Comparatif détaillé · vous vs moyennes
                        </h3>
                        <p
                            style={{
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                margin: "2px 0 0",
                            }}
                        >
                            Sources MEMP · DEC · open data
                        </p>
                    </div>
                    {snapshot.indicators.length === 0 ? (
                        <div style={{ padding: 32, textAlign: "center" }}>
                            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                                Aucun indicateur dans ce snapshot.
                            </p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table
                                style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    fontSize: 12,
                                }}
                            >
                                <thead>
                                    <tr style={{ background: "var(--surface-sunken)" }}>
                                        {[
                                            "Indicateur",
                                            "Vous",
                                            "Pair",
                                            "Département",
                                            "National",
                                            "Position",
                                        ].map((h, i) => (
                                            <th
                                                key={h}
                                                style={{
                                                    padding: "10px 14px",
                                                    textAlign: i === 0 ? "left" : "right",
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color: "var(--text-tertiary)",
                                                    letterSpacing: "0.06em",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {snapshot.indicators.map((r) => {
                                        const good = r.tone === "success";
                                        return (
                                            <tr
                                                key={r.id}
                                                style={{
                                                    borderTop: "1px solid var(--border-subtle)",
                                                }}
                                            >
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                        fontWeight: 600,
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {r.label}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "right",
                                                        background: "var(--brand-50)",
                                                    }}
                                                >
                                                    <span
                                                        className="eduflow-display tabular"
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                            color: "var(--brand-800)",
                                                            fontVariantNumeric: "tabular-nums",
                                                        }}
                                                    >
                                                        {formatValue(r.schoolValue, r.unit)}
                                                    </span>
                                                </td>
                                                <td
                                                    className="tabular"
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "right",
                                                        color: "var(--text-secondary)",
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {formatValue(r.peerValue, r.unit)}
                                                </td>
                                                <td
                                                    className="tabular"
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "right",
                                                        color: "var(--text-secondary)",
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {formatValue(r.departmentValue, r.unit)}
                                                </td>
                                                <td
                                                    className="tabular"
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "right",
                                                        color: "var(--text-secondary)",
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {formatValue(r.nationalValue, r.unit)}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: "12px 14px",
                                                        textAlign: "right",
                                                    }}
                                                >
                                                    <Badge
                                                        variant={good ? "success" : "warning"}
                                                        size="sm"
                                                        icon={good ? "check" : "warning"}
                                                    >
                                                        {good ? "Au-dessus" : "À combler"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Card
                        padding={20}
                        style={{
                            background: "var(--success-50)",
                            border: "1px solid var(--success-200)",
                        }}
                    >
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--eduflow-text-tertiary)" }}>Vos points forts · à mettre en avant</p>
                        {strengths.length === 0 ? (
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--success-900)",
                                    margin: "12px 0 0",
                                }}
                            >
                                Aucun indicateur au-dessus des moyennes sur cette période.
                            </p>
                        ) : (
                            <ul
                                style={{
                                    margin: "12px 0 0",
                                    padding: 0,
                                    listStyle: "none",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                {strengths.map((i) => (
                                    <li
                                        key={i.id}
                                        style={{
                                            display: "flex",
                                            gap: 8,
                                            fontSize: 12,
                                            color: "var(--success-900)",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        <Icon
                                            name="check"
                                            size={14}
                                            color="var(--success-700)"
                                            style={{ marginTop: 2, flexShrink: 0 }}
                                        />
                                        <span>
                                            {i.label} · {formatValue(i.schoolValue, i.unit)}
                                            {i.nationalValue !== null
                                                ? ` (national : ${formatValue(i.nationalValue, i.unit)})`
                                                : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card
                        padding={20}
                        style={{
                            background: "var(--warning-50)",
                            border: "1px solid var(--warning-200)",
                        }}
                    >
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--eduflow-text-tertiary)" }}>Axes d&apos;amélioration prioritaires</p>
                        {improvements.length === 0 ? (
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--warning-900)",
                                    margin: "12px 0 0",
                                }}
                            >
                                Aucun indicateur en retrait sur cette période. Continuez !
                            </p>
                        ) : (
                            <ul
                                style={{
                                    margin: "12px 0 0",
                                    padding: 0,
                                    listStyle: "none",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                {improvements.map((i) => (
                                    <li
                                        key={i.id}
                                        style={{
                                            display: "flex",
                                            gap: 8,
                                            fontSize: 12,
                                            color: "var(--warning-900)",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        <Icon
                                            name="warning"
                                            size={14}
                                            color="var(--warning-700)"
                                            style={{ marginTop: 2, flexShrink: 0 }}
                                        />
                                        <span>
                                            {i.label} · {formatValue(i.schoolValue, i.unit)}
                                            {i.peerValue !== null
                                                ? ` (pair : ${formatValue(i.peerValue, i.unit)})`
                                                : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    {snapshot.scoreOverall !== null ? (
                        <Card
                            padding={16}
                            style={{
                                background: "var(--brand-50)",
                                border: "1px solid var(--brand-200)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <Icon
                                    name="sparkle"
                                    size={18}
                                    color="var(--brand-700)"
                                    style={{ flexShrink: 0 }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "var(--brand-900)",
                                        }}
                                    >
                                        Score global :{" "}
                                        <span className="tabular">
                                            {numberFr.format(snapshot.scoreOverall)}/100
                                        </span>
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: "var(--brand-800)",
                                            margin: "4px 0 0",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        Indice composite calculé sur l&apos;ensemble des
                                        indicateurs du snapshot.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    ) : null}
                </div>
            </div>
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .bench-rank-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .bench-rank-grid > div {
                        border-left: 0 !important;
                        border-top: 1px solid rgba(255, 255, 255, 0.15) !important;
                    }
                    .bench-rank-grid > div:first-child {
                        border-top: 0 !important;
                    }
                    .bench-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </>
    );
}
