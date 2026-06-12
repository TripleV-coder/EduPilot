"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type ReportDetail = {
    id: string;
    tag: "ANONYME" | "PARENT" | "ENSEIGNANT" | "AUTO_IA" | "NOMINATIF";
    category: string;
    excerpt: string;
    severity: "P0" | "P1" | "P2";
    severityLabel: string | null;
    status: "OPEN" | "IN_REVIEW" | "IN_FOLLOWUP" | "CLOSED";
    createdAt: string;
    updatedAt: string;
    reporterLabel: string | null;
    reporterRole: string | null;
    reportedAboutLabel: string | null;
    appointments: Array<{
        id: string;
        startAt: string;
        durationMinutes: number;
        kind: string;
        isUrgent: boolean;
    }>;
};

const STATUS_FLOW: Array<{
    value: ReportDetail["status"];
    label: string;
    hint: string;
    variant: "warning" | "brand" | "info" | "success";
}> = [
    { value: "OPEN", label: "Ouvert", hint: "Signalement reçu, non traité", variant: "warning" },
    { value: "IN_REVIEW", label: "En examen", hint: "La cellule analyse le dossier", variant: "brand" },
    { value: "IN_FOLLOWUP", label: "Suivi actif", hint: "Accompagnement en cours", variant: "info" },
    { value: "CLOSED", label: "Clôturé", hint: "Situation résolue ou transférée", variant: "success" },
];

const SEVERITY_VARIANT: Record<ReportDetail["severity"], "danger" | "warning" | "info"> = {
    P0: "danger",
    P1: "warning",
    P2: "info",
};

const TAG_VARIANT: Record<ReportDetail["tag"], "neutral" | "info" | "brand"> = {
    ANONYME: "neutral",
    PARENT: "info",
    ENSEIGNANT: "info",
    AUTO_IA: "brand",
    NOMINATIF: "info",
};

const FR_DATETIME = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
});

export default function WellbeingReportPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <WellbeingReportContent />
        </PageGuard>
    );
}

function WellbeingReportContent() {
    const params = useParams<{ reportId: string }>();
    const router = useRouter();
    const { data, error, isLoading, mutate } = useSWR<ReportDetail>(
        params?.reportId ? `/api/wellbeing/reports/${params.reportId}` : null,
        fetcher,
        { revalidateOnFocus: false },
    );
    const [updating, setUpdating] = React.useState<string | null>(null);

    async function setStatus(status: ReportDetail["status"]) {
        if (!data) return;
        setUpdating(status);
        try {
            const res = await fetch(`/api/wellbeing/reports/${data.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) await mutate();
        } finally {
            setUpdating(null);
        }
    }

    if (isLoading) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-4xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Dossier d'écoute"
                    sub="Chargement…"
                    breadcrumb={["Vie scolaire", "Bien-être", "Dossier"]}
                />
                <Card padding={24} style={{ minHeight: 280 }}>
                    <div
                        className="animate-pulse"
                        style={{
                            height: 20,
                            width: "50%",
                            background: "var(--eduflow-neutral-200)",
                            borderRadius: 6,
                        }}
                    />
                </Card>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-4xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Dossier introuvable"
                    breadcrumb={["Vie scolaire", "Bien-être"]}
                />
                <Card padding={24}>
                    <p style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                        Ce dossier n&apos;existe pas ou son accès est restreint.
                    </p>
                    <Button
                        variant="secondary"
                        icon="chevron"
                        onClick={() => router.push("/dashboard/wellbeing")}
                        style={{ marginTop: 12 }}
                    >
                        Retour à la cellule d&apos;écoute
                    </Button>
                </Card>
            </div>
        );
    }

    const currentStep = STATUS_FLOW.findIndex((s) => s.value === data.status);

    return (
        <div className="eduflow-scope mx-auto flex max-w-4xl flex-col gap-4 pb-12">
            <PageHeader
                greeting={`Dossier · ${data.category}`}
                sub={`Ouvert le ${FR_DATETIME.format(new Date(data.createdAt))}`}
                breadcrumb={["Vie scolaire", "Bien-être", "Dossier"]}
                actions={
                    <>
                        <Badge variant={TAG_VARIANT[data.tag]}>{data.tag.replace("_", "·")}</Badge>
                        <Badge variant={SEVERITY_VARIANT[data.severity]} dot={data.severity === "P0"}>
                            {data.severityLabel ?? data.severity}
                        </Badge>
                    </>
                }
            />

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Contenu du signalement */}
                    <Card
                        padding={24}
                        style={
                            data.severity === "P0"
                                ? {
                                      background: "var(--eduflow-danger-50)",
                                      border: "1px solid var(--eduflow-danger-200)",
                                  }
                                : undefined
                        }
                    >
                        <SubLabel>Signalement</SubLabel>
                        <p
                            style={{
                                fontSize: 15,
                                lineHeight: 1.7,
                                margin: "12px 0 0",
                                fontStyle: "italic",
                                color: "var(--eduflow-text-primary)",
                            }}
                        >
                            &laquo;&nbsp;{data.excerpt}&nbsp;&raquo;
                        </p>
                        <div
                            style={{
                                display: "flex",
                                gap: 16,
                                marginTop: 16,
                                paddingTop: 14,
                                borderTop: "1px solid var(--eduflow-border-subtle)",
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                flexWrap: "wrap",
                            }}
                        >
                            <span>
                                <strong>Déclarant :</strong>{" "}
                                {data.reporterLabel ?? "Anonyme (aucun lien conservé)"}
                            </span>
                            {data.reportedAboutLabel ? (
                                <span>
                                    <strong>Élève concerné :</strong> {data.reportedAboutLabel}
                                </span>
                            ) : null}
                        </div>
                    </Card>

                    {/* Suivi psy lié */}
                    <Card padding={0}>
                        <div
                            style={{
                                padding: "14px 18px",
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                            }}
                        >
                            <h3 className="eduflow-display" style={{ fontSize: 15, margin: 0 }}>
                                Rendez-vous psychologue liés
                            </h3>
                        </div>
                        {data.appointments.length === 0 ? (
                            <p
                                style={{
                                    padding: 18,
                                    fontSize: 12,
                                    color: "var(--eduflow-text-tertiary)",
                                }}
                            >
                                Aucun rendez-vous lié — planifiez-en un depuis l&apos;agenda de la
                                cellule.
                            </p>
                        ) : (
                            data.appointments.map((a, i) => (
                                <div
                                    key={a.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "28px 1fr auto",
                                        gap: 12,
                                        padding: "10px 18px",
                                        borderTop: i ? "1px solid var(--eduflow-border-subtle)" : 0,
                                        alignItems: "center",
                                    }}
                                >
                                    <Icon
                                        name="calendar"
                                        size={16}
                                        color="var(--eduflow-text-tertiary)"
                                    />
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600 }}>{a.kind}</div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {FR_DATETIME.format(new Date(a.startAt))} ·{" "}
                                            {a.durationMinutes} min
                                        </div>
                                    </div>
                                    {a.isUrgent ? (
                                        <Badge variant="danger" size="sm" dot>
                                            Urgent
                                        </Badge>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </Card>
                </div>

                {/* Workflow de traitement */}
                <Card padding={20}>
                    <SubLabel>Traitement du dossier</SubLabel>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginTop: 12,
                        }}
                    >
                        {STATUS_FLOW.map((s, i) => {
                            const isCurrent = data.status === s.value;
                            const isPast = i < currentStep;
                            return (
                                <button
                                    key={s.value}
                                    type="button"
                                    disabled={isCurrent || updating !== null}
                                    onClick={() => setStatus(s.value)}
                                    aria-pressed={isCurrent}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "24px 1fr",
                                        gap: 10,
                                        alignItems: "center",
                                        textAlign: "left",
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: isCurrent
                                            ? "2px solid var(--brand-600)"
                                            : "1px solid var(--eduflow-border-default)",
                                        background: isCurrent
                                            ? "var(--brand-50)"
                                            : "var(--eduflow-surface-card)",
                                        cursor: isCurrent ? "default" : "pointer",
                                        opacity: updating && updating !== s.value ? 0.6 : 1,
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <span
                                        aria-hidden
                                        style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: "50%",
                                            display: "grid",
                                            placeItems: "center",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            background: isCurrent
                                                ? "var(--brand-600)"
                                                : isPast
                                                  ? "var(--eduflow-success-600)"
                                                  : "var(--eduflow-neutral-200)",
                                            color:
                                                isCurrent || isPast
                                                    ? "#fff"
                                                    : "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        {isPast ? "✓" : i + 1}
                                    </span>
                                    <span>
                                        <span
                                            style={{
                                                display: "block",
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: isCurrent
                                                    ? "var(--brand-800)"
                                                    : "var(--eduflow-text-primary)",
                                            }}
                                        >
                                            {s.label}
                                            {updating === s.value ? "…" : ""}
                                        </span>
                                        <span
                                            style={{
                                                display: "block",
                                                fontSize: 10,
                                                color: "var(--eduflow-text-tertiary)",
                                                marginTop: 2,
                                            }}
                                        >
                                            {s.hint}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div
                        style={{
                            marginTop: 16,
                            padding: 12,
                            borderRadius: 10,
                            background: "var(--eduflow-surface-sunken)",
                            fontSize: 11,
                            lineHeight: 1.55,
                            color: "var(--eduflow-text-secondary)",
                        }}
                    >
                        <strong>Rappel protocole MEMP :</strong> tout dossier P0 « Risque
                        vital » ou « Protection enfance » doit être transmis au CPS sous
                        24h, même s&apos;il est traité en interne.
                    </div>
                </Card>
            </div>
        </div>
    );
}
