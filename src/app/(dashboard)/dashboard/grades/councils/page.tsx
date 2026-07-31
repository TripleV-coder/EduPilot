"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
    Spinner,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading } from "@/components/layout/page-states";
import { SubLabel } from "@/components/edu-homes/_shared";

type ClassOption = { id: string; name: string };
type PeriodOption = { id: string; name: string };

type DecisionVariant = "success" | "info" | "neutral" | "warning" | "danger";
type StatusVariant = "success" | "warning" | "neutral";

type StudentRow = {
    studentId: string;
    name: string;
    generalAverage: number | null;
    incidents: number;
    completionRatio: number;
    rank: string | null;
    decision: string;
    decisionVariant: DecisionVariant;
    status: string;
    statusVariant: StatusVariant;
};

type CouncilData = {
    class: { id: string; name: string; level: string; size: number };
    period: { id: string; name: string; sequence: number };
    metrics: {
        bulletinsReady: number;
        bulletinsTotal: number;
        honors: number;
        encouragements: number;
        warnings: number;
    };
    stats: {
        average: number | null;
        median: number | null;
        pctAbove14: number;
        pctBelow10: number;
    };
    participants: { id: string; name: string }[];
    participantsExpected: number;
    nextCouncilEvent: {
        id: string;
        name: string;
        startDate: string;
        endDate: string | null;
        description: string | null;
    } | null;
    pendingDecisions: { studentId: string; name: string; note: string }[];
    students: StudentRow[];
};

type FilterTab = "all" | "honor" | "enc" | "warn";

const FR_NUM = (v: number | null, digits = 1): string =>
    v === null ? "—" : v.toFixed(digits).replace(".", ",");

const FR_PCT = (v: number, digits = 0): string =>
    `${v.toFixed(digits).replace(".", ",")}%`;

const FR_EVENT_DATE = (iso: string): string => {
    try {
        const d = new Date(iso);
        const date = d.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
        });
        const time = d.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
        return `${date} · ${time}`;
    } catch {
        return iso;
    }
};

export default function CouncilsPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [periods, setPeriods] = useState<PeriodOption[]>([]);

    const [selectedClass, setSelectedClass] = useState("");
    const [selectedPeriod, setSelectedPeriod] = useState("");

    const [council, setCouncil] = useState<CouncilData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterTab>("all");

    useEffect(() => {
        const load = async () => {
            try {
                const [clsRes, perRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/periods"),
                ]);
                if (clsRes.ok) {
                    const d = await clsRes.json();
                    setClasses(Array.isArray(d) ? d : d.data || d.classes || []);
                }
                if (perRes.ok) {
                    const d = await perRes.json();
                    setPeriods(Array.isArray(d) ? d : d.data || []);
                }
            } catch {
                setError("Erreur lors du chargement des classes et périodes.");
            }
        };
        load();
    }, []);

    const handleGenerate = async () => {
        if (!selectedClass || !selectedPeriod) return;
        setLoading(true);
        setError(null);
        setCouncil(null);
        setFilter("all");
        try {
            const res = await fetch(
                `/api/grades/councils?classId=${selectedClass}&periodId=${selectedPeriod}`
            );
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.error || "Erreur lors du chargement du conseil");
            setCouncil(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        if (!council) return [];
        if (filter === "all") return council.students;
        if (filter === "honor")
            return council.students.filter((s) => s.decision === "Tableau d'honneur");
        if (filter === "enc")
            return council.students.filter((s) => s.decision === "Encouragements");
        if (filter === "warn")
            return council.students.filter((s) => s.decision.startsWith("Avertissement"));
        return council.students;
    }, [council, filter]);

    const title = council
        ? `Conseil de classe · ${council.class.name}`
        : "Conseil de classe";
    const sub = council?.nextCouncilEvent
        ? `${FR_EVENT_DATE(council.nextCouncilEvent.startDate)} · ${
              council.nextCouncilEvent.description ||
              `${council.participantsExpected} enseignants attendus`
          }`
        : council
        ? `${council.participantsExpected} enseignants attendus · ${council.period.name}`
        : "Sélectionne une classe et une période pour préparer le conseil.";
    const breadcrumbs = council
        ? [
              { label: "Pédagogie" },
              { label: "Conseils de classe", href: "/dashboard/grades/councils" },
              { label: `${council.class.name} · ${council.period.name}` },
          ]
        : [
              { label: "Pédagogie", href: "/dashboard/grades" },
              { label: "Conseils de classe" },
          ];

    return (
        <PageGuard
            permission={Permission.EVALUATION_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <PageShell className="max-w-6xl pb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/grades">
                        <Button variant="secondary" size="sm">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Retour
                            </span>
                        </Button>
                    </Link>
                </div>

                <PageHeader
                    title={title}
                    description={sub}
                    breadcrumbs={breadcrumbs}
                    actions={
                        council ? (
                            <>
                                <Button variant="secondary" icon="download">
                                    Bulletins ZIP
                                </Button>
                                <Button icon="check">Clôturer le conseil</Button>
                            </>
                        ) : null
                    }
                />

                {/* Selector */}
                <Card padding={0} style={{ display: "block" }}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="cards" size={18} color="var(--brand-700)" />
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            Configurer le conseil
                        </h3>
                    </div>
                    <div className="px-5 py-5">
                        <div
                            className="grid items-end gap-3"
                            style={{
                                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) auto",
                            }}
                        >
                            <FieldSelect
                                label="Classe"
                                value={selectedClass}
                                onChange={setSelectedClass}
                                placeholder="Choisir une classe…"
                                options={classes.map((c) => ({ value: c.id, label: c.name }))}
                            />
                            <FieldSelect
                                label="Période"
                                value={selectedPeriod}
                                onChange={setSelectedPeriod}
                                placeholder="Choisir la période…"
                                options={periods.map((p) => ({ value: p.id, label: p.name }))}
                            />
                            <Button
                                icon={loading ? undefined : "cards"}
                                loading={loading}
                                onClick={handleGenerate}
                                disabled={!selectedClass || !selectedPeriod || loading}
                            >
                                Préparer
                            </Button>
                        </div>
                    </div>
                </Card>

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

                {!council && !loading ? (
                    <Card padding={36}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div
                                className="grid place-items-center"
                                style={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 16,
                                    background: "var(--brand-50)",
                                }}
                            >
                                <Icon name="cards" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Aucun conseil préparé
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    maxWidth: 480,
                                    lineHeight: 1.55,
                                    margin: 0,
                                }}
                            >
                                Choisis une classe et une période, puis clique « Préparer » pour
                                consulter les moyennes, les rangs et les décisions automatiques.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {loading ? (
                    <PageLoading label="Calcul du conseil de classe…" />
                ) : null}

                {council ? (
                    <>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: 12,
                            }}
                        >
                            <MetricCard
                                label="Bulletins prêts"
                                value={`${council.metrics.bulletinsReady}/${council.metrics.bulletinsTotal}`}
                                icon="cards"
                                variant="brand"
                            />
                            <MetricCard
                                label="Tableau d'honneur"
                                value={String(council.metrics.honors)}
                                icon="trophy"
                                variant="success"
                            />
                            <MetricCard
                                label="Encouragements"
                                value={String(council.metrics.encouragements)}
                                icon="sparkle"
                                variant="info"
                            />
                            <MetricCard
                                label="Avertissements"
                                value={String(council.metrics.warnings)}
                                icon="warning"
                                variant="warning"
                            />
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.6fr 1fr",
                                gap: 14,
                            }}
                            className="council-grid"
                        >
                            <Card padding={0}>
                                <div
                                    style={{
                                        padding: "12px 18px",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                                    }}
                                >
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Élèves · validation bulletins
                                    </h3>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <Chip
                                            active={filter === "all"}
                                            onClick={() => setFilter("all")}
                                        >
                                            Tous
                                        </Chip>
                                        <Chip
                                            active={filter === "honor"}
                                            count={council.metrics.honors}
                                            onClick={() => setFilter("honor")}
                                        >
                                            Honneur
                                        </Chip>
                                        <Chip
                                            active={filter === "enc"}
                                            count={council.metrics.encouragements}
                                            onClick={() => setFilter("enc")}
                                        >
                                            Encour.
                                        </Chip>
                                        <Chip
                                            active={filter === "warn"}
                                            count={council.metrics.warnings}
                                            onClick={() => setFilter("warn")}
                                        >
                                            Avert.
                                        </Chip>
                                    </div>
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
                                            <tr
                                                style={{
                                                    background: "var(--eduflow-surface-sunken)",
                                                }}
                                            >
                                                {["Élève", "Moy.", "Rang", "Décision", "Statut"].map(
                                                    (h) => (
                                                        <th
                                                            key={h}
                                                            style={{
                                                                padding: "8px 14px",
                                                                textAlign: "left",
                                                                fontSize: 10,
                                                                fontWeight: 700,
                                                                letterSpacing: "0.06em",
                                                                textTransform: "uppercase",
                                                                color:
                                                                    "var(--eduflow-text-tertiary)",
                                                            }}
                                                        >
                                                            {h}
                                                        </th>
                                                    )
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        style={{
                                                            padding: "24px 14px",
                                                            textAlign: "center",
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        Aucun élève ne correspond à ce filtre.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filtered.map((r) => {
                                                    const avgColor =
                                                        r.generalAverage === null
                                                            ? "var(--eduflow-text-tertiary)"
                                                            : r.generalAverage >= 14
                                                            ? "var(--eduflow-success-700)"
                                                            : r.generalAverage < 10
                                                            ? "var(--eduflow-danger-700)"
                                                            : "var(--eduflow-text-primary)";
                                                    return (
                                                        <tr
                                                            key={r.studentId}
                                                            style={{
                                                                borderTop:
                                                                    "1px solid var(--eduflow-border-subtle)",
                                                            }}
                                                        >
                                                            <td
                                                                style={{
                                                                    padding: "12px 14px",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: 10,
                                                                    }}
                                                                >
                                                                    <Avatar
                                                                        name={r.name}
                                                                        size="sm"
                                                                    />
                                                                    <span
                                                                        style={{
                                                                            fontSize: 13,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {r.name}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td
                                                                style={{
                                                                    padding: "12px 14px",
                                                                }}
                                                            >
                                                                <span
                                                                    className="eduflow-display tabular"
                                                                    style={{
                                                                        fontSize: 14,
                                                                        fontWeight: 700,
                                                                        color: avgColor,
                                                                        fontVariantNumeric:
                                                                            "tabular-nums",
                                                                    }}
                                                                >
                                                                    {FR_NUM(r.generalAverage)}
                                                                </span>
                                                            </td>
                                                            <td
                                                                style={{
                                                                    padding: "12px 14px",
                                                                    fontSize: 13,
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                {r.rank ?? "—"}
                                                            </td>
                                                            <td
                                                                style={{
                                                                    padding: "12px 14px",
                                                                }}
                                                            >
                                                                <Badge
                                                                    variant={r.decisionVariant}
                                                                    size="sm"
                                                                >
                                                                    {r.decision}
                                                                </Badge>
                                                            </td>
                                                            <td
                                                                style={{
                                                                    padding: "12px 14px",
                                                                }}
                                                            >
                                                                {r.statusVariant === "success" ? (
                                                                    <Badge
                                                                        variant="success"
                                                                        size="sm"
                                                                        icon="check"
                                                                    >
                                                                        {r.status}
                                                                    </Badge>
                                                                ) : r.statusVariant ===
                                                                  "warning" ? (
                                                                    <Badge
                                                                        variant="warning"
                                                                        size="sm"
                                                                        dot
                                                                    >
                                                                        {r.status}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge
                                                                        variant="neutral"
                                                                        size="sm"
                                                                    >
                                                                        {r.status}
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <Card>
                                    <SubLabel>
                                        Participants ·{" "}
                                        {`${council.participants.length} / ${council.participantsExpected} confirmés`}
                                    </SubLabel>
                                    <div
                                        style={{
                                            display: "flex",
                                            marginTop: 8,
                                            flexWrap: "wrap",
                                            gap: 0,
                                        }}
                                    >
                                        {council.participants.length === 0 ? (
                                            <p
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                    margin: 0,
                                                }}
                                            >
                                                Aucun enseignant rattaché à cette classe.
                                            </p>
                                        ) : (
                                            council.participants.slice(0, 12).map((p, i) => (
                                                <div
                                                    key={p.id}
                                                    title={p.name}
                                                    style={{
                                                        marginLeft: i ? -8 : 0,
                                                        boxShadow:
                                                            "0 0 0 2px var(--eduflow-surface-card)",
                                                        borderRadius: "50%",
                                                    }}
                                                >
                                                    <Avatar
                                                        name={p.name}
                                                        size="sm"
                                                        status={i < 6 ? "online" : "away"}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {council.participants.length > 12 ? (
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                marginTop: 10,
                                            }}
                                        >
                                            +{council.participants.length - 12} autres
                                        </div>
                                    ) : null}
                                </Card>

                                <Card>
                                    <SubLabel>
                                        Statistiques classe · {council.period.name}
                                    </SubLabel>
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(2, 1fr)",
                                            gap: 12,
                                            marginTop: 8,
                                        }}
                                    >
                                        <StatTile
                                            label="Moyenne"
                                            value={FR_NUM(council.stats.average)}
                                            tone="brand"
                                        />
                                        <StatTile
                                            label="Médiane"
                                            value={FR_NUM(council.stats.median)}
                                            tone="info"
                                        />
                                        <StatTile
                                            label="% ≥ 14"
                                            value={FR_PCT(council.stats.pctAbove14)}
                                            tone="success"
                                        />
                                        <StatTile
                                            label="% < 10"
                                            value={FR_PCT(council.stats.pctBelow10)}
                                            tone="warning"
                                        />
                                    </div>
                                </Card>

                                <Card>
                                    <SubLabel>
                                        Décisions en attente ·{" "}
                                        {council.pendingDecisions.length}
                                    </SubLabel>
                                    <div
                                        style={{
                                            marginTop: 8,
                                            fontSize: 12,
                                            color: "var(--eduflow-text-secondary)",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        {council.pendingDecisions.length === 0 ? (
                                            <span
                                                style={{
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                Toutes les décisions sont prises.
                                            </span>
                                        ) : (
                                            council.pendingDecisions.slice(0, 5).map((p, i) => (
                                                <div
                                                    key={p.studentId}
                                                    style={{
                                                        padding: "8px 0",
                                                        borderBottom:
                                                            i ===
                                                            Math.min(
                                                                council.pendingDecisions.length,
                                                                5
                                                            ) -
                                                                1
                                                                ? "none"
                                                                : "1px solid var(--eduflow-border-subtle)",
                                                    }}
                                                >
                                                    <strong>{p.name}</strong> · {p.note}
                                                </div>
                                            ))
                                        )}
                                        {council.pendingDecisions.length > 5 ? (
                                            <div
                                                style={{
                                                    marginTop: 6,
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                +{council.pendingDecisions.length - 5} autres en
                                                attente
                                            </div>
                                        ) : null}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </>
                ) : null}
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .council-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function StatTile({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: "brand" | "info" | "success" | "warning";
}) {
    const bg = `var(--eduflow-${tone}-50)`;
    const fg = `var(--eduflow-${tone}-800)`;
    return (
        <div style={{ padding: 10, background: bg, borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: fg, fontWeight: 600 }}>{label}</div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: fg,
                    marginTop: 2,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
        </div>
    );
}

function FieldSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
    disabled,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: value ? 600 : 500,
                    color: value
                        ? "var(--eduflow-text-primary)"
                        : "var(--eduflow-text-tertiary)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.55 : 1,
                    outline: "none",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
