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
    Progress,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type ScholarshipType =
    | "MERIT"
    | "NEED_BASED"
    | "ATHLETIC"
    | "PARTIAL"
    | "FULL"
    | "OTHER";

type Scholarship = {
    id: string;
    studentId: string;
    name: string;
    type: ScholarshipType;
    amount: number | string;
    percentage: number | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    notes: string | null;
    student?: {
        id: string;
        matricule?: string;
        user?: { firstName: string; lastName: string };
        enrollments?: { class?: { name: string } | null }[];
    };
};

type ScholarshipsResponse =
    | Scholarship[]
    | { data?: Scholarship[]; scholarships?: Scholarship[] };

type Filter = "all" | ScholarshipType;

const TYPE_LABEL: Record<ScholarshipType, string> = {
    MERIT: "Mérite",
    NEED_BASED: "Aide sociale",
    ATHLETIC: "Sportive",
    PARTIAL: "Partielle",
    FULL: "Totale",
    OTHER: "Autre",
};

const TYPE_VARIANT: Record<
    ScholarshipType,
    "brand" | "success" | "warning" | "info" | "danger" | "neutral"
> = {
    MERIT: "warning",
    NEED_BASED: "brand",
    ATHLETIC: "success",
    PARTIAL: "info",
    FULL: "brand",
    OTHER: "neutral",
};

function fmtAmount(amount: number | string): string {
    const n = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("fr-FR");
}

function compactAmount(n: number): string {
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toLocaleString("fr-FR", {
            maximumFractionDigits: 1,
        })} M`;
    if (n >= 1_000)
        return `${(n / 1_000).toLocaleString("fr-FR", {
            maximumFractionDigits: 1,
        })} k`;
    return n.toLocaleString("fr-FR");
}

function periodLabel(start: string, end: string | null): string {
    try {
        const startD = new Date(start);
        if (!end) return `Depuis ${startD.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
        const endD = new Date(end);
        const months = Math.max(
            0,
            Math.round(
                (endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24 * 30)
            )
        );
        if (months <= 1) return "Mensuelle";
        if (months <= 4) return "Trimestre";
        if (months <= 12) return "Annuelle";
        return `${months} mois`;
    } catch {
        return "—";
    }
}

export default function ScholarshipsPage() {
    const [scholarships, setScholarships] = useState<Scholarship[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("all");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/scholarships");
                const body: ScholarshipsResponse = await res.json();
                if (!res.ok)
                    throw new Error(
                        (body as { error?: string }).error || "Erreur"
                    );
                const list = Array.isArray(body)
                    ? body
                    : body.scholarships ?? body.data ?? [];
                setScholarships(list);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const activeScholarships = useMemo(
        () => scholarships.filter((s) => s.isActive),
        [scholarships]
    );

    const filtered = useMemo(() => {
        if (filter === "all") return scholarships;
        return scholarships.filter((s) => s.type === filter);
    }, [scholarships, filter]);

    const totalBudget = useMemo(
        () =>
            scholarships.reduce(
                (sum, s) =>
                    sum + (typeof s.amount === "number" ? s.amount : Number(s.amount) || 0),
                0
            ),
        [scholarships]
    );

    const distribution = useMemo(() => {
        const map = new Map<ScholarshipType, { count: number; total: number }>();
        for (const s of scholarships) {
            const v = map.get(s.type) ?? { count: 0, total: 0 };
            v.count += 1;
            v.total += typeof s.amount === "number" ? s.amount : Number(s.amount) || 0;
            map.set(s.type, v);
        }
        const arr = Array.from(map.entries()).sort(
            (a, b) => b[1].total - a[1].total
        );
        return arr.map(([type, v]) => ({
            type,
            label: TYPE_LABEL[type],
            count: v.count,
            total: v.total,
            pct: totalBudget > 0 ? Math.round((v.total / totalBudget) * 100) : 0,
            variant: TYPE_VARIANT[type],
        }));
    }, [scholarships, totalBudget]);

    const pending = scholarships.filter((s) => !s.isActive).length;

    const typeCounts = useMemo(() => {
        const counts = new Map<ScholarshipType, number>();
        for (const s of scholarships) {
            counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
        }
        return counts;
    }, [scholarships]);

    return (
        <PageGuard
            permission={Permission.SCHOOL_UPDATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Bourses & aides scolaires"
                    sub={
                        scholarships.length > 0
                            ? `${activeScholarships.length} boursier${activeScholarships.length > 1 ? "s" : ""} actif${activeScholarships.length > 1 ? "s" : ""} · ${compactAmount(totalBudget)} FCFA distribués · ${pending} en attente`
                            : "Suivi des bourses et aides distribuées"
                    }
                    breadcrumb={["Administration", "Bourses"]}
                    actions={
                        <>
                            <Button variant="secondary" icon="download">
                                Rapport MEMP
                            </Button>
                            <Button icon="plus">Nouvelle bourse</Button>
                        </>
                    }
                />

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

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 12,
                    }}
                    className="kpi-grid"
                >
                    <MetricCard
                        label="Boursiers actifs"
                        value={String(activeScholarships.length)}
                        icon="trophy"
                        variant="success"
                    />
                    <MetricCard
                        label="Budget total"
                        value={compactAmount(totalBudget)}
                        unit="FCFA"
                        icon="money"
                        variant="brand"
                    />
                    <MetricCard
                        label="En attente"
                        value={String(pending)}
                        icon="clock"
                        variant={pending > 0 ? "warning" : "neutral"}
                    />
                    <MetricCard
                        label="Sources distinctes"
                        value={String(distribution.length)}
                        icon="cards"
                        variant="info"
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement des bourses…
                        </span>
                    </div>
                ) : null}

                {!loading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.5fr 1fr",
                            gap: 14,
                        }}
                        className="sch-grid"
                    >
                        <Card padding={0}>
                            <div
                                style={{
                                    padding: "14px 18px",
                                    display: "flex",
                                    gap: 8,
                                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                                    flexWrap: "wrap",
                                }}
                            >
                                <Chip
                                    active={filter === "all"}
                                    onClick={() => setFilter("all")}
                                >
                                    Toutes · {scholarships.length}
                                </Chip>
                                {(["MERIT", "NEED_BASED", "FULL", "PARTIAL", "ATHLETIC", "OTHER"] as ScholarshipType[]).map(
                                    (t) => {
                                        const c = typeCounts.get(t) ?? 0;
                                        if (c === 0) return null;
                                        return (
                                            <Chip
                                                key={t}
                                                active={filter === t}
                                                count={c}
                                                onClick={() => setFilter(t)}
                                            >
                                                {TYPE_LABEL[t]}
                                            </Chip>
                                        );
                                    }
                                )}
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
                                            {[
                                                "Élève",
                                                "Type",
                                                "Montant",
                                                "Période",
                                                "Critères / notes",
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
                                                    colSpan={6}
                                                    style={{
                                                        padding: "32px 14px",
                                                        textAlign: "center",
                                                        fontSize: 12,
                                                        color:
                                                            "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    Aucune bourse dans cette catégorie.
                                                </td>
                                            </tr>
                                        ) : (
                                            filtered.map((s, i) => {
                                                const name = s.student?.user
                                                    ? `${s.student.user.firstName} ${s.student.user.lastName}`
                                                    : s.student?.matricule || "Élève";
                                                const klass = s.student?.enrollments?.[0]?.class?.name;
                                                return (
                                                    <tr
                                                        key={s.id}
                                                        style={{
                                                            borderTop:
                                                                i > 0
                                                                    ? "1px solid var(--eduflow-border-subtle)"
                                                                    : 0,
                                                        }}
                                                    >
                                                        <td
                                                            style={{ padding: "12px 14px" }}
                                                        >
                                                            <Link
                                                                href={`/dashboard/students/${s.studentId}`}
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    gap: 10,
                                                                    textDecoration: "none",
                                                                    color: "inherit",
                                                                }}
                                                            >
                                                                <Avatar name={name} size="sm" />
                                                                <div>
                                                                    <div
                                                                        style={{
                                                                            fontSize: 13,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {name}
                                                                    </div>
                                                                    {klass ? (
                                                                        <div
                                                                            style={{
                                                                                fontSize: 10,
                                                                                color:
                                                                                    "var(--eduflow-text-tertiary)",
                                                                            }}
                                                                        >
                                                                            {klass}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </Link>
                                                        </td>
                                                        <td
                                                            style={{ padding: "12px 14px" }}
                                                        >
                                                            <Badge
                                                                variant={
                                                                    TYPE_VARIANT[s.type]
                                                                }
                                                                size="sm"
                                                            >
                                                                {TYPE_LABEL[s.type]}
                                                            </Badge>
                                                        </td>
                                                        <td
                                                            style={{ padding: "12px 14px" }}
                                                        >
                                                            <span
                                                                className="eduflow-display tabular"
                                                                style={{
                                                                    fontSize: 14,
                                                                    fontWeight: 700,
                                                                    fontVariantNumeric:
                                                                        "tabular-nums",
                                                                }}
                                                            >
                                                                {fmtAmount(s.amount)}
                                                            </span>{" "}
                                                            <span
                                                                style={{
                                                                    fontSize: 10,
                                                                    color:
                                                                        "var(--eduflow-text-tertiary)",
                                                                }}
                                                            >
                                                                FCFA
                                                            </span>
                                                            {s.percentage ? (
                                                                <div
                                                                    style={{
                                                                        fontSize: 10,
                                                                        color:
                                                                            "var(--eduflow-text-tertiary)",
                                                                    }}
                                                                >
                                                                    {s.percentage}%
                                                                </div>
                                                            ) : null}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                                color:
                                                                    "var(--eduflow-text-secondary)",
                                                            }}
                                                        >
                                                            {periodLabel(s.startDate, s.endDate)}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 14px",
                                                                color:
                                                                    "var(--eduflow-text-secondary)",
                                                                fontSize: 11,
                                                                maxWidth: 220,
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                            title={s.notes ?? ""}
                                                        >
                                                            {s.notes ?? "—"}
                                                        </td>
                                                        <td
                                                            style={{ padding: "12px 14px" }}
                                                        >
                                                            <Badge
                                                                variant={
                                                                    s.isActive
                                                                        ? "success"
                                                                        : "warning"
                                                                }
                                                                size="sm"
                                                                dot={!s.isActive}
                                                            >
                                                                {s.isActive
                                                                    ? "Active"
                                                                    : "À valider"}
                                                            </Badge>
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
                                    Répartition par type · {compactAmount(totalBudget)} FCFA
                                </SubLabel>
                                {distribution.length === 0 ? (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 8,
                                        }}
                                    >
                                        Aucune bourse enregistrée.
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
                                        {distribution.map((d) => {
                                            const progressVariant =
                                                d.variant === "neutral" ||
                                                d.variant === "info"
                                                    ? "brand"
                                                    : d.variant;
                                            return (
                                                <Progress
                                                    key={d.type}
                                                    label={d.label}
                                                    sublabel={`${compactAmount(d.total)} FCFA`}
                                                    value={d.pct}
                                                    variant={progressVariant}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                            <Card
                                style={{
                                    background: "var(--eduflow-success-50)",
                                    border: "1px solid var(--eduflow-success-200)",
                                }}
                            >
                                <div style={{ display: "flex", gap: 10 }}>
                                    <Icon
                                        name="trophy"
                                        size={18}
                                        color="var(--eduflow-success-700)"
                                    />
                                    <div>
                                        <div
                                            className="eduflow-display"
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: "var(--eduflow-success-900, var(--eduflow-success-800))",
                                            }}
                                        >
                                            Impact mesuré
                                        </div>
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-success-800)",
                                                margin: "4px 0 0",
                                                lineHeight: 1.55,
                                            }}
                                        >
                                            {activeScholarships.length > 0 ? (
                                                <>
                                                    {activeScholarships.length} bourse
                                                    {activeScholarships.length > 1 ? "s" : ""} active
                                                    {activeScholarships.length > 1 ? "s" : ""} ·{" "}
                                                    {compactAmount(totalBudget)} FCFA distribués.
                                                    L'impact sur la moyenne sera affiché ici dès
                                                    qu'on aura des données comparatives boursiers vs
                                                    établissement.
                                                </>
                                            ) : (
                                                <>
                                                    Aucune bourse encore enregistrée. Démarre avec
                                                    « Nouvelle bourse » pour suivre l'impact.
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .sch-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
