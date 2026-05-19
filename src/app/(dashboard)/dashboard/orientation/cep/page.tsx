"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    MetricCard,
    Spinner,
} from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type ClassOption = { id: string; name: string };
type YearOption = { id: string; name: string; isCurrent?: boolean };

type Variant = "success" | "info" | "neutral" | "warning" | "danger";

type StudentRow = {
    studentId: string;
    name: string;
    generalAverage: number | null;
    lecture: number | null;
    calcul: number | null;
    dictee: number | null;
    pronostic: {
        label: string;
        variant: Variant;
        aptForGrade6: boolean;
        needsReinforcement: boolean;
    };
    recommendation: string;
};

type CycleInfo = {
    cycle: string;
    classes: string;
    color: string;
    description: string;
};

type CepData = {
    class: { id: string; name: string; level: string; size: number };
    metrics: {
        candidatesCount: number;
        successRateEstimate: number | null;
        mentionBienProjected: number;
        toReinforce: number;
        decInscriptionsSent: number;
        decInscriptionsTotal: number;
    };
    students: StudentRow[];
    cyclesInfo: CycleInfo[];
};

const FR_NUM = (v: number | null, digits = 1): string =>
    v === null ? "—" : v.toFixed(digits).replace(".", ",");

const FR_INT = (v: number | null): string =>
    v === null ? "—" : Math.round(v).toString();

export default function OrientationCepPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [years, setYears] = useState<YearOption[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [data, setData] = useState<CepData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        try {
            const res = await fetch(
                `/api/orientation/cep?classId=${selectedClass}&academicYearId=${selectedYear}`
            );
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Erreur lors du chargement");
            setData(body);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
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
                            ? `Passage CM2 → 6ᵉ · CEP · ${data.class.name}`
                            : "Passage CM2 → 6ᵉ · CEP"
                    }
                    sub={
                        data
                            ? `${data.class.level} · ${data.class.size} élèves · session juin · cycle primaire MEMP`
                            : "Sélectionne une classe CM2 et l'année académique pour préparer la session CEP."
                    }
                    breadcrumb={
                        data
                            ? ["Pédagogie", "Orientation", `${data.class.name} · CEP`]
                            : undefined
                    }
                    actions={
                        data ? (
                            <>
                                <Button variant="secondary" icon="download">
                                    Liste candidats DEC-MEMP
                                </Button>
                                <Button icon="check">Inscrire au CEP</Button>
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
                            Configurer la session CEP
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
                                label="Classe (CM2)"
                                value={selectedClass}
                                onChange={setSelectedClass}
                                placeholder="Choisir une classe…"
                                options={classes.map((c) => ({
                                    value: c.id,
                                    label: c.name,
                                }))}
                            />
                            <FieldSelect
                                label="Année académique"
                                value={selectedYear}
                                onChange={setSelectedYear}
                                placeholder="Choisir l'année…"
                                options={years.map((y) => ({
                                    value: y.id,
                                    label: y.name,
                                }))}
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
                            Préparation du pronostic CEP…
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
                                Session CEP à préparer
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
                                Choisis une classe CM2 et l'année académique pour voir les pronostics
                                CEP, la projection des mentions et la liste des élèves à renforcer.
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
                            <MetricCard
                                label="Candidats CEP"
                                value={String(data.metrics.candidatesCount)}
                                icon="users"
                                variant="brand"
                            />
                            <MetricCard
                                label="Taux réussite estimé"
                                value={
                                    data.metrics.successRateEstimate !== null
                                        ? String(data.metrics.successRateEstimate)
                                        : "—"
                                }
                                unit={data.metrics.successRateEstimate !== null ? "%" : undefined}
                                icon="check"
                                variant="success"
                            />
                            <MetricCard
                                label='Mention "Bien" projetée'
                                value={String(data.metrics.mentionBienProjected)}
                                icon="trophy"
                                variant="success"
                            />
                            <MetricCard
                                label="À renforcer"
                                value={String(data.metrics.toReinforce)}
                                icon="warning"
                                variant="warning"
                            />
                            <MetricCard
                                label="Inscriptions DEC envoyées"
                                value={`${data.metrics.decInscriptionsSent}/${data.metrics.decInscriptionsTotal}`}
                                icon="check"
                                variant="success"
                            />
                        </div>

                        {/* Cycle primaire info */}
                        <Card padding={20}>
                            <h3
                                className="eduflow-display"
                                style={{ fontSize: 16, margin: "0 0 12px" }}
                            >
                                Le cycle primaire &amp; le CEP
                            </h3>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: 16,
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    lineHeight: 1.55,
                                }}
                                className="cycles-grid"
                            >
                                {data.cyclesInfo.map((c) => (
                                    <div key={c.cycle}>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: `var(--eduflow-${c.color}-700)`,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.08em",
                                                marginBottom: 6,
                                            }}
                                        >
                                            {c.cycle}
                                        </div>
                                        <strong style={{ color: "var(--eduflow-text-primary)" }}>
                                            {c.classes}
                                        </strong>
                                        {" — "}
                                        {c.description}
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Pronostic table */}
                        <Card padding={0}>
                            <div
                                style={{
                                    padding: "14px 18px",
                                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                                }}
                            >
                                <h3
                                    className="eduflow-display"
                                    style={{ fontSize: 16, margin: 0 }}
                                >
                                    Pronostic CEP · {data.class.name}
                                </h3>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        margin: "2px 0 0",
                                    }}
                                >
                                    Lecture / Calcul / Dictée déduits des matières du programme · barème /20
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
                                        <tr
                                            style={{
                                                background:
                                                    "var(--eduflow-surface-sunken)",
                                            }}
                                        >
                                            {[
                                                "Élève",
                                                "Moy. CM2",
                                                "Lecture",
                                                "Calcul",
                                                "Dictée",
                                                "Pronostic CEP",
                                                "Recommandation",
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
                                        {data.students.length === 0 ? (
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
                                                    Aucun élève actif dans cette classe.
                                                </td>
                                            </tr>
                                        ) : (
                                            data.students.map((r) => {
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
                                                        <td style={{ padding: "12px 14px" }}>
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
                                                        <td
                                                            style={{ padding: "12px 14px" }}
                                                            className="tabular"
                                                        >
                                                            {FR_INT(r.lecture)}
                                                        </td>
                                                        <td
                                                            style={{ padding: "12px 14px" }}
                                                            className="tabular"
                                                        >
                                                            {FR_INT(r.calcul)}
                                                        </td>
                                                        <td
                                                            style={{ padding: "12px 14px" }}
                                                            className="tabular"
                                                        >
                                                            {FR_INT(r.dictee)}
                                                        </td>
                                                        <td style={{ padding: "12px 14px" }}>
                                                            <Badge
                                                                variant={r.pronostic.variant}
                                                                size="sm"
                                                            >
                                                                {r.pronostic.label}
                                                            </Badge>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                                fontSize: 11,
                                                                color:
                                                                    "var(--eduflow-text-secondary)",
                                                            }}
                                                        >
                                                            {r.recommendation}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .cycles-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
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
