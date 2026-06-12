"use client";

import * as React from "react";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import Link from "next/link";

import { Badge, Button, Card, Chip, Icon } from "@/components/edu";
import { downloadClimateReport } from "@/lib/wellbeing/climate-report";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type ReportTag = "ANONYME" | "PARENT" | "ENSEIGNANT" | "AUTO_IA" | "NOMINATIF";
type ReportSeverity = "P0" | "P1" | "P2";
type ReportStatus = "OPEN" | "IN_REVIEW" | "IN_FOLLOWUP" | "CLOSED";

type ReportRow = {
    id: string;
    tag: ReportTag;
    category: string;
    excerpt: string;
    severity: ReportSeverity;
    severityLabel: string | null;
    status: ReportStatus;
    createdAt: string;
};

type PulseWeekRow = {
    weekLabel: string;
    value: number;
    isCurrent: boolean;
    responses: number;
};

type PulseStatRow = {
    label: string;
    value: number | null;
    key: "safety" | "friend" | "adult" | "harass";
};

type AppointmentRow = {
    id: string;
    startAt: string;
    durationMinutes: number;
    kind: string;
    anonymousLabel: string | null;
    variantHint: string | null;
    isUrgent: boolean;
};

type WellbeingOverview = {
    schoolId: string;
    kpis: {
        activeReports: number;
        reportsAnonymous: number;
        reportsNominative: number;
        psyAppointmentsThisWeek: number;
        climateScore: number | null;
        pulseResponses: number;
    };
    reports: ReportRow[];
    pulseWeeks: PulseWeekRow[];
    pulseStats: PulseStatRow[];
    appointments: AppointmentRow[];
};

const TAG_LABEL: Record<ReportTag, string> = {
    ANONYME: "ANONYME",
    PARENT: "PARENT",
    ENSEIGNANT: "ENSEIGNANT",
    AUTO_IA: "AUTO·IA",
    NOMINATIF: "NOMINATIF",
};

const TAG_VARIANT: Record<ReportTag, "neutral" | "brand" | "info"> = {
    ANONYME: "neutral",
    PARENT: "info",
    ENSEIGNANT: "info",
    AUTO_IA: "brand",
    NOMINATIF: "info",
};

const SEVERITY_TONE: Record<ReportSeverity, "danger" | "warning" | "info"> = {
    P0: "danger",
    P1: "warning",
    P2: "info",
};

const PULSE_STAT_TONE: Record<PulseStatRow["key"], "success" | "warning" | "danger"> = {
    safety: "success",
    friend: "success",
    adult: "warning",
    harass: "danger",
};

const FR_DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const FR_TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

function timeAgo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.round(hours / 24);
    if (days <= 1) return "hier";
    return `${days} jours`;
}

function appointmentVariant(a: AppointmentRow): "brand" | "info" | "warning" | "success" | "danger" {
    if (a.isUrgent) return "danger";
    const hint = a.variantHint;
    if (hint === "brand" || hint === "info" || hint === "warning" || hint === "success") {
        return hint;
    }
    return a.anonymousLabel ? "warning" : "brand";
}

export default function WellbeingPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <WellbeingPageContent />
        </PageGuard>
    );
}

function WellbeingPageContent() {
    const { data, error, isLoading } = useSWR<WellbeingOverview>(
        "/api/wellbeing/overview",
        fetcher,
        { revalidateOnFocus: false },
    );
    const { toast } = useToast();
    const [generatingPdf, setGeneratingPdf] = useState(false);

    const handleClimateReport = async () => {
        if (!data) return;
        setGeneratingPdf(true);
        try {
            await downloadClimateReport(data);
        } catch {
            toast({
                title: "Erreur",
                description: "La génération du rapport PDF a échoué.",
                variant: "destructive",
            });
        } finally {
            setGeneratingPdf(false);
        }
    };

    if (isLoading) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Cellule d'écoute & bien-être"
                    sub="Chargement…"
                    breadcrumb={["Vie scolaire", "Bien-être & cellule d'écoute"]}
                />
                <div
                    style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
                    className="kpi-grid"
                >
                    {[0, 1, 2, 3].map((i) => (
                        <Card key={i} padding={16} style={{ minHeight: 96 }}>
                            <div
                                className="animate-pulse"
                                style={{
                                    height: 32,
                                    width: 60,
                                    background: "var(--eduflow-neutral-200)",
                                    borderRadius: 4,
                                }}
                            />
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Cellule d'écoute & bien-être"
                    sub="Impossible de charger les données"
                    breadcrumb={["Vie scolaire", "Bien-être & cellule d'écoute"]}
                />
                <Card
                    padding={32}
                    style={{
                        background: "var(--eduflow-danger-50)",
                        border: "1px solid var(--eduflow-danger-200)",
                        textAlign: "center",
                    }}
                >
                    <Icon name="warning" size={28} color="var(--eduflow-danger-700)" />
                    <p style={{ fontSize: 13, color: "var(--eduflow-danger-800)", marginTop: 12 }}>
                        Le service bien-être est momentanément indisponible.
                    </p>
                </Card>
            </div>
        );
    }

    const hasData =
        data.reports.length > 0 ||
        data.pulseWeeks.length > 0 ||
        data.appointments.length > 0 ||
        data.kpis.activeReports > 0;

    return (
        <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
            <PageHeader
                greeting="Cellule d'écoute & bien-être"
                sub="Climat scolaire · signalements anonymes · suivi psychologique · prévention harcèlement"
                breadcrumb={["Vie scolaire", "Bien-être & cellule d'écoute"]}
                actions={
                    <>
                        <Badge variant="success" icon="check">
                            Conforme protocole MEMP 2024
                        </Badge>
                        <Button
                            variant="secondary"
                            icon="download"
                            disabled={generatingPdf}
                            onClick={handleClimateReport}
                        >
                            {generatingPdf ? "Génération…" : "Rapport climat"}
                        </Button>
                        <Link href="/dashboard/wellbeing/new">
                            <Button icon="plus">Nouveau dossier</Button>
                        </Link>
                    </>
                }
            />

            {!hasData ? (
                <EmptyWellbeingState />
            ) : (
                <>
                    <div
                        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
                        className="kpi-grid"
                    >
                        <Kpi
                            label="Signalements actifs"
                            value={String(data.kpis.activeReports)}
                            hint={`${data.kpis.reportsAnonymous} anonymes · ${data.kpis.reportsNominative} nominatifs`}
                            tone="warning"
                        />
                        <Kpi
                            label="Audiences cette sem."
                            value={String(data.kpis.psyAppointmentsThisWeek)}
                            hint="Total RDV 7 derniers jours"
                            tone="info"
                        />
                        <Kpi
                            label="Climat scolaire"
                            value={
                                data.kpis.climateScore != null
                                    ? data.kpis.climateScore.toFixed(1).replace(".", ",")
                                    : "—"
                            }
                            unit="/10"
                            hint={
                                data.kpis.pulseResponses > 0
                                    ? `Pulse anonyme · ${data.kpis.pulseResponses} réponses`
                                    : "Pulse non démarré"
                            }
                            tone="success"
                        />
                        <Kpi
                            label="Pulse hebdo"
                            value={data.pulseWeeks.length > 0 ? `${data.pulseWeeks.length} sem.` : "—"}
                            hint="Historique disponible"
                            tone="brand"
                        />
                    </div>

                    <div
                        style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}
                        className="wb-grid"
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <ReportsCard reports={data.reports} />
                            <ClimatePulseCard
                                weeks={data.pulseWeeks}
                                stats={data.pulseStats}
                            />
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <SosCard />
                            <AgendaCard appointments={data.appointments} />
                            <AiSignalsCard />
                        </div>
                    </div>
                </>
            )}

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .wb-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}

function EmptyWellbeingState() {
    return (
        <Card
            padding={40}
            style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minHeight: 360,
                justifyContent: "center",
            }}
        >
            <div
                style={{
                    width: 80,
                    height: 80,
                    borderRadius: 24,
                    background: "var(--brand-50)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 18,
                }}
            >
                <Icon name="sparkle" size={36} color="var(--brand-700)" />
            </div>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 8px" }}>
                Cellule d&apos;écoute prête à démarrer
            </h3>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    maxWidth: 420,
                    lineHeight: 1.55,
                    margin: 0,
                }}
            >
                Aucun signalement ni pulse climat enregistré pour le moment. Les enseignants,
                parents et élèves pourront déposer un signalement (anonyme ou nominatif) qui
                apparaîtra ici, triés par sévérité P0/P1/P2.
            </p>
        </Card>
    );
}

function Kpi({
    label,
    value,
    unit,
    hint,
    tone = "brand",
}: {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
    tone?: "brand" | "info" | "success" | "warning" | "danger";
}) {
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 14,
                background: `var(--${tone}-50)`,
                border: `1px solid var(--${tone}-200)`,
            }}
        >
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: `var(--${tone}-700)`,
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: `var(--${tone}-900)`,
                    marginTop: 4,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
                {unit ? (
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: `var(--${tone}-700)`,
                            marginLeft: 4,
                        }}
                    >
                        {unit}
                    </span>
                ) : null}
            </div>
            {hint ? (
                <div
                    style={{
                        fontSize: 11,
                        color: `var(--${tone}-800)`,
                        marginTop: 6,
                        lineHeight: 1.5,
                    }}
                >
                    {hint}
                </div>
            ) : null}
        </div>
    );
}

function ReportsCard({ reports }: { reports: ReportRow[] }) {
    return (
        <Card padding={0}>
            <div
                style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                }}
            >
                <div>
                    <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                        Signalements récents · cellule d&apos;écoute
                    </h3>
                    <p
                        style={{
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            margin: "2px 0 0",
                        }}
                    >
                        Chiffrés bout-en-bout · accès psychologue + direction
                    </p>
                </div>
                <Chip active>Tous · {reports.length}</Chip>
            </div>
            {reports.length === 0 ? (
                <div
                    style={{
                        padding: "32px 18px",
                        textAlign: "center",
                        fontSize: 13,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    Aucun signalement actif.
                </div>
            ) : (
                reports.map((r, i) => {
                    const tone = SEVERITY_TONE[r.severity];
                    const tagLabel = TAG_LABEL[r.tag];
                    const tagVariant = TAG_VARIANT[r.tag];
                    return (
                        <div
                            key={r.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "92px 1fr auto",
                                gap: 14,
                                padding: "14px 18px",
                                borderTop:
                                    i > 0 ? "1px solid var(--border-subtle)" : 0,
                                alignItems: "center",
                                background:
                                    r.severity === "P0"
                                        ? "var(--danger-50)"
                                        : "transparent",
                            }}
                        >
                            <Badge variant={tagVariant} size="sm">
                                {tagLabel}
                            </Badge>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>
                                    {r.category}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--text-secondary)",
                                        marginTop: 2,
                                    }}
                                >
                                    « {r.excerpt} »
                                </div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: "var(--text-tertiary)",
                                        marginTop: 2,
                                    }}
                                >
                                    {timeAgo(r.createdAt)}
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
                                <Badge variant={tone} size="sm" dot={r.severity === "P0"}>
                                    {r.severityLabel ?? r.severity}
                                </Badge>
                                <Link href={`/dashboard/wellbeing/${r.id}`}>
                                    <Button variant="ghost" size="sm" iconRight="arrowRight">
                                        Dossier
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    );
                })
            )}
        </Card>
    );
}

function ClimatePulseCard({
    weeks,
    stats,
}: {
    weeks: PulseWeekRow[];
    stats: PulseStatRow[];
}) {
    return (
        <Card padding={20}>
            <SubLabel>Climat scolaire · pulse anonyme hebdomadaire</SubLabel>
            {weeks.length === 0 ? (
                <p
                    style={{
                        fontSize: 12,
                        color: "var(--eduflow-text-tertiary)",
                        marginTop: 12,
                    }}
                >
                    Aucune semaine enregistrée. Le pulse démarre dès que les élèves répondent
                    au questionnaire hebdomadaire (5 questions, 60 secondes).
                </p>
            ) : (
                <>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "space-between",
                            marginTop: 14,
                            height: 130,
                            gap: 8,
                        }}
                    >
                        {weeks.map((b) => (
                            <div
                                key={b.weekLabel}
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <div
                                    className="tabular"
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: b.isCurrent
                                            ? "var(--success-700)"
                                            : "var(--text-secondary)",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {b.value.toFixed(1).replace(".", ",")}
                                </div>
                                <div
                                    aria-hidden
                                    style={{
                                        width: "100%",
                                        maxWidth: 36,
                                        height: `${Math.max(8, b.value * 12)}px`,
                                        borderRadius: 6,
                                        background: b.isCurrent
                                            ? "var(--success-600)"
                                            : "var(--success-200)",
                                    }}
                                />
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: "var(--text-tertiary)",
                                    }}
                                >
                                    {b.weekLabel}
                                </div>
                            </div>
                        ))}
                    </div>
                    {stats.length > 0 ? (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: 10,
                                marginTop: 18,
                                paddingTop: 14,
                                borderTop: "1px solid var(--border-subtle)",
                            }}
                        >
                            {stats.map((s) => {
                                const tone = PULSE_STAT_TONE[s.key];
                                return (
                                    <div key={s.key}>
                                        <div
                                            className="eduflow-display tabular"
                                            style={{
                                                fontSize: 22,
                                                fontWeight: 800,
                                                color: `var(--${tone}-700)`,
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {s.value != null
                                                ? `${Math.round(s.value)}%`
                                                : "—"}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--text-secondary)",
                                                marginTop: 2,
                                            }}
                                        >
                                            {s.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </>
            )}
        </Card>
    );
}

function SosCard() {
    return (
        <Card
            padding={20}
            style={{
                background:
                    "linear-gradient(135deg, var(--brand-700), var(--brand-accent-600))",
                color: "#fff",
                border: 0,
            }}
        >
            <div
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    opacity: 0.8,
                }}
            >
                Bouton SOS · accès élève
            </div>
            <div
                className="eduflow-display"
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 6,
                    lineHeight: 1.2,
                }}
            >
                « Je veux parler à quelqu&apos;un »
            </div>
            <p
                style={{
                    fontSize: 12,
                    opacity: 0.9,
                    marginTop: 10,
                    lineHeight: 1.6,
                }}
            >
                Bouton permanent dans l&apos;app élève · ouvre un canal direct chiffré avec
                le psychologue. Anonyme par défaut, le jeune décide à quel moment se nommer.
            </p>
            <p
                style={{
                    fontSize: 11,
                    opacity: 0.7,
                    marginTop: 14,
                    lineHeight: 1.6,
                }}
            >
                Activation : nécessite le rôle PSY assigné et le chiffrement bout-en-bout
                provisionné.
            </p>
        </Card>
    );
}

function AgendaCard({ appointments }: { appointments: AppointmentRow[] }) {
    return (
        <Card padding={0}>
            <div
                style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                }}
            >
                <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                    Agenda psychologue · 7 prochains jours
                </h3>
                <p
                    style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        margin: "2px 0 0",
                    }}
                >
                    {appointments.length} créneau{appointments.length > 1 ? "x" : ""} réservé
                    {appointments.length > 1 ? "s" : ""}
                </p>
            </div>
            {appointments.length === 0 ? (
                <div
                    style={{
                        padding: "24px 18px",
                        textAlign: "center",
                        fontSize: 13,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    Aucun rendez-vous planifié.
                </div>
            ) : (
                appointments.slice(0, 6).map((r, i) => {
                    const date = new Date(r.startAt);
                    const variant = appointmentVariant(r);
                    return (
                        <div
                            key={r.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "40px 1fr auto",
                                gap: 12,
                                padding: "10px 18px",
                                borderTop:
                                    i > 0 ? "1px solid var(--border-subtle)" : 0,
                                alignItems: "center",
                            }}
                        >
                            <div style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: "var(--text-tertiary)",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {FR_DAY.format(date).replace(".", "")}
                                </div>
                                <div
                                    className="tabular"
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {FR_TIME.format(date)}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>
                                    {r.anonymousLabel ?? "Élève"}
                                </div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: "var(--text-tertiary)",
                                    }}
                                >
                                    {r.kind}
                                </div>
                            </div>
                            <Badge
                                variant={variant}
                                size="sm"
                                dot={variant === "danger"}
                            >
                                {variant === "danger" ? "P0" : "OK"}
                            </Badge>
                        </div>
                    );
                })
            )}
        </Card>
    );
}

function AiSignalsCard() {
    return (
        <Card
            padding={16}
            style={{
                background: "var(--brand-50)",
                border: "1px solid var(--brand-200)",
            }}
        >
            <div style={{ display: "flex", gap: 10 }}>
                <Icon
                    name="sparkle"
                    size={18}
                    color="var(--brand-700)"
                    style={{ marginTop: 2 }}
                />
                <div>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--brand-900)",
                        }}
                    >
                        Détection IA · signaux faibles
                    </div>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--brand-800)",
                            margin: "4px 0 0",
                            lineHeight: 1.55,
                        }}
                    >
                        Croisement absences + chute notes + commentaires enseignants → alerte
                        si pattern de décrochage. Modèle entraîné sur 8 000 trajectoires
                        anonymisées.
                    </p>
                    <p
                        style={{
                            fontSize: 11,
                            color: "var(--brand-700)",
                            marginTop: 8,
                            fontWeight: 600,
                        }}
                    >
                        Module IA à activer côté infra → les rapports {`AUTO_IA`} apparaissent
                        ici une fois branché.
                    </p>
                </div>
            </div>
        </Card>
    );
}
