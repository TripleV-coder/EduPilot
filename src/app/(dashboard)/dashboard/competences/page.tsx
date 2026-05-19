"use client";

import { useEffect, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Button,
    Card,
    Icon,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type ClassOption = { id: string; name: string };
type SubjectOption = { id: string; name: string };

type CompetenceId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";

type CompetencesData = {
    class: { id: string; name: string; level: string; size: number };
    subject: { id: string; name: string } | null;
    competences: { id: CompetenceId; label: string }[];
    matrix: Record<CompetenceId, { A: number; EC: number; NA: number; NE: number }>;
    insights: {
        strong: CompetenceId[];
        toReinforce: CompetenceId[];
        critical: CompetenceId[];
    };
};

const STATUS_META = {
    A: { label: "Acquis", color: "success" },
    EC: { label: "En cours d'acquisition", color: "warning" },
    NA: { label: "Non acquis", color: "danger" },
    NE: { label: "Non évalué", color: "neutral" },
} as const;

export default function CompetencesPage() {
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [subjects, setSubjects] = useState<SubjectOption[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [data, setData] = useState<CompetencesData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [clsRes, subRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/admin/subjects").catch(() => null),
                ]);
                if (clsRes.ok) {
                    const d = await clsRes.json();
                    setClasses(Array.isArray(d) ? d : d.data || d.classes || []);
                }
                if (subRes && subRes.ok) {
                    const d = await subRes.json();
                    setSubjects(Array.isArray(d) ? d : d.data || d.subjects || []);
                }
            } catch {
                /* selectors are non-blocking */
            }
        };
        load();
    }, []);

    const handleGenerate = async () => {
        if (!selectedClass) return;
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const params = new URLSearchParams({ classId: selectedClass });
            if (selectedSubject) params.set("subjectId", selectedSubject);
            const res = await fetch(`/api/competences?${params.toString()}`);
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Erreur");
            setData(body);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    const totalForRow = (id: CompetenceId): number => {
        if (!data) return 1;
        const r = data.matrix[id];
        return Math.max(1, r.A + r.EC + r.NA + r.NE);
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Évaluations par compétences"
                    sub={
                        data
                            ? `${data.class.name} · ${data.subject?.name ?? "toutes matières"} · grille MEMP`
                            : "Suivi MEMP par compétence — classe et matière au choix"
                    }
                    breadcrumb={["Pédagogie", "Compétences"]}
                    actions={
                        data ? (
                            <>
                                <Button variant="secondary" icon="download">
                                    Bilan PDF
                                </Button>
                                <Button icon="plus">Évaluer</Button>
                            </>
                        ) : null
                    }
                />

                <Card padding={0} style={{ display: "block" }}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="cards" size={18} color="var(--brand-700)" />
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            Configurer la grille
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
                                label="Classe"
                                value={selectedClass}
                                onChange={setSelectedClass}
                                placeholder="Choisir une classe…"
                                options={classes.map((c) => ({
                                    value: c.id,
                                    label: c.name,
                                }))}
                            />
                            <FieldSelect
                                label="Matière (optionnel)"
                                value={selectedSubject}
                                onChange={setSelectedSubject}
                                placeholder="Toutes matières"
                                options={subjects.map((s) => ({
                                    value: s.id,
                                    label: s.name,
                                }))}
                            />
                            <Button
                                icon={loading ? undefined : "cards"}
                                loading={loading}
                                onClick={handleGenerate}
                                disabled={!selectedClass || loading}
                            >
                                Calculer
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
                            Calcul de la grille MEMP…
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
                                <Icon name="cards" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Grille MEMP à calculer
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
                                Choisis une classe (et éventuellement une matière) pour ventiler les
                                évaluations existantes sur les 6 compétences MEMP (C1 → C6) selon le
                                titre de chaque évaluation.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {data ? (
                    <>
                        <Card padding={0} style={{ overflow: "hidden" }}>
                            <div style={{ overflowX: "auto" }}>
                                <table
                                    style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        fontSize: 12,
                                    }}
                                >
                                    <thead>
                                        <tr>
                                            <th
                                                style={{
                                                    padding: "12px 18px",
                                                    textAlign: "left",
                                                    background:
                                                        "var(--eduflow-surface-sunken)",
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    letterSpacing: "0.06em",
                                                    textTransform: "uppercase",
                                                    color:
                                                        "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                Compétence
                                            </th>
                                            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map(
                                                (k) => (
                                                    <th
                                                        key={k}
                                                        style={{
                                                            padding: "12px 14px",
                                                            background:
                                                                "var(--eduflow-surface-sunken)",
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            letterSpacing: "0.06em",
                                                            textTransform: "uppercase",
                                                            color: `var(--eduflow-${STATUS_META[k].color}-700)`,
                                                            textAlign: "center",
                                                            borderLeft:
                                                                "1px solid var(--eduflow-border-subtle)",
                                                        }}
                                                    >
                                                        {STATUS_META[k].label}
                                                    </th>
                                                )
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.competences.map((c) => (
                                            <tr key={c.id}>
                                                <td
                                                    style={{
                                                        padding: "14px 18px",
                                                        borderTop:
                                                            "1px solid var(--eduflow-border-subtle)",
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {c.label}
                                                </td>
                                                {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map(
                                                    (k) => {
                                                        const n = data.matrix[c.id][k];
                                                        const total = totalForRow(c.id);
                                                        const intensity = Math.min(
                                                            1,
                                                            n / total
                                                        );
                                                        const tone = STATUS_META[k].color;
                                                        return (
                                                            <td
                                                                key={k}
                                                                style={{
                                                                    padding: "14px 14px",
                                                                    borderTop:
                                                                        "1px solid var(--eduflow-border-subtle)",
                                                                    borderLeft:
                                                                        "1px solid var(--eduflow-border-subtle)",
                                                                    textAlign: "center",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        display:
                                                                            "inline-flex",
                                                                        alignItems:
                                                                            "center",
                                                                        justifyContent:
                                                                            "center",
                                                                        width: 44,
                                                                        height: 44,
                                                                        borderRadius: 12,
                                                                        background: `color-mix(in oklch, var(--eduflow-${tone}-100), white ${
                                                                            (1 -
                                                                                intensity) *
                                                                            100
                                                                        }%)`,
                                                                        color: `var(--eduflow-${tone}-800)`,
                                                                        border: `1px solid var(--eduflow-${tone}-200)`,
                                                                        fontVariantNumeric:
                                                                            "tabular-nums",
                                                                        fontSize: 18,
                                                                        fontWeight: 700,
                                                                    }}
                                                                >
                                                                    {n}
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: 14,
                            }}
                            className="insight-grid"
                        >
                            <Card>
                                <SubLabel>Compétences solides (&gt;70% acquis)</SubLabel>
                                <div
                                    style={{
                                        marginTop: 8,
                                        fontSize: 13,
                                        color: "var(--eduflow-success-700)",
                                        fontWeight: 600,
                                    }}
                                >
                                    {data.insights.strong.length === 0
                                        ? "—"
                                        : data.insights.strong.join(", ")}
                                </div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-secondary)",
                                        marginTop: 6,
                                    }}
                                >
                                    Ces compétences sont bien maîtrisées par la majorité de la classe.
                                </p>
                            </Card>
                            <Card>
                                <SubLabel>À renforcer</SubLabel>
                                <div
                                    style={{
                                        marginTop: 8,
                                        fontSize: 13,
                                        color: "var(--eduflow-warning-700)",
                                        fontWeight: 600,
                                    }}
                                >
                                    {data.insights.toReinforce.length === 0
                                        ? "—"
                                        : data.insights.toReinforce.join(", ")}
                                </div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-secondary)",
                                        marginTop: 6,
                                    }}
                                >
                                    Plus de la moitié de la classe en cours d'acquisition — séances
                                    ciblées recommandées.
                                </p>
                            </Card>
                            <Card
                                style={{
                                    background: "var(--eduflow-danger-50)",
                                    border: "1px solid var(--eduflow-danger-200)",
                                }}
                            >
                                <SubLabel>Priorité absolue</SubLabel>
                                <div
                                    style={{
                                        marginTop: 8,
                                        fontSize: 13,
                                        color: "var(--eduflow-danger-700)",
                                        fontWeight: 600,
                                    }}
                                >
                                    {data.insights.critical.length === 0
                                        ? "—"
                                        : data.insights.critical.join(", ")}
                                </div>
                                <p
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-danger-800)",
                                        marginTop: 6,
                                    }}
                                >
                                    Compétences non acquises pour une grande partie de la classe — à
                                    traiter en priorité avant l'examen.
                                </p>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .insight-grid {
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
