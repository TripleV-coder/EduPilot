"use client";

import { useMemo, useState } from "react";

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
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type AlumniSeed = {
    id: string;
    name: string;
    promo: string;
    series: string;
    job: string;
    mentorTopic: string;
    field: "Médecine" | "Tech" | "Droit" | "Business" | "Énergie" | "Autre";
};

type PromotionSeed = {
    label: string;
    members: number;
    donations: string;
};

type EventSeed = {
    name: string;
    date: string;
    location: string;
    confirmed: number;
    goal: string;
};

const ALUMNI_SAMPLE: AlumniSeed[] = [
    {
        id: "bocco",
        name: "Dr. Aïssatou Bocco",
        promo: "BAC 2008",
        series: "Série D",
        job: "Chirurgienne · CNHU-HKM Cotonou",
        mentorTopic: "Étudiants Série D",
        field: "Médecine",
    },
    {
        id: "tossou",
        name: "Ing. Patrick Tossou",
        promo: "BAC 2010",
        series: "Série C",
        job: "Tech Lead · Orange Bénin",
        mentorTopic: "Sciences & info",
        field: "Tech",
    },
    {
        id: "houngbedji",
        name: "Me Léa Houngbedji",
        promo: "BAC 2005",
        series: "Série A1",
        job: "Avocate au barreau",
        mentorTopic: "Filière A · droit",
        field: "Droit",
    },
    {
        id: "bio",
        name: "Mme Fatou Bio",
        promo: "BAC 2012",
        series: "Série G2",
        job: "Directrice Marketing · MTN",
        mentorTopic: "Filière G · marketing",
        field: "Business",
    },
    {
        id: "coffi",
        name: "M. Olivier Coffi",
        promo: "BAC 2003",
        series: "Série F3",
        job: "Entrepreneur · énergie solaire",
        mentorTopic: "F1-F4 industrie",
        field: "Énergie",
    },
];

const PROMOTIONS_SAMPLE: PromotionSeed[] = [
    { label: "Promo 2010", members: 42, donations: "6,2M FCFA" },
    { label: "Promo 2015", members: 38, donations: "4,8M FCFA" },
    { label: "Promo 2008", members: 31, donations: "8,1M FCFA" },
    { label: "Promo 2018", members: 28, donations: "2,4M FCFA" },
];

const EVENT_SAMPLE: EventSeed = {
    name: "Gala des 30 ans",
    date: "Samedi 14 juin · 19h",
    location: "Hôtel du Lac · Cotonou",
    confirmed: 248,
    goal: "5M FCFA pour la bibliothèque",
};

const FIELD_VARIANT: Record<AlumniSeed["field"], "brand" | "info" | "warning" | "success" | "danger" | "neutral"> = {
    Médecine: "danger",
    Tech: "info",
    Droit: "brand",
    Business: "warning",
    Énergie: "success",
    Autre: "neutral",
};

type Filter = "all" | AlumniSeed["field"];

export default function AlumniPage() {
    const [filter, setFilter] = useState<Filter>("all");

    const filtered = useMemo(() => {
        if (filter === "all") return ALUMNI_SAMPLE;
        return ALUMNI_SAMPLE.filter((a) => a.field === filter);
    }, [filter]);

    const fields = useMemo(() => {
        const counts = new Map<AlumniSeed["field"], number>();
        for (const a of ALUMNI_SAMPLE) {
            counts.set(a.field, (counts.get(a.field) ?? 0) + 1);
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, []);

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Réseau Alumni"
                    sub={`${ALUMNI_SAMPLE.length} mentors en démonstration · catalogue à activer avec le modèle Prisma`}
                    breadcrumb={["Communauté", "Alumni"]}
                    actions={
                        <>
                            <Button variant="secondary" icon="sms" disabled>
                                Newsletter trimestrielle
                            </Button>
                            <Button icon="plus" disabled>
                                Nouvel événement
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
                            Vue de démonstration · les modèles <code>Alumni</code>,{" "}
                            <code>AlumniMentorship</code>, <code>AlumniEvent</code>,{" "}
                            <code>Donation</code> ne sont pas encore en place côté Prisma.
                            Les profils ci-dessous illustrent le rendu final ; les actions
                            (Mentor, Connecter, Donner) seront branchées dès que le réseau
                            sera ouvert.
                        </div>
                    </div>
                </Card>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 12,
                    }}
                    className="kpi-grid"
                >
                    <MetricCard
                        label="Anciens élèves"
                        value="—"
                        icon="users"
                        variant="neutral"
                    />
                    <MetricCard
                        label="Dons cumulés"
                        value="—"
                        unit="M FCFA"
                        icon="money"
                        variant="neutral"
                    />
                    <MetricCard
                        label="Mentors actifs"
                        value={String(ALUMNI_SAMPLE.length)}
                        icon="sparkle"
                        variant="info"
                    />
                    <MetricCard
                        label="Événements / an"
                        value="—"
                        icon="calendar"
                        variant="neutral"
                    />
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.4fr 1fr",
                        gap: 14,
                    }}
                    className="alumni-grid"
                >
                    <Card padding={0}>
                        <div
                            style={{
                                padding: "14px 18px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                                flexWrap: "wrap",
                                gap: 8,
                            }}
                        >
                            <h3
                                className="eduflow-display"
                                style={{ fontSize: 16, margin: 0 }}
                            >
                                Mentors disponibles
                            </h3>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <Chip
                                    active={filter === "all"}
                                    onClick={() => setFilter("all")}
                                >
                                    Tous
                                </Chip>
                                {fields.map(([f, c]) => (
                                    <Chip
                                        key={f}
                                        active={filter === f}
                                        count={c}
                                        onClick={() => setFilter(f)}
                                    >
                                        {f}
                                    </Chip>
                                ))}
                            </div>
                        </div>
                        {filtered.map((a, i) => (
                            <div
                                key={a.id}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "48px 1fr auto",
                                    gap: 14,
                                    padding: "14px 18px",
                                    borderTop:
                                        i > 0
                                            ? "1px solid var(--eduflow-border-subtle)"
                                            : 0,
                                    alignItems: "center",
                                }}
                            >
                                <Avatar name={a.name} size="md" />
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                                        {a.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "var(--brand-700)",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {a.promo} · {a.series}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-secondary)",
                                        }}
                                    >
                                        {a.job}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 2,
                                        }}
                                    >
                                        Mentor · {a.mentorTopic}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-end",
                                        gap: 6,
                                    }}
                                >
                                    <Badge
                                        variant={FIELD_VARIANT[a.field]}
                                        size="sm"
                                        icon="sparkle"
                                    >
                                        {a.field}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconRight="chevron"
                                        disabled
                                    >
                                        Connecter
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </Card>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card
                            style={{
                                background:
                                    "linear-gradient(135deg, var(--brand-700), var(--accent-600, var(--brand-800)))",
                                color: "#fff",
                                border: 0,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    opacity: 0.85,
                                }}
                            >
                                Prochain événement · exemple
                            </div>
                            <div
                                className="eduflow-display"
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    marginTop: 8,
                                    lineHeight: 1.2,
                                }}
                            >
                                {EVENT_SAMPLE.name}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
                                {EVENT_SAMPLE.date} · {EVENT_SAMPLE.location}
                            </div>
                            <div
                                style={{
                                    marginTop: 14,
                                    fontSize: 12,
                                    opacity: 0.88,
                                }}
                            >
                                {EVENT_SAMPLE.confirmed} confirmés · objectif {EVENT_SAMPLE.goal}
                            </div>
                            <Button
                                size="sm"
                                style={{
                                    background: "#fff",
                                    color: "var(--brand-700)",
                                    marginTop: 14,
                                }}
                                disabled
                            >
                                Voir le programme
                            </Button>
                        </Card>

                        <Card>
                            <SubLabel>Top promotions actives</SubLabel>
                            <div style={{ marginTop: 8 }}>
                                {PROMOTIONS_SAMPLE.map((p, i) => (
                                    <div
                                        key={p.label}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            padding: "8px 0",
                                            borderTop:
                                                i > 0
                                                    ? "1px solid var(--eduflow-border-subtle)"
                                                    : 0,
                                        }}
                                    >
                                        <span
                                            style={{
                                                flex: 1,
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {p.label}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                marginRight: 12,
                                            }}
                                        >
                                            {p.members} membres
                                        </span>
                                        <span
                                            className="eduflow-display tabular"
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: "var(--eduflow-success-700)",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {p.donations}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card>
                            <SubLabel>Faire un don à l'école</SubLabel>
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    lineHeight: 1.55,
                                    margin: "6px 0 10px",
                                }}
                            >
                                Financez bourses, infrastructure, livres. 100% reversé · reçu
                                fiscal automatique à brancher.
                            </p>
                            <Button
                                icon="money"
                                style={{
                                    width: "100%",
                                    background: "var(--gradient-cta, var(--brand-700))",
                                }}
                                disabled
                            >
                                Faire un don
                            </Button>
                        </Card>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .alumni-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
