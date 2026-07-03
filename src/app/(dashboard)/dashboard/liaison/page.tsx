"use client";

import { useEffect, useMemo, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Chip,
    Icon,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";
import { SubLabel } from "@/components/edu-homes/_shared";

type Variant = "success" | "warning" | "danger" | "info" | "neutral";

type LiaisonEntry = {
    id: string;
    source: "incident" | "absence" | "announcement" | "appointment";
    from: string;
    role: string;
    date: string;
    title: string;
    body: string;
    tagLabel: string;
    tagVariant: Variant;
    signed: boolean;
    requiresSignature: boolean;
    actionLabel?: string;
};

type Recipient = { id: string; label: string };

type LiaisonData = {
    student: { id: string; firstName: string; lastName: string };
    class: { id: string; name: string } | null;
    entries: LiaisonEntry[];
    toSignCount: number;
    signatureWindowDays: number;
    recap: {
        felicitations: number;
        vigilances: number;
        documents: number;
        sanctions: number;
    };
    recipients: Recipient[];
};

type Filter = "all" | "toSign" | "teacher" | "mine" | "documents";

const FR_DATE = (iso: string): string => {
    try {
        const d = new Date(iso);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const isToday = d.toDateString() === today.toDateString();
        const isYesterday = d.toDateString() === yesterday.toDateString();
        const time = d.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
        if (isToday) return `aujourd'hui · ${time}`;
        if (isYesterday) return `hier · ${time}`;
        return `${d.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
        })} · ${time}`;
    } catch {
        return iso;
    }
};

export default function LiaisonPage() {
    const [data, setData] = useState<LiaisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("all");
    const [composeTo, setComposeTo] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [composeSending, setComposeSending] = useState(false);
    const [composeStatus, setComposeStatus] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/liaison");
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || "Erreur");
                setData(body);
                if (body.recipients?.[0]) setComposeTo(body.recipients[0].id);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const filtered = useMemo(() => {
        if (!data) return [];
        if (filter === "toSign")
            return data.entries.filter((e) => e.requiresSignature);
        if (filter === "teacher")
            return data.entries.filter(
                (e) => e.source === "incident" || e.source === "appointment"
            );
        if (filter === "mine")
            return data.entries.filter((e) => e.source === "absence");
        if (filter === "documents")
            return data.entries.filter((e) => e.source === "announcement");
        return data.entries;
    }, [data, filter]);

    const handleSend = async () => {
        if (!composeBody.trim() || !composeTo) return;
        setComposeSending(true);
        setComposeStatus(null);
        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientUserId: composeTo,
                    content: composeBody,
                    subject: data
                        ? `Cahier de liaison · ${data.student.firstName} ${data.student.lastName}`
                        : "Cahier de liaison",
                }),
            });
            if (res.ok) {
                setComposeStatus("Mot envoyé · signé numériquement.");
                setComposeBody("");
            } else {
                const body = await res.json().catch(() => ({}));
                setComposeStatus(body.error || "Échec de l'envoi.");
            }
        } catch {
            setComposeStatus("Erreur réseau.");
        } finally {
            setComposeSending(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["PARENT", "STUDENT", "TEACHER", "DIRECTOR", "SCHOOL_ADMIN"]}
        >
            <PageShell className="max-w-6xl pb-12">
                <PageHeader
                    title={
                        data
                            ? `Cahier de liaison · ${data.student.firstName} ${data.student.lastName}`
                            : "Cahier de liaison"
                    }
                    description={
                        data
                            ? `${data.class?.name ?? "—"} · ${data.entries.length} entrées récentes · ${data.toSignCount} nécessitent votre signature`
                            : "Suivi des échanges école-famille"
                    }
                    breadcrumbs={
                        data
                            ? [
                                  { label: "Mes enfants" },
                                  {
                                      label: `${data.student.firstName} ${data.student.lastName}`,
                                  },
                                  { label: "Cahier de liaison" },
                              ]
                            : [
                                  { label: "Tableau de bord", href: "/dashboard" },
                                  { label: "Cahier de liaison" },
                              ]
                    }
                    actions={
                        data ? (
                            <Button icon="pencil">Mot au professeur</Button>
                        ) : null
                    }
                />

                {loading ? (
                    <PageLoading label="Chargement du cahier…" />
                ) : null}

                {error ? <PageError message={error} /> : null}

                {data && data.toSignCount > 0 ? (
                    <Card
                        padding={20}
                        style={{
                            background: "var(--eduflow-warning-50)",
                            border: "1px solid var(--eduflow-warning-200)",
                        }}
                    >
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: "var(--eduflow-warning-600)",
                                    display: "grid",
                                    placeItems: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <Icon name="pencil" size={22} color="#fff" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    className="eduflow-display"
                                    style={{
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: "var(--eduflow-warning-900)",
                                    }}
                                >
                                    {data.toSignCount} mot{data.toSignCount > 1 ? "s" : ""} à signer
                                </div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "var(--eduflow-warning-800)",
                                    }}
                                >
                                    Signature numérique · enregistrée dans le journal d'audit MEMP
                                </div>
                            </div>
                            <Button
                                style={{ background: "var(--eduflow-warning-600)" }}
                                onClick={() => setFilter("toSign")}
                            >
                                Voir les mots à signer
                            </Button>
                        </div>
                    </Card>
                ) : null}

                {data ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1.6fr 1fr",
                            gap: 14,
                        }}
                        className="liaison-grid"
                    >
                        <Card padding={0}>
                            <div
                                style={{
                                    padding: "12px 18px",
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
                                    Tout
                                </Chip>
                                <Chip
                                    active={filter === "toSign"}
                                    count={data.toSignCount}
                                    onClick={() => setFilter("toSign")}
                                >
                                    À signer
                                </Chip>
                                <Chip
                                    active={filter === "teacher"}
                                    onClick={() => setFilter("teacher")}
                                >
                                    Mots du prof
                                </Chip>
                                <Chip
                                    active={filter === "mine"}
                                    onClick={() => setFilter("mine")}
                                >
                                    Absences
                                </Chip>
                                <Chip
                                    active={filter === "documents"}
                                    onClick={() => setFilter("documents")}
                                >
                                    Sorties · documents
                                </Chip>
                            </div>
                            <div>
                                {filtered.length === 0 ? (
                                    <div
                                        style={{
                                            padding: "24px 18px",
                                            textAlign: "center",
                                            fontSize: 12,
                                            color: "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        Aucune entrée dans ce filtre.
                                    </div>
                                ) : (
                                    filtered.map((e, i) => (
                                        <div
                                            key={e.id}
                                            style={{
                                                padding: "14px 18px",
                                                borderTop:
                                                    i > 0
                                                        ? "1px solid var(--eduflow-border-subtle)"
                                                        : 0,
                                                background: !e.signed
                                                    ? "var(--eduflow-warning-50)"
                                                    : "transparent",
                                                display: "grid",
                                                gridTemplateColumns: "40px 1fr auto",
                                                gap: 14,
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <Avatar name={e.from} size="sm" />
                                            <div style={{ minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        marginBottom: 4,
                                                        flexWrap: "wrap",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {e.from}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        · {e.role}
                                                    </span>
                                                    <Badge variant={e.tagVariant} size="sm">
                                                        {e.tagLabel}
                                                    </Badge>
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        color:
                                                            "var(--eduflow-text-primary)",
                                                    }}
                                                >
                                                    {e.title}
                                                </div>
                                                <p
                                                    style={{
                                                        fontSize: 12,
                                                        color:
                                                            "var(--eduflow-text-secondary)",
                                                        margin: "4px 0 0",
                                                        lineHeight: 1.55,
                                                    }}
                                                >
                                                    {e.body}
                                                </p>
                                                <div
                                                    style={{
                                                        fontSize: 10,
                                                        color:
                                                            "var(--eduflow-text-tertiary)",
                                                        marginTop: 6,
                                                    }}
                                                >
                                                    {FR_DATE(e.date)}
                                                    {e.signed
                                                        ? " · ✓ signé numériquement"
                                                        : ""}
                                                </div>
                                            </div>
                                            {!e.signed && e.actionLabel ? (
                                                <Button size="sm">{e.actionLabel}</Button>
                                            ) : (
                                                <div />
                                            )}
                                        </div>
                                    ))
                                )}
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
                                    {data.student.firstName} · récap du mois
                                </SubLabel>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(2, 1fr)",
                                        gap: 10,
                                        marginTop: 10,
                                    }}
                                >
                                    <RecapTile
                                        label="Félicitations"
                                        value={data.recap.felicitations}
                                        tone="success"
                                    />
                                    <RecapTile
                                        label="Vigilances"
                                        value={data.recap.vigilances}
                                        tone="warning"
                                    />
                                    <RecapTile
                                        label="Documents"
                                        value={data.recap.documents}
                                        tone="info"
                                    />
                                    <RecapTile
                                        label="Sanctions"
                                        value={data.recap.sanctions}
                                        tone="danger"
                                    />
                                </div>
                            </Card>

                            <Card>
                                <SubLabel>Compose un mot</SubLabel>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                        marginTop: 8,
                                    }}
                                >
                                    <select
                                        value={composeTo}
                                        onChange={(e) => setComposeTo(e.target.value)}
                                        disabled={data.recipients.length === 0}
                                        style={{
                                            padding: "10px 14px",
                                            border: "1px solid var(--eduflow-border-default)",
                                            borderRadius: 10,
                                            fontSize: 13,
                                            fontFamily: "inherit",
                                            background: "var(--eduflow-surface-card)",
                                            color: "var(--eduflow-text-primary)",
                                        }}
                                    >
                                        {data.recipients.length === 0 ? (
                                            <option value="">
                                                Aucun destinataire disponible
                                            </option>
                                        ) : (
                                            data.recipients.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    Pour : {r.label}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                    <textarea
                                        placeholder="Écrire un mot…"
                                        rows={4}
                                        value={composeBody}
                                        onChange={(e) => setComposeBody(e.target.value)}
                                        style={{
                                            padding: 12,
                                            border: "1px solid var(--eduflow-border-default)",
                                            borderRadius: 10,
                                            fontSize: 13,
                                            fontFamily: "inherit",
                                            resize: "vertical",
                                            background: "var(--eduflow-surface-card)",
                                            color: "var(--eduflow-text-primary)",
                                        }}
                                    />
                                    <Button
                                        icon={composeSending ? undefined : "sms"}
                                        loading={composeSending}
                                        onClick={handleSend}
                                        disabled={
                                            !composeBody.trim() ||
                                            !composeTo ||
                                            composeSending
                                        }
                                        style={{ width: "100%" }}
                                    >
                                        Envoyer · signé numériquement
                                    </Button>
                                    {composeStatus ? (
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-secondary)",
                                                marginTop: 4,
                                            }}
                                        >
                                            {composeStatus}
                                        </div>
                                    ) : null}
                                </div>
                            </Card>
                        </div>
                    </div>
                ) : null}
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .liaison-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function RecapTile({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "success" | "warning" | "danger" | "info";
}) {
    return (
        <div
            style={{
                padding: 10,
                background: `var(--eduflow-${tone}-50)`,
                borderRadius: 10,
            }}
        >
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: `var(--eduflow-${tone}-700)`,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
            <div
                style={{
                    fontSize: 10,
                    color: `var(--eduflow-${tone}-800)`,
                    fontWeight: 600,
                }}
            >
                {label}
            </div>
        </div>
    );
}
