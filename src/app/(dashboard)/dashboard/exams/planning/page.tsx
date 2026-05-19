"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

type Evaluation = {
    id: string;
    title: string | null;
    date: string;
    maxGrade: number;
    coefficient: number;
    classSubject: {
        id: string;
        classId: string;
        subject: { id: string; name: string };
        class: { id: string; name: string };
    };
    type?: { name: string };
};

type EvalsResponse = Evaluation[] | { evaluations?: Evaluation[]; data?: Evaluation[] };

type DayKey = 0 | 1 | 2 | 3 | 4;
type Slot = "AM" | "PM";

const DAY_LABELS: Record<DayKey, string> = {
    0: "Lun",
    1: "Mar",
    2: "Mer",
    3: "Jeu",
    4: "Ven",
};

// Color by subject category — best-effort from subject name
function subjectColor(name: string): "brand" | "info" | "success" | "warning" | "danger" {
    const n = name.toLowerCase();
    if (n.includes("français") || n.includes("francais") || n.includes("anglais") || n.includes("philo"))
        return "brand";
    if (n.includes("math") || n.includes("physi"))
        return "info";
    if (n.includes("svt") || n.includes("bio") || n.includes("sport") || n.includes("eps"))
        return "success";
    if (n.includes("histoire") || n.includes("géo") || n.includes("geo"))
        return "warning";
    if (n.includes("brevet") || n.includes("bepc"))
        return "danger";
    return "info";
}

function startOfWeek(d: Date): Date {
    const out = new Date(d);
    const day = out.getDay();
    const diff = (day + 6) % 7; // Monday = 0
    out.setDate(out.getDate() - diff);
    out.setHours(0, 0, 0, 0);
    return out;
}

function addDays(d: Date, n: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + n);
    return out;
}

function fmtShortDate(d: Date): string {
    return d.toLocaleDateString("fr-FR", { day: "2-digit" });
}

function fmtRangeLabel(monday: Date): string {
    const friday = addDays(monday, 4);
    return `${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} → ${friday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
}

export default function ExamsPlanningPage() {
    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
    const [classFilter, setClassFilter] = useState<string>("all");
    const [evals, setEvals] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/evaluations");
                const body: EvalsResponse = await res.json();
                if (!res.ok)
                    throw new Error((body as { error?: string }).error || "Erreur");
                const list = Array.isArray(body)
                    ? body
                    : body.evaluations ?? body.data ?? [];
                setEvals(list);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const friday = useMemo(() => addDays(weekStart, 4), [weekStart]);

    const inWeek = useMemo(() => {
        const startMs = weekStart.getTime();
        const endMs = friday.getTime() + 24 * 60 * 60 * 1000;
        return evals.filter((e) => {
            const t = new Date(e.date).getTime();
            return t >= startMs && t < endMs;
        });
    }, [evals, weekStart, friday]);

    const classes = useMemo(() => {
        const map = new Map<string, string>();
        for (const e of inWeek) {
            map.set(e.classSubject.class.id, e.classSubject.class.name);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[1].localeCompare(b[1]))
            .slice(0, 6);
    }, [inWeek]);

    const filtered = useMemo(() => {
        if (classFilter === "all") return inWeek;
        return inWeek.filter((e) => e.classSubject.class.id === classFilter);
    }, [inWeek, classFilter]);

    type GridSlot = { evaluations: Evaluation[] };
    const grid = useMemo(() => {
        const cells: Record<DayKey, Record<Slot, GridSlot>> = {
            0: { AM: { evaluations: [] }, PM: { evaluations: [] } },
            1: { AM: { evaluations: [] }, PM: { evaluations: [] } },
            2: { AM: { evaluations: [] }, PM: { evaluations: [] } },
            3: { AM: { evaluations: [] }, PM: { evaluations: [] } },
            4: { AM: { evaluations: [] }, PM: { evaluations: [] } },
        };
        for (const e of filtered) {
            const d = new Date(e.date);
            const day = ((d.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
            if (day > 4) continue;
            const slot: Slot = d.getHours() < 12 ? "AM" : "PM";
            cells[day as DayKey][slot].evaluations.push(e);
        }
        return cells;
    }, [filtered]);

    const totalCount = filtered.length;
    const distinctSubjects = new Set(filtered.map((e) => e.classSubject.subject.id)).size;

    return (
        <PageGuard
            permission={Permission.EVALUATION_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/exams" style={{ textDecoration: "none" }}>
                        <Button variant="secondary" size="sm">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Modèles d'examen
                            </span>
                        </Button>
                    </Link>
                </div>

                <PageHeader
                    greeting="Examens · planning"
                    sub={`Composition · ${fmtRangeLabel(weekStart)}`}
                    breadcrumb={["Pédagogie", "Examens", "Planning"]}
                    actions={
                        <>
                            <Button variant="secondary" icon="download">
                                Convocations PDF
                            </Button>
                            <Link href="/dashboard/exams/new" style={{ textDecoration: "none" }}>
                                <Button icon="plus">Nouvelle épreuve</Button>
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
                        label="Épreuves cette semaine"
                        value={String(totalCount)}
                        icon="cards"
                        variant="brand"
                    />
                    <MetricCard
                        label="Matières concernées"
                        value={String(distinctSubjects)}
                        icon="book"
                        variant="info"
                    />
                    <MetricCard
                        label="Classes mobilisées"
                        value={String(classes.length)}
                        icon="users"
                        variant="success"
                    />
                    <MetricCard
                        label="Coefficients cumulés"
                        value={String(
                            Math.round(
                                filtered.reduce(
                                    (s, e) => s + Number(e.coefficient || 0),
                                    0
                                )
                            )
                        )}
                        icon="check"
                        variant="brand"
                    />
                </div>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
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
                    </Card>
                ) : null}

                <Card padding={0}>
                    <div
                        style={{
                            padding: "14px 20px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderBottom: "1px solid var(--eduflow-border-subtle)",
                            flexWrap: "wrap",
                            gap: 12,
                        }}
                    >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setWeekStart((w) => addDays(w, -7))}
                            >
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                            </Button>
                            <h3
                                className="eduflow-display"
                                style={{ fontSize: 16, margin: 0 }}
                            >
                                Semaine du {fmtRangeLabel(weekStart)}
                            </h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setWeekStart((w) => addDays(w, 7))}
                            >
                                <Icon name="chevron" size={14} />
                            </Button>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Chip
                                active={classFilter === "all"}
                                onClick={() => setClassFilter("all")}
                            >
                                Toutes les classes
                            </Chip>
                            {classes.map(([id, name]) => (
                                <Chip
                                    key={id}
                                    active={classFilter === id}
                                    onClick={() => setClassFilter(id)}
                                >
                                    {name}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div
                            style={{
                                padding: 36,
                                textAlign: "center",
                            }}
                        >
                            <Spinner size={24} color="var(--brand-600)" />
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "80px repeat(5, 1fr)",
                            }}
                            className="exam-planning"
                        >
                            <div />
                            {([0, 1, 2, 3, 4] as DayKey[]).map((d) => {
                                const day = addDays(weekStart, d);
                                return (
                                    <div
                                        key={d}
                                        style={{
                                            padding: "14px 12px",
                                            textAlign: "center",
                                            borderLeft:
                                                "1px solid var(--eduflow-border-subtle)",
                                            borderBottom:
                                                "1px solid var(--eduflow-border-subtle)",
                                        }}
                                    >
                                        <div
                                            className="eduflow-display"
                                            style={{ fontSize: 14, fontWeight: 700 }}
                                        >
                                            {DAY_LABELS[d]} {fmtShortDate(day)}
                                        </div>
                                    </div>
                                );
                            })}
                            {(["AM", "PM"] as Slot[]).map((slot, slotIdx) => (
                                <Fragment key={slot}>
                                    <div
                                        style={{
                                            padding: "14px 12px",
                                            borderBottom:
                                                slotIdx === 0
                                                    ? "1px solid var(--eduflow-border-subtle)"
                                                    : "none",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color:
                                                "var(--eduflow-text-tertiary)",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {slot === "AM" ? "08:00\n10:00" : "14:00\n16:00"}
                                    </div>
                                    {([0, 1, 2, 3, 4] as DayKey[]).map((d) => {
                                        const cellEvals = grid[d][slot].evaluations;
                                        return (
                                            <div
                                                key={`${d}-${slot}`}
                                                style={{
                                                    padding: 8,
                                                    borderLeft:
                                                        "1px solid var(--eduflow-border-subtle)",
                                                    borderBottom:
                                                        slotIdx === 0
                                                            ? "1px solid var(--eduflow-border-subtle)"
                                                            : "none",
                                                    minHeight: 90,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 6,
                                                }}
                                            >
                                                {cellEvals.length === 0 ? null : (
                                                    cellEvals.map((e) => {
                                                        const color = subjectColor(
                                                            e.classSubject.subject.name
                                                        );
                                                        return (
                                                            <Link
                                                                key={e.id}
                                                                href={`/dashboard/grades/entry?evaluationId=${e.id}`}
                                                                style={{
                                                                    textDecoration: "none",
                                                                }}
                                                            >
                                                                <div
                                                                    style={{
                                                                        padding: 10,
                                                                        background: `var(--eduflow-${color}-50)`,
                                                                        borderLeft: `3px solid var(--eduflow-${color}-600)`,
                                                                        borderRadius: 8,
                                                                        cursor: "pointer",
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            fontSize: 12,
                                                                            fontWeight: 700,
                                                                            color: `var(--eduflow-${color}-800)`,
                                                                        }}
                                                                    >
                                                                        {e.classSubject.subject.name}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            fontSize: 10,
                                                                            color: `var(--eduflow-${color}-800)`,
                                                                            marginTop: 4,
                                                                        }}
                                                                    >
                                                                        {e.classSubject.class.name}
                                                                    </div>
                                                                    {e.title ? (
                                                                        <div
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color: `var(--eduflow-${color}-800)`,
                                                                                opacity: 0.7,
                                                                            }}
                                                                        >
                                                                            {e.title}
                                                                        </div>
                                                                    ) : null}
                                                                    <div
                                                                        style={{
                                                                            marginTop: 6,
                                                                            fontSize: 10,
                                                                            color: `var(--eduflow-${color}-700)`,
                                                                            fontWeight: 600,
                                                                            fontVariantNumeric:
                                                                                "tabular-nums",
                                                                        }}
                                                                    >
                                                                        coef {Number(e.coefficient || 1)} · /{Number(e.maxGrade || 20)}
                                                                    </div>
                                                                </div>
                                                            </Link>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </div>
                    )}
                </Card>

                {!loading && totalCount === 0 ? (
                    <Card padding={36}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <Badge variant="neutral" size="sm">
                                Semaine calme
                            </Badge>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    maxWidth: 480,
                                    lineHeight: 1.55,
                                    margin: 0,
                                }}
                            >
                                Aucune évaluation programmée pour cette semaine. Navigue vers
                                une autre semaine ou crée une nouvelle épreuve.
                            </p>
                        </div>
                    </Card>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .exam-planning {
                        grid-template-columns: 60px repeat(5, minmax(120px, 1fr)) !important;
                        overflow-x: auto;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
