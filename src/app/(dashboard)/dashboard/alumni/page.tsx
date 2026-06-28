"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
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
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";
import { AlumniCreateDialog } from "@/components/alumni/alumni-create-dialog";

type AlumniField = "Médecine" | "Tech" | "Droit" | "Business" | "Énergie" | "Autre";

type Alumni = {
    id: string;
    firstName: string;
    lastName: string;
    graduationYear: number;
    series: string | null;
    field: AlumniField;
    currentRole: string | null;
    company: string | null;
    isMentor: boolean;
    mentorTopic: string | null;
};

type Promotion = { year: number; members: number };

type AlumniResponse = {
    alumni: Alumni[];
    promotions: Promotion[];
    mentorCount: number;
    total: number;
};

const FIELD_VARIANT: Record<AlumniField, "brand" | "info" | "warning" | "success" | "danger" | "neutral"> = {
    Médecine: "danger",
    Tech: "info",
    Droit: "brand",
    Business: "warning",
    Énergie: "success",
    Autre: "neutral",
};

type Filter = "all" | AlumniField;

export default function AlumniPage() {
    const [filter, setFilter] = useState<Filter>("all");
    const [data, setData] = useState<AlumniResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/alumni", { credentials: "include", cache: "no-store" });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Impossible de charger l'annuaire");
            }
            setData(await res.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const alumni = data?.alumni ?? [];

    const fields = useMemo(() => {
        const counts = new Map<AlumniField, number>();
        for (const a of alumni) counts.set(a.field, (counts.get(a.field) ?? 0) + 1);
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [alumni]);

    const filtered = useMemo(
        () => (filter === "all" ? alumni : alumni.filter((a) => a.field === filter)),
        [alumni, filter]
    );

    const topPromo = data?.promotions?.[0];
    const jobLine = (a: Alumni) =>
        [a.currentRole, a.company].filter(Boolean).join(" · ") || "Profil à compléter";

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Réseau Alumni"
                    sub={
                        loading
                            ? "Chargement de l'annuaire…"
                            : `${data?.total ?? 0} anciens élèves · ${data?.mentorCount ?? 0} mentors disponibles`
                    }
                    breadcrumb={["Communauté", "Alumni"]}
                    actions={
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}>
                            <AlumniCreateDialog onCreated={load} />
                        </RoleActionGuard>
                    }
                />

                {error ? (
                    <Card padding={16} style={{ border: "1px solid var(--eduflow-danger-200)", background: "var(--eduflow-danger-50)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <Icon name="info" size={16} color="var(--eduflow-danger-700)" />
                            <span style={{ fontSize: 13, color: "var(--eduflow-danger-800)" }}>{error}</span>
                            <Button variant="secondary" size="sm" onClick={load} style={{ marginLeft: "auto" }}>Réessayer</Button>
                        </div>
                    </Card>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="kpi-grid">
                    <MetricCard label="Anciens élèves" value={loading ? "…" : String(data?.total ?? 0)} icon="users" variant="neutral" />
                    <MetricCard label="Mentors actifs" value={loading ? "…" : String(data?.mentorCount ?? 0)} icon="sparkle" variant="info" />
                    <MetricCard label="Promotions" value={loading ? "…" : String(data?.promotions.length ?? 0)} icon="calendar" variant="neutral" />
                    <MetricCard label="Top promo" value={topPromo ? `BAC ${topPromo.year}` : "—"} icon="trophy" variant="success" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }} className="alumni-grid">
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
                            <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>Annuaire des anciens</h3>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <Chip active={filter === "all"} onClick={() => setFilter("all")}>Tous</Chip>
                                {fields.map(([f, c]) => (
                                    <Chip key={f} active={filter === f} count={c} onClick={() => setFilter(f)}>{f}</Chip>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>
                        ) : filtered.length === 0 ? (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--eduflow-text-secondary)" }}>
                                <Icon name="users" size={28} color="var(--eduflow-text-tertiary)" />
                                <p style={{ fontSize: 13, marginTop: 10 }}>
                                    {alumni.length === 0
                                        ? "Aucun ancien élève dans l'annuaire. Ajoute le premier profil."
                                        : "Aucun ancien élève pour ce domaine."}
                                </p>
                            </div>
                        ) : (
                            filtered.map((a, i) => (
                                <div
                                    key={a.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "48px 1fr auto",
                                        gap: 14,
                                        padding: "14px 18px",
                                        borderTop: i > 0 ? "1px solid var(--eduflow-border-subtle)" : 0,
                                        alignItems: "center",
                                    }}
                                >
                                    <Avatar name={`${a.firstName} ${a.lastName}`} size="md" />
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700 }}>{a.firstName} {a.lastName}</div>
                                        <div style={{ fontSize: 11, color: "var(--brand-700)", fontWeight: 600 }}>
                                            BAC {a.graduationYear}{a.series ? ` · Série ${a.series}` : ""}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--eduflow-text-secondary)" }}>{jobLine(a)}</div>
                                        {a.isMentor ? (
                                            <div style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)", marginTop: 2 }}>
                                                Mentor{a.mentorTopic ? ` · ${a.mentorTopic}` : ""}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                                        <Badge variant={FIELD_VARIANT[a.field]} size="sm" icon="sparkle">{a.field}</Badge>
                                        {a.isMentor ? <Badge variant="success" size="sm">Mentor</Badge> : null}
                                    </div>
                                </div>
                            ))
                        )}
                    </Card>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card>
                            <SubLabel>Membres par promotion</SubLabel>
                            <div style={{ marginTop: 8 }}>
                                {!loading && (data?.promotions.length ?? 0) === 0 ? (
                                    <p style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", padding: "8px 0" }}>
                                        Les promotions apparaîtront ici dès les premiers profils.
                                    </p>
                                ) : (
                                    (data?.promotions ?? []).map((p, i) => (
                                        <div
                                            key={p.year}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                padding: "8px 0",
                                                borderTop: i > 0 ? "1px solid var(--eduflow-border-subtle)" : 0,
                                            }}
                                        >
                                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Promo {p.year}</span>
                                            <span
                                                className="eduflow-display tabular"
                                                style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                                            >
                                                {p.members} membre{p.members > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>

                        <Card>
                            <SubLabel>Mentorat</SubLabel>
                            <p style={{ fontSize: 12, color: "var(--eduflow-text-secondary)", lineHeight: 1.55, margin: "6px 0 0" }}>
                                Marque un ancien élève comme « mentor » lors de l'ajout pour le proposer aux élèves
                                en orientation. Les mentors disponibles sont comptés ci-dessus.
                            </p>
                        </Card>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    .alumni-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </PageGuard>
    );
}
