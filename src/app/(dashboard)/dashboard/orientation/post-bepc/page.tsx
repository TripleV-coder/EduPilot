"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { CycleGuard } from "@/components/guard/cycle-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Chip,
    Icon,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type ClassOption = { id: string; name: string };
type YearOption = { id: string; name: string; isCurrent?: boolean };

type StudentRow = {
    studentId: string;
    name: string;
    generalAverage: number | null;
    bepcAverage: number | null;
    aiSeries: string | null;
    familyWish: string | null;
    councilDecision: string | null;
    state: "ok" | "arbitrage" | "conflict";
    orientationId: string | null;
    hasAi: boolean;
};

type DistributionRow = {
    family: string;
    label: string;
    color: string;
    count: number;
    pct: number;
};

type CouncilData = {
    class: { id: string; name: string; level: string; size: number };
    metrics: {
        totalToOrient: number;
        decisionsSaved: number;
        inArbitration: number;
        conflicts: number;
        aiReady: number;
    };
    students: StudentRow[];
    distribution: DistributionRow[];
    topConflict: StudentRow | null;
};

type Filter = "all" | "arbitrage" | "conflict";

const SERIES_COLOR: Record<string, string> = {
    A1: "brand",
    A2: "brand",
    B: "brand",
    C: "info",
    D: "success",
    E: "info",
    F1: "warning",
    F2: "warning",
    F3: "warning",
    F4: "warning",
    G1: "warning",
    G2: "warning",
    G3: "warning",
    DT: "danger",
};

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

function seriesVariant(s: string | null | undefined): BadgeVariant {
    if (!s) return "neutral";
    return (SERIES_COLOR[s] as BadgeVariant) ?? "neutral";
}

const SERIES_BJ: Record<
    string,
    { fam: string; t: string; c: BadgeVariant; bac: string; dom: string }
> = {
    A1: {
        fam: "A",
        t: "Lettres-Langues",
        c: "brand",
        bac: "Littéraire",
        dom: "Français, langues vivantes, philo",
    },
    A2: {
        fam: "A",
        t: "Lettres-Sciences humaines",
        c: "brand",
        bac: "Littéraire",
        dom: "Histoire-géo, philo, langues",
    },
    B: {
        fam: "B",
        t: "Lettres-Sciences sociales",
        c: "brand",
        bac: "Littéraire",
        dom: "Économie, sociologie, philo",
    },
    C: {
        fam: "C",
        t: "Sciences & Mathématiques",
        c: "info",
        bac: "Scientifique",
        dom: "Maths, physique-chimie, sciences ingénieur",
    },
    D: {
        fam: "D",
        t: "Biologie-Géologie",
        c: "success",
        bac: "Scientifique",
        dom: "SVT, physique-chimie, maths",
    },
    E: {
        fam: "E",
        t: "Mathématiques & Techniques",
        c: "info",
        bac: "Sci. & Technique",
        dom: "Maths, sciences techniques industrielles",
    },
    F: {
        fam: "F",
        t: "Techniques industrielles",
        c: "warning",
        bac: "Sci. & Technique",
        dom: "F1 méca · F2 électro · F3 électrotech. · F4 génie civil",
    },
    G: {
        fam: "G",
        t: "Techniques tertiaires",
        c: "warning",
        bac: "Tech. & Commercial",
        dom: "G1 admin · G2 gestion · G3 commerce",
    },
    DT: {
        fam: "DT",
        t: "Diplôme de Technicien",
        c: "danger",
        bac: "Diplôme professionnel",
        dom: "Filières pro (mode, BTP, info, eau, hôtellerie…)",
    },
};

const FR_NUM = (v: number | null, digits = 1): string =>
    v === null ? "—" : v.toFixed(digits).replace(".", ",");

export default function OrientationPostBepcPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [years, setYears] = useState<YearOption[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [data, setData] = useState<CouncilData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("all");

    useEffect(() => {
        const load = async () => {
            try {
                const [clsRes, yrsRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/academic-years"),
                ]);
                if (clsRes.ok) {
                    const d = await clsRes.json();
                    setClasses(Array.isArray(d) ? d : d.data || d.classes || []);
                }
                if (yrsRes.ok) {
                    const d = await yrsRes.json();
                    const list: YearOption[] = Array.isArray(d)
                        ? d
                        : d.data || d.academicYears || [];
                    setYears(list);
                    const current = list.find((y) => y.isCurrent) ?? list[0];
                    if (current) setSelectedYear(current.id);
                }
            } catch {
                setError("Erreur lors du chargement des classes et années.");
            }
        };
        load();
    }, []);

    const handleGenerate = async () => {
        if (!selectedClass || !selectedYear) return;
        setLoading(true);
        setError(null);
        setData(null);
        setFilter("all");
        try {
            const res = await fetch(
                `/api/orientation/council?classId=${selectedClass}&academicYearId=${selectedYear}`
            );
            const body = await res.json();
            if (!res.ok)
                throw new Error(body.error || "Erreur lors du chargement");
            setData(body);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    const handleBatchAi = async () => {
        if (!selectedClass || !selectedYear) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/orientation/batch-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: selectedClass,
                    academicYearId: selectedYear,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(
                    body.error || "Erreur lors de la génération IA en lot"
                );
            }
            await handleGenerate();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        if (!data) return [];
        if (filter === "all") return data.students;
        return data.students.filter((s) => s.state === filter);
    }, [data, filter]);

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <CycleGuard requires="SECONDARY_COLLEGE">
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/orientation">
                        <Button variant="secondary" size="sm">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Retour orientation
                            </span>
                        </Button>
                    </Link>
                </div>

                <PageHeader
                    greeting={
                        data
                            ? `Orientation post-BEPC · ${data.class.name}`
                            : "Orientation post-BEPC"
                    }
                    sub={
                        data
                            ? `${data.class.level} · ${data.class.size} élèves · conseil d'orientation`
                            : "Sélectionne une classe et l'année académique pour préparer les affectations."
                    }
                    breadcrumb={
                        data
                            ? [
                                  "Pédagogie",
                                  "Orientation",
                                  `${data.class.name} · post-BEPC`,
                              ]
                            : undefined
                    }
                    actions={
                        data ? (
                            <>
                                <Button
                                    variant="secondary"
                                    icon="sparkle"
                                    onClick={handleBatchAi}
                                    loading={loading}
                                >
                                    Recalculer suggestions IA
                                </Button>
                                <Button variant="secondary" icon="download">
                                    Fiches DOB / MEMP
                                </Button>
                                <Button icon="check">Clôturer affectations</Button>
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
                        <Icon name="school" size={18} color="var(--brand-700)" />
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            Configurer le conseil d'orientation
                        </h3>
                    </div>
                    <div className="px-5 py-5">
                        <div
                            className="grid items-end gap-3"
                            style={{
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(180px, 1fr)) auto",
                            }}
                        >
                            <FieldSelect
                                label="Classe (3ᵉ)"
                                value={selectedClass}
                                onChange={setSelectedClass}
                                placeholder="Choisir une classe…"
                                options={classes.map((c) => ({ value: c.id, label: c.name }))}
                            />
                            <FieldSelect
                                label="Année académique"
                                value={selectedYear}
                                onChange={setSelectedYear}
                                placeholder="Choisir l'année…"
                                options={years.map((y) => ({ value: y.id, label: y.name }))}
                            />
                            <Button
                                icon={loading ? undefined : "cards"}
                                loading={loading}
                                onClick={handleGenerate}
                                disabled={!selectedClass || !selectedYear || loading}
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

                {loading && !data ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Préparation du conseil d'orientation…
                        </span>
                    </div>
                ) : null}

                {!data && !loading ? (
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
                                <Icon name="school" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Conseil d'orientation à préparer
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
                                Choisis une classe de 3ᵉ et l'année académique, puis « Préparer »
                                pour voir les moyennes, les profils IA et les vœux famille pour
                                chaque élève.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {data ? (
                    <>
                        {/* KPIs */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(5, 1fr)",
                                gap: 12,
                            }}
                            className="kpi-grid"
                        >
                            <Kpi label="À orienter" value={String(data.metrics.totalToOrient)} tone="brand" />
                            <Kpi
                                label="Décisions saisies"
                                value={String(data.metrics.decisionsSaved)}
                                tone="success"
                            />
                            <Kpi
                                label="En arbitrage"
                                value={String(data.metrics.inArbitration)}
                                tone="warning"
                            />
                            <Kpi
                                label="Désaccord famille/jury"
                                value={String(data.metrics.conflicts)}
                                tone="danger"
                            />
                            <Kpi
                                label="IA suggestions prêtes"
                                value={`${data.metrics.aiReady}/${data.metrics.totalToOrient}`}
                                tone="brand"
                            />
                        </div>

                        <SeriesLegend />

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.6fr 1fr",
                                gap: 14,
                            }}
                            className="orient-grid"
                        >
                            <Card padding={0}>
                                <div
                                    style={{
                                        padding: "14px 18px",
                                        borderBottom:
                                            "1px solid var(--eduflow-border-subtle)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 8,
                                    }}
                                >
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Décisions d'orientation · {data.class.name}
                                    </h3>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <Chip
                                            active={filter === "all"}
                                            onClick={() => setFilter("all")}
                                        >
                                            Tous
                                        </Chip>
                                        <Chip
                                            active={filter === "arbitrage"}
                                            count={data.metrics.inArbitration}
                                            onClick={() => setFilter("arbitrage")}
                                        >
                                            Arbitrage
                                        </Chip>
                                        <Chip
                                            active={filter === "conflict"}
                                            count={data.metrics.conflicts}
                                            onClick={() => setFilter("conflict")}
                                        >
                                            Désaccord
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
                                                    background:
                                                        "var(--eduflow-surface-sunken)",
                                                }}
                                            >
                                                {[
                                                    "Élève",
                                                    "Moy. générale",
                                                    "BEPC blanc",
                                                    "Profil IA",
                                                    "1ᵉʳ vœu famille",
                                                    "Reco. conseil",
                                                    "État",
                                                ].map((h) => (
                                                    <th
                                                        key={h}
                                                        style={{
                                                            padding: "10px 14px",
                                                            textAlign: "left",
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                            letterSpacing: "0.06em",
                                                            textTransform: "uppercase",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={7}
                                                        style={{
                                                            padding: "24px 14px",
                                                            textAlign: "center",
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        Aucun élève dans ce filtre.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filtered.map((r) => {
                                                    const avgColor =
                                                        r.generalAverage === null
                                                            ? "var(--eduflow-text-tertiary)"
                                                            : r.generalAverage >= 14
                                                            ? "var(--eduflow-success-700)"
                                                            : r.generalAverage < 12
                                                            ? "var(--eduflow-warning-700)"
                                                            : "var(--eduflow-text-primary)";
                                                    return (
                                                        <tr
                                                            key={r.studentId}
                                                            style={{
                                                                borderTop:
                                                                    "1px solid var(--eduflow-border-subtle)",
                                                            }}
                                                        >
                                                            <td style={{ padding: "12px 14px" }}>
                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: 10,
                                                                    }}
                                                                >
                                                                    <Avatar name={r.name} size="sm" />
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
                                                            <td style={{ padding: "12px 14px" }}>
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
                                                            <td style={{ padding: "12px 14px" }}>
                                                                <span
                                                                    className="tabular"
                                                                    style={{
                                                                        fontSize: 12,
                                                                        fontWeight: 600,
                                                                        color:
                                                                            "var(--eduflow-text-secondary)",
                                                                        fontVariantNumeric:
                                                                            "tabular-nums",
                                                                    }}
                                                                >
                                                                    {FR_NUM(r.bepcAverage)}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: "12px 14px" }}>
                                                                {r.aiSeries ? (
                                                                    <Badge
                                                                        variant={seriesVariant(
                                                                            r.aiSeries
                                                                        )}
                                                                        size="sm"
                                                                        icon="sparkle"
                                                                    >
                                                                        {r.aiSeries}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge
                                                                        variant="neutral"
                                                                        size="sm"
                                                                    >
                                                                        —
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: "12px 14px" }}>
                                                                {r.familyWish ? (
                                                                    <Badge
                                                                        variant={seriesVariant(
                                                                            r.familyWish
                                                                        )}
                                                                        size="sm"
                                                                    >
                                                                        {r.familyWish}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge
                                                                        variant="neutral"
                                                                        size="sm"
                                                                    >
                                                                        —
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: "12px 14px" }}>
                                                                {r.councilDecision ? (
                                                                    <Badge
                                                                        variant={seriesVariant(
                                                                            r.councilDecision
                                                                        )}
                                                                        size="sm"
                                                                    >
                                                                        {r.councilDecision}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge
                                                                        variant="neutral"
                                                                        size="sm"
                                                                    >
                                                                        À décider
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: "12px 14px" }}>
                                                                {r.state === "ok" ? (
                                                                    <Badge
                                                                        variant="success"
                                                                        size="sm"
                                                                        icon="check"
                                                                    >
                                                                        Validé
                                                                    </Badge>
                                                                ) : r.state === "arbitrage" ? (
                                                                    <Badge
                                                                        variant="warning"
                                                                        size="sm"
                                                                        dot
                                                                    >
                                                                        Arbitrage
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge
                                                                        variant="danger"
                                                                        size="sm"
                                                                        dot
                                                                    >
                                                                        Désaccord
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

                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 14,
                                }}
                            >
                                <Card>
                                    <SubLabel>
                                        Répartition prévue · {data.class.size} élèves
                                    </SubLabel>
                                    <div
                                        style={{
                                            marginTop: 12,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                        }}
                                    >
                                        {data.distribution.map((d) => (
                                            <div key={d.family}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        marginBottom: 3,
                                                    }}
                                                >
                                                    <span
                                                        style={{ fontSize: 11, fontWeight: 500 }}
                                                    >
                                                        {d.label}
                                                    </span>
                                                    <span
                                                        className="tabular"
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            color: `var(--eduflow-${d.color}-700)`,
                                                            fontVariantNumeric: "tabular-nums",
                                                        }}
                                                    >
                                                        {d.count} ({d.pct}%)
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        height: 5,
                                                        background:
                                                            "var(--eduflow-neutral-200)",
                                                        borderRadius: 2.5,
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: "100%",
                                                            width: `${d.pct}%`,
                                                            background: `var(--eduflow-${d.color}-600)`,
                                                            transition:
                                                                "width var(--motion-base, 280ms) var(--ease-out, ease)",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {data.topConflict ? (
                                    <Card
                                        style={{
                                            background:
                                                "linear-gradient(135deg, var(--brand-800), var(--accent-600, #4F46E5))",
                                            color: "#fff",
                                            border: 0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                letterSpacing: "0.12em",
                                                textTransform: "uppercase",
                                                opacity: 0.85,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <Icon name="sparkle" size={12} />
                                            Désaccord à discuter
                                        </div>
                                        <div
                                            className="eduflow-display"
                                            style={{
                                                fontSize: 18,
                                                fontWeight: 700,
                                                lineHeight: 1.3,
                                            }}
                                        >
                                            {data.topConflict.name} · vœu{" "}
                                            {data.topConflict.familyWish}, IA recommande{" "}
                                            {data.topConflict.aiSeries}
                                        </div>
                                        <p
                                            style={{
                                                fontSize: 12,
                                                opacity: 0.85,
                                                lineHeight: 1.6,
                                                marginTop: 8,
                                            }}
                                        >
                                            Moyenne {FR_NUM(data.topConflict.generalAverage)}/20
                                            {data.topConflict.bepcAverage !== null
                                                ? ` · BEPC blanc ${FR_NUM(
                                                      data.topConflict.bepcAverage
                                                  )}`
                                                : ""}
                                            . L'écart entre le vœu famille et la suggestion IA
                                            mérite un échange avant la décision finale.
                                        </p>
                                        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
                                            <Link
                                                href={`/dashboard/students/${data.topConflict.studentId}`}
                                                style={{ textDecoration: "none" }}
                                            >
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    style={{
                                                        background: "#fff",
                                                        color: "var(--brand-700)",
                                                    }}
                                                >
                                                    Ouvrir le dossier
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                style={{
                                                    color: "#fff",
                                                    border:
                                                        "1px solid rgba(255,255,255,0.3)",
                                                }}
                                            >
                                                Programmer un RDV
                                            </Button>
                                        </div>
                                    </Card>
                                ) : null}

                                <Card>
                                    <SubLabel>Critères DOB · barème pondéré</SubLabel>
                                    <div
                                        style={{
                                            marginTop: 8,
                                            fontSize: 12,
                                            color: "var(--eduflow-text-secondary)",
                                            lineHeight: 1.7,
                                        }}
                                    >
                                        • <strong>40%</strong> · moyenne pondérée des matières
                                        dominantes (T1+T2+T3)
                                        <br />
                                        • <strong>20%</strong> · BEPC blanc (mars)
                                        <br />
                                        • <strong>15%</strong> · vœux famille (1ᵉʳ · 2ᵉ · 3ᵉ)
                                        <br />
                                        • <strong>15%</strong> · capacité d'accueil par série
                                        <br />
                                        • <strong>10%</strong> · avis du conseil de classe
                                    </div>
                                </Card>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .orient-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
            `}</style>
            </CycleGuard>
        </PageGuard>
    );
}

function Kpi({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: "brand" | "success" | "warning" | "danger" | "info";
}) {
    return (
        <Card padding={14}>
            <div
                style={{
                    fontSize: 10,
                    color: "var(--eduflow-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: `var(--eduflow-${tone}-700)`,
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
        </Card>
    );
}

function SeriesLegend() {
    return (
        <Card padding={20}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    marginBottom: 16,
                    flexWrap: "wrap",
                    gap: 8,
                }}
            >
                <div>
                    <h3
                        className="eduflow-display"
                        style={{
                            fontSize: 18,
                            margin: 0,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        Séries du système béninois
                    </h3>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--eduflow-text-tertiary)",
                            margin: "4px 0 0",
                        }}
                    >
                        3 bacs · 11 séries + DT (Diplôme de Technicien) — source DOB / MEMP
                    </p>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, flexWrap: "wrap" }}>
                    {[
                        { l: "Littéraire", c: "brand" },
                        { l: "Scientifique", c: "info" },
                        { l: "Sci. & Tech.", c: "warning" },
                        { l: "Tech. & Comm.", c: "warning" },
                        { l: "Pro / DT", c: "danger" },
                    ].map((b) => (
                        <span
                            key={b.l}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    background: `var(--eduflow-${b.c}-500)`,
                                }}
                            />
                            {b.l}
                        </span>
                    ))}
                </div>
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 14,
                }}
                className="series-legend-grid"
            >
                {Object.entries(SERIES_BJ).map(([k, s]) => (
                    <div
                        key={k}
                        style={{
                            padding: 14,
                            borderRadius: 12,
                            background: `var(--eduflow-${s.c}-50)`,
                            borderLeft: `3px solid var(--eduflow-${s.c}-600)`,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span
                                className="eduflow-display"
                                style={{
                                    fontSize: 22,
                                    fontWeight: 800,
                                    color: `var(--eduflow-${s.c}-800)`,
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {k === "DT" ? "DT" : `Série ${k}`}
                            </span>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: `var(--eduflow-${s.c}-800)`,
                                }}
                            >
                                · {s.t}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 6,
                                lineHeight: 1.5,
                            }}
                        >
                            {s.dom}
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--eduflow-text-tertiary)",
                                marginTop: 6,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            Bac {s.bac}
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                @media (max-width: 760px) {
                    .series-legend-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
                @media (max-width: 520px) {
                    .series-legend-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </Card>
    );
}

function FieldSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
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
                    cursor: "pointer",
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
