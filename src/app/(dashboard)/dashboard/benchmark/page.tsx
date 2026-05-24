"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type RankBlock = {
    label: string;
    value: string;
    subtitle: string;
    chip: string;
    chipIcon?: "arrowUp" | "trophy";
};

type Indicator = {
    label: string;
    you: string;
    peer: string;
    department: string;
    national: string;
    tone: "success" | "warning";
    good: boolean;
};

const RANKS: RankBlock[] = [
    {
        label: "Classement national · BEPC 2024",
        value: "187",
        subtitle: "sur 4 280 collèges du Bénin",
        chip: "+42 places vs 2023",
        chipIcon: "arrowUp",
    },
    {
        label: "Rang département · Littoral",
        value: "12",
        subtitle: "sur 184 collèges",
        chip: "Top 7% département",
        chipIcon: "trophy",
    },
    {
        label: "Groupe pair · 28 collèges similaires",
        value: "4",
        subtitle: "Privés Cotonou · 800-1500 él.",
        chip: "Podium attendu en 2026",
        chipIcon: "trophy",
    },
];

const INDICATORS: Indicator[] = [
    {
        label: "Taux de réussite BEPC",
        you: "78%",
        peer: "72%",
        department: "68%",
        national: "62%",
        tone: "success",
        good: true,
    },
    {
        label: "Mention Bien et +",
        you: "24%",
        peer: "18%",
        department: "15%",
        national: "11%",
        tone: "success",
        good: true,
    },
    {
        label: "Taux d'abandon",
        you: "3,2%",
        peer: "4,1%",
        department: "5,8%",
        national: "7,4%",
        tone: "success",
        good: true,
    },
    {
        label: "Parité filles/garçons",
        you: "52%",
        peer: "48%",
        department: "46%",
        national: "42%",
        tone: "success",
        good: true,
    },
    {
        label: "Heures cours / sem.",
        you: "28h",
        peer: "30h",
        department: "29h",
        national: "27h",
        tone: "warning",
        good: false,
    },
    {
        label: "Ratio élèves / prof",
        you: "22",
        peer: "28",
        department: "34",
        national: "42",
        tone: "success",
        good: true,
    },
    {
        label: "Présence enseignants",
        you: "94%",
        peer: "88%",
        department: "82%",
        national: "78%",
        tone: "success",
        good: true,
    },
    {
        label: "Accès Wi-Fi école",
        you: "Oui",
        peer: "64%",
        department: "32%",
        national: "18%",
        tone: "success",
        good: true,
    },
];

const STRENGTHS = [
    "Taux de réussite BEPC > moyenne nationale +16 pts",
    "Ratio élèves/prof exceptionnel (22 vs national 42)",
    "Parité filles/garçons supérieure à l'OMD",
    "Couverture Wi-Fi 100% (rare au Bénin)",
];

const IMPROVEMENTS = [
    "Heures de cours : −2h/sem vs pair · revoir EDT",
    "Maths · moyenne 11,8 vs pair 12,9 (−1,1 pt)",
    "Activités sportives extra : 1 vs 2,3 chez pair",
];

export default function BenchmarkPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Benchmark national · MEMP open data"
                    sub="Positionnement de votre établissement parmi 4 280 collèges du Bénin · anonymisé"
                    breadcrumb={["Analytics", "Benchmark"]}
                    actions={
                        <>
                            <Badge variant="brand" size="sm">
                                Données MEMP 2024-2025
                            </Badge>
                            <Button variant="secondary" icon="download" disabled>
                                Rapport conseil d'administration
                            </Button>
                        </>
                    }
                />

                <Card
                    padding={14}
                    style={{
                        background: "var(--brand-50)",
                        border: "1px solid var(--brand-200)",
                    }}
                >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Icon
                            name="info"
                            size={16}
                            color="var(--brand-700)"
                            style={{ marginTop: 2 }}
                        />
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--brand-800)",
                                lineHeight: 1.55,
                            }}
                        >
                            Modèles <code>BenchmarkSnapshot</code> +{" "}
                            <code>BenchmarkSnapshotIndicator</code> en place côté Prisma ·
                            endpoint <code>/api/benchmark/latest</code> opérationnel (retourne
                            null tant qu&apos;aucun snapshot n&apos;est calculé). Reste à
                            brancher l&apos;ingestion mensuelle MEMP / open data DEC pour
                            alimenter les valeurs national/département/peer-group. Les
                            indicateurs ci-dessous sont illustratifs.
                        </div>
                    </div>
                </Card>

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
                        {RANKS.map((r, i) => (
                            <div
                                key={r.label}
                                style={{
                                    padding: 24,
                                    borderLeft:
                                        i > 0
                                            ? "1px solid rgba(255,255,255,0.15)"
                                            : 0,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        opacity: 0.85,
                                    }}
                                >
                                    {r.label}
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
                                    {r.value}
                                    <span
                                        style={{
                                            fontSize: 24,
                                            fontWeight: 700,
                                            opacity: 0.8,
                                        }}
                                    >
                                        {" "}
                                        ᵉ
                                    </span>
                                </div>
                                <div
                                    style={{
                                        fontSize: 14,
                                        opacity: 0.9,
                                        marginTop: 4,
                                    }}
                                >
                                    {r.subtitle}
                                </div>
                                <div
                                    style={{
                                        marginTop: 12,
                                        padding: "6px 12px",
                                        background: "rgba(255,255,255,0.15)",
                                        borderRadius: 999,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        fontSize: 12,
                                        fontWeight: 600,
                                    }}
                                >
                                    {r.chipIcon ? (
                                        <Icon name={r.chipIcon} size={12} color="#fff" />
                                    ) : null}
                                    {r.chip}
                                </div>
                            </div>
                        ))}
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
                            <h3
                                className="eduflow-display"
                                style={{ fontSize: 16, margin: 0 }}
                            >
                                Comparatif détaillé · vous vs moyennes nationales
                            </h3>
                            <p
                                style={{
                                    fontSize: 11,
                                    color: "var(--text-tertiary)",
                                    margin: "2px 0 0",
                                }}
                            >
                                Sources MEMP · DEC · OCDE Education at a Glance 2024
                            </p>
                        </div>
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
                                    {INDICATORS.map((r) => (
                                        <tr
                                            key={r.label}
                                            style={{
                                                borderTop:
                                                    "1px solid var(--border-subtle)",
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
                                                    {r.you}
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
                                                {r.peer}
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
                                                {r.department}
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
                                                {r.national}
                                            </td>
                                            <td
                                                style={{
                                                    padding: "12px 14px",
                                                    textAlign: "right",
                                                }}
                                            >
                                                <Badge
                                                    variant={r.tone}
                                                    size="sm"
                                                    icon={r.good ? "check" : "warning"}
                                                >
                                                    {r.good ? "Au-dessus" : "À combler"}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card
                            padding={20}
                            style={{
                                background: "var(--success-50)",
                                border: "1px solid var(--success-200)",
                            }}
                        >
                            <SubLabel>Vos points forts · à mettre en avant</SubLabel>
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
                                {STRENGTHS.map((t) => (
                                    <li
                                        key={t}
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
                                        {t}
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <Card
                            padding={20}
                            style={{
                                background: "var(--warning-50)",
                                border: "1px solid var(--warning-200)",
                            }}
                        >
                            <SubLabel>Axes d'amélioration prioritaires</SubLabel>
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
                                {IMPROVEMENTS.map((t) => (
                                    <li
                                        key={t}
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
                                        {t}
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <Card
                            padding={16}
                            style={{
                                background: "var(--brand-50)",
                                border: "1px solid var(--brand-200)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 10 }}>
                                <Icon
                                    name="sparkle"
                                    size={18}
                                    color="var(--brand-700)"
                                    style={{ marginTop: 2, flexShrink: 0 }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "var(--brand-900)",
                                        }}
                                    >
                                        Plan d'action recommandé
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: "var(--brand-800)",
                                            margin: "4px 0 0",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        Pour atteindre le{" "}
                                        <strong>top 100 national d'ici 2027</strong>,
                                        l'IA recommande : (1) +30min math/sem, (2) tutorat
                                        pairs P2/P3, (3) club sport mensuel obligatoire.
                                    </p>
                                    <Button
                                        size="sm"
                                        style={{ marginTop: 10 }}
                                        iconRight="arrowRight"
                                        disabled
                                    >
                                        Lancer le plan IA
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

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
        </PageGuard>
    );
}
