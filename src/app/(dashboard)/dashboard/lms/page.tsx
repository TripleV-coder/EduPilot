"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Chip,
    Progress,
    Sparkline,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type Homework = {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    isPublished: boolean;
    createdAt: string;
    coefficient?: number;
    maxGrade?: number;
    classSubject?: {
        subject?: { name: string };
        class?: { name: string };
    };
    submissions?: { id: string }[];
    _count?: { submissions: number };
    createdBy?: { firstName?: string; lastName?: string };
};

type HomeworkResponse =
    | Homework[]
    | { data?: Homework[]; homework?: Homework[]; homeworks?: Homework[] };

type Filter = "ongoing" | "published" | "graded" | "draft";

function dueLabel(iso: string): {
    label: string;
    variant: "info" | "warning" | "danger" | "neutral";
} {
    try {
        const due = new Date(iso);
        const now = new Date();
        const ms = due.getTime() - now.getTime();
        const days = Math.round(ms / (1000 * 60 * 60 * 24));
        if (days < 0)
            return { label: `En retard · ${Math.abs(days)} j`, variant: "danger" };
        if (days === 0) return { label: "Aujourd'hui", variant: "warning" };
        if (days <= 2) return { label: `Dans ${days} j`, variant: "warning" };
        if (days <= 7) return { label: `Dans ${days} j`, variant: "info" };
        return {
            label: due.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
            variant: "neutral",
        };
    } catch {
        return { label: iso, variant: "neutral" };
    }
}

function ratioVariant(ratio: number): "brand" | "success" | "warning" | "danger" {
    if (ratio >= 0.8) return "success";
    if (ratio >= 0.5) return "brand";
    if (ratio >= 0.2) return "warning";
    return "danger";
}

export default function LMSPage() {
    const [filter, setFilter] = useState<Filter>("ongoing");
    const { data: raw, isLoading } = useSWR<HomeworkResponse>(
        "/api/homework?limit=50",
        fetcher
    );

    const homework: Homework[] = useMemo(() => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        return raw.homework ?? raw.homeworks ?? raw.data ?? [];
    }, [raw]);

    const partitioned = useMemo(() => {
        const now = Date.now();
        const ongoing: Homework[] = [];
        const published: Homework[] = [];
        const graded: Homework[] = [];
        const draft: Homework[] = [];
        for (const h of homework) {
            if (!h.isPublished) {
                draft.push(h);
                continue;
            }
            const due = new Date(h.dueDate).getTime();
            const sub = h._count?.submissions ?? h.submissions?.length ?? 0;
            if (due < now && sub > 0) {
                graded.push(h);
            } else if (due >= now) {
                ongoing.push(h);
                published.push(h);
            } else {
                published.push(h);
            }
        }
        return { ongoing, published, graded, draft };
    }, [homework]);

    const view = useMemo(() => {
        if (filter === "ongoing") return partitioned.ongoing;
        if (filter === "published") return partitioned.published;
        if (filter === "graded") return partitioned.graded;
        return partitioned.draft;
    }, [filter, partitioned]);

    const activityData = useMemo(() => {
        const now = new Date();
        const buckets = Array(7).fill(0);
        for (const h of homework) {
            const created = new Date(h.createdAt).getTime();
            const daysAgo = Math.floor(
                (now.getTime() - created) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7) {
                const subs =
                    h._count?.submissions ?? h.submissions?.length ?? 0;
                buckets[6 - daysAgo] += subs;
            }
        }
        return buckets;
    }, [homework]);

    const totalActivity = activityData.reduce((s, v) => s + v, 0);

    const topResources = useMemo(
        () =>
            [...homework]
                .sort(
                    (a, b) =>
                        (b._count?.submissions ?? b.submissions?.length ?? 0) -
                        (a._count?.submissions ?? a.submissions?.length ?? 0)
                )
                .slice(0, 4)
                .map((h) => ({
                    name: h.title,
                    count:
                        h._count?.submissions ?? h.submissions?.length ?? 0,
                })),
        [homework]
    );

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Devoirs & ressources"
                    sub={`${homework.length} devoir${homework.length > 1 ? "s" : ""} publié${homework.length > 1 ? "s" : ""} ce trimestre`}
                    breadcrumb={["Pédagogie", "LMS"]}
                    actions={
                        <>
                            <Link href="/dashboard/resources" style={{ textDecoration: "none" }}>
                                <Button variant="secondary" icon="cards">
                                    Bibliothèque ressources
                                </Button>
                            </Link>
                            <Link href="/dashboard/homework/new" style={{ textDecoration: "none" }}>
                                <Button icon="plus">Nouveau devoir</Button>
                            </Link>
                        </>
                    }
                />

                {isLoading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement des devoirs…
                        </span>
                    </div>
                ) : null}

                {!isLoading ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.5fr 1fr",
                            gap: 14,
                        }}
                        className="lms-grid"
                    >
                        <Card padding={0}>
                            <div
                                style={{
                                    padding: "12px 18px",
                                    display: "flex",
                                    gap: 8,
                                    borderBottom:
                                        "1px solid var(--eduflow-border-subtle)",
                                    flexWrap: "wrap",
                                }}
                            >
                                <Chip
                                    active={filter === "ongoing"}
                                    count={partitioned.ongoing.length}
                                    onClick={() => setFilter("ongoing")}
                                >
                                    En cours
                                </Chip>
                                <Chip
                                    active={filter === "published"}
                                    count={partitioned.published.length}
                                    onClick={() => setFilter("published")}
                                >
                                    Publiés
                                </Chip>
                                <Chip
                                    active={filter === "graded"}
                                    count={partitioned.graded.length}
                                    onClick={() => setFilter("graded")}
                                >
                                    Notés
                                </Chip>
                                <Chip
                                    active={filter === "draft"}
                                    count={partitioned.draft.length}
                                    onClick={() => setFilter("draft")}
                                >
                                    Brouillons
                                </Chip>
                            </div>
                            {view.length === 0 ? (
                                <div
                                    style={{
                                        padding: "32px 18px",
                                        textAlign: "center",
                                        fontSize: 12,
                                        color:
                                            "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    Aucun devoir dans cette catégorie.
                                </div>
                            ) : (
                                view.map((h, i) => {
                                    const sub =
                                        h._count?.submissions ??
                                        h.submissions?.length ??
                                        0;
                                    const maxSub = Math.max(
                                        sub,
                                        ...homework.map(
                                            (x) =>
                                                x._count?.submissions ??
                                                x.submissions?.length ??
                                                0
                                        ),
                                        26
                                    );
                                    const pct =
                                        maxSub > 0
                                            ? Math.round((sub / maxSub) * 100)
                                            : 0;
                                    const due = dueLabel(h.dueDate);
                                    const author = h.createdBy
                                        ? `${h.createdBy.firstName ?? ""} ${h.createdBy.lastName ?? ""}`.trim()
                                        : null;
                                    return (
                                        <div
                                            key={h.id}
                                            style={{
                                                padding: "16px 18px",
                                                borderTop:
                                                    i > 0
                                                        ? "1px solid var(--eduflow-border-subtle)"
                                                        : 0,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    marginBottom: 10,
                                                    gap: 12,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {h.title}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 11,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {h.classSubject?.class?.name ?? "—"}
                                                        {h.classSubject?.subject?.name
                                                            ? ` · ${h.classSubject.subject.name}`
                                                            : ""}
                                                        {author ? ` · ${author}` : ""}
                                                    </div>
                                                </div>
                                                <Badge
                                                    variant={
                                                        due.variant === "neutral"
                                                            ? "neutral"
                                                            : due.variant
                                                    }
                                                    size="sm"
                                                    icon="clock"
                                                >
                                                    {due.label}
                                                </Badge>
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 14,
                                                }}
                                            >
                                                <div style={{ flex: 1 }}>
                                                    <Progress
                                                        value={pct}
                                                        variant={ratioVariant(pct / 100)}
                                                    />
                                                </div>
                                                <span
                                                    className="tabular"
                                                    style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color:
                                                            "var(--eduflow-text-secondary)",
                                                        whiteSpace: "nowrap",
                                                        fontVariantNumeric:
                                                            "tabular-nums",
                                                    }}
                                                >
                                                    {sub} rendu{sub > 1 ? "s" : ""}
                                                </span>
                                                <Link
                                                    href={`/dashboard/homework/${h.id}`}
                                                    style={{
                                                        textDecoration: "none",
                                                    }}
                                                >
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        iconRight="chevron"
                                                    >
                                                        Voir
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </Card>

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                            }}
                        >
                            <Card>
                                <SubLabel>Activité élèves · 7 jours</SubLabel>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        gap: 8,
                                        marginTop: 4,
                                    }}
                                >
                                    <span
                                        className="eduflow-display tabular"
                                        style={{
                                            fontSize: 32,
                                            fontWeight: 700,
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {totalActivity}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color:
                                                "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        rendus cette semaine
                                    </span>
                                </div>
                                <Sparkline
                                    data={
                                        activityData.length === 0
                                            ? [0]
                                            : activityData
                                    }
                                    color="var(--brand-700)"
                                    height={48}
                                />
                            </Card>

                            <Card>
                                <SubLabel>Devoirs les plus rendus</SubLabel>
                                {topResources.length === 0 ? (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color:
                                                "var(--eduflow-text-tertiary)",
                                            padding: "12px 0",
                                        }}
                                    >
                                        Aucun rendu enregistré pour le moment.
                                    </div>
                                ) : (
                                    topResources.map((r, i) => {
                                        const max = topResources[0]?.count || 1;
                                        const pct = (r.count / max) * 100;
                                        const tone = ratioVariant(r.count / max);
                                        return (
                                            <div
                                                key={r.name}
                                                style={{
                                                    padding: "10px 0",
                                                    borderTop:
                                                        i > 0
                                                            ? "1px solid var(--eduflow-border-subtle)"
                                                            : 0,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent:
                                                            "space-between",
                                                        alignItems: "center",
                                                        marginBottom: 4,
                                                        gap: 8,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {r.name}
                                                    </span>
                                                    <span
                                                        className="tabular"
                                                        style={{
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            color: `var(--eduflow-${tone}-700)`,
                                                            fontVariantNumeric:
                                                                "tabular-nums",
                                                        }}
                                                    >
                                                        {r.count}
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        height: 3,
                                                        background:
                                                            "var(--eduflow-neutral-200)",
                                                        borderRadius: 1.5,
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: "100%",
                                                            width: `${pct}%`,
                                                            background: `var(--eduflow-${tone}-500)`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </Card>
                        </div>
                    </div>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .lms-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
