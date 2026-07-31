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
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading } from "@/components/layout/page-states";

type ChannelStatus = {
    connected: boolean;
    verifiedAt: string | null;
    phoneNumber: string | null;
    subscribers: number | null;
    weeklyMessages: number | null;
    readRate: number | null;
    costPerMessage: number | null;
};

type WhatsAppTemplate = {
    id: string;
    title: string;
    subtitle: string;
    sentCount: number | null;
    accent: "warning" | "danger" | "success" | "brand" | "info";
};

const TEMPLATES: WhatsAppTemplate[] = [
    {
        id: "fee-reminder",
        title: "Rappel paiement scolarité",
        subtitle: "Auto · 7j avant échéance · multi-canal",
        sentCount: null,
        accent: "warning",
    },
    {
        id: "absence-notify",
        title: "Notification absence enfant",
        subtitle: "Auto · le jour même · 98% lecture cible",
        sentCount: null,
        accent: "danger",
    },
    {
        id: "payment-confirm",
        title: "Confirmation paiement reçu",
        subtitle: "Auto · instantané",
        sentCount: null,
        accent: "success",
    },
    {
        id: "bulletin-available",
        title: "Bulletin trimestriel disponible",
        subtitle: "Auto · fin de trimestre",
        sentCount: null,
        accent: "brand",
    },
    {
        id: "council-invite",
        title: "Invitation conseil parents-prof",
        subtitle: "Manuel · ciblé par classe",
        sentCount: null,
        accent: "info",
    },
];

const CHANNEL_COMPARISON: {
    label: string;
    rate: number;
    sub: string;
    color: "success" | "brand" | "info";
}[] = [
    {
        label: "WhatsApp",
        rate: 98,
        sub: "Coût indicatif 12 FCFA/msg · BJ",
        color: "success",
    },
    { label: "SMS", rate: 94, sub: "Coût indicatif 25 FCFA/msg · BJ", color: "brand" },
    { label: "Email", rate: 32, sub: "Gratuit · réception variable", color: "info" },
    { label: "App push", rate: 88, sub: "Gratuit · installation requise", color: "success" },
];

export default function WhatsAppPage() {
    const [status, setStatus] = useState<ChannelStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/integrations/whatsapp")
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data: ChannelStatus) => setStatus(data))
            .catch(() =>
                setStatus({
                    connected: false,
                    verifiedAt: null,
                    phoneNumber: null,
                    subscribers: null,
                    weeklyMessages: null,
                    readRate: null,
                    costPerMessage: null,
                })
            )
            .finally(() => setLoading(false));
    }, []);

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="WhatsApp Business · canal #1 au Bénin"
                    description={
                        status?.connected
                            ? `Activé · numéro vérifié ${status.phoneNumber} · ${status.subscribers ?? "?"} parents abonnés`
                            : "Module à activer · META Business API non encore connecté"
                    }
                    breadcrumbs={[
                        { label: "Communication" },
                        { label: "Canaux" },
                        { label: "WhatsApp Business" },
                    ]}
                    actions={
                        <>
                            {status?.connected ? (
                                <Badge variant="success" icon="check">
                                    Vérifié META
                                </Badge>
                            ) : (
                                <Badge variant="neutral">À configurer</Badge>
                            )}
                            <Link
                                href="/dashboard/settings/notifications"
                                style={{ textDecoration: "none" }}
                            >
                                <Button variant="secondary" icon="settings">
                                    Paramètres
                                </Button>
                            </Link>
                            <Button icon="sparkle" disabled={!status?.connected}>
                                Diffuser un message
                            </Button>
                        </>
                    }
                />

                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Vérification du statut META Business…
                        </span>
                    </div>
                ) : null}

                {!loading && status ? (
                    <>
                        {!status.connected ? (
                            <Card
                                padding={20}
                                style={{
                                    background: "var(--brand-50)",
                                    border: "1px solid var(--brand-200)",
                                }}
                            >
                                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                                    <div
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 12,
                                            background: "var(--brand-600)",
                                            display: "grid",
                                            placeItems: "center",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon name="sms" size={22} color="#fff" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            className="eduflow-display"
                                            style={{
                                                fontSize: 18,
                                                fontWeight: 700,
                                                color: "var(--brand-900, var(--brand-800))",
                                            }}
                                        >
                                            Connecte ton compte WhatsApp Business
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                color: "var(--brand-800)",
                                                lineHeight: 1.6,
                                                marginTop: 4,
                                            }}
                                        >
                                            Activer la WhatsApp Business API te permet d'envoyer rappels paiements, alertes absences, et bulletins directement sur le canal #1 utilisé par les parents au Bénin (98% taux de lecture, contre 32% sur email). Tu dois passer par un BSP (Twilio, 360dialog, Vonage…) ou directement Meta Cloud API.
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                marginTop: 14,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <Button icon="sparkle">Démarrer la vérification</Button>
                                            <Button variant="secondary" icon="info">
                                                Documentation Meta
                                            </Button>
                                        </div>
                                    </div>
                                </div>
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
                                label="Parents abonnés"
                                value={status.subscribers !== null ? String(status.subscribers) : "—"}
                                icon="users"
                                variant={status.connected ? "success" : "neutral"}
                            />
                            <MetricCard
                                label="Taux de lecture"
                                value={
                                    status.readRate !== null ? String(status.readRate) : "—"
                                }
                                unit={status.readRate !== null ? "%" : undefined}
                                icon="check"
                                variant={status.connected ? "success" : "neutral"}
                            />
                            <MetricCard
                                label="Messages / sem."
                                value={
                                    status.weeklyMessages !== null
                                        ? String(status.weeklyMessages)
                                        : "—"
                                }
                                icon="sms"
                                variant={status.connected ? "brand" : "neutral"}
                            />
                            <MetricCard
                                label="Coût / msg"
                                value={
                                    status.costPerMessage !== null
                                        ? String(status.costPerMessage)
                                        : "—"
                                }
                                unit={status.costPerMessage !== null ? "FCFA" : undefined}
                                icon="money"
                                variant={status.connected ? "info" : "neutral"}
                            />
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1.4fr 1fr",
                                gap: 14,
                            }}
                            className="wa-grid"
                        >
                            <Card padding={0}>
                                <div
                                    style={{
                                        padding: "14px 18px",
                                        borderBottom:
                                            "1px solid var(--eduflow-border-subtle)",
                                    }}
                                >
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Modèles WhatsApp · {TEMPLATES.length} pré-écrits
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            margin: "2px 0 0",
                                        }}
                                    >
                                        Ces modèles seront soumis à validation Meta dès que ton compte est connecté.
                                    </p>
                                </div>
                                {TEMPLATES.map((t, i) => (
                                    <div
                                        key={t.id}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "44px 1fr auto auto",
                                            gap: 14,
                                            padding: "14px 18px",
                                            borderTop:
                                                i > 0
                                                    ? "1px solid var(--eduflow-border-subtle)"
                                                    : 0,
                                            alignItems: "center",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 10,
                                                background: `var(--eduflow-${t.accent}-50)`,
                                                display: "grid",
                                                placeItems: "center",
                                            }}
                                        >
                                            <Icon
                                                name="sms"
                                                size={16}
                                                color={`var(--eduflow-${t.accent}-700)`}
                                            />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                {t.title}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color:
                                                        "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                {t.subtitle}
                                            </div>
                                        </div>
                                        <span
                                            className="tabular"
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color:
                                                    "var(--eduflow-text-secondary)",
                                                fontVariantNumeric: "tabular-nums",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {t.sentCount !== null
                                                ? `${t.sentCount} env.`
                                                : "—"}
                                        </span>
                                        <Link
                                            href="/dashboard/notifications/sms"
                                            style={{ textDecoration: "none" }}
                                        >
                                            <Button variant="ghost" size="sm">
                                                Éditer
                                            </Button>
                                        </Link>
                                    </div>
                                ))}
                            </Card>

                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 14,
                                }}
                            >
                                {/* Faux phone preview */}
                                <Card
                                    padding={0}
                                    style={{
                                        background: "#075E54",
                                        color: "#fff",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: "14px 16px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <Avatar name="EduPilot School" size="sm" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                EduPilot School{" "}
                                                <span style={{ marginLeft: 4 }}>✓</span>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    opacity: 0.85,
                                                }}
                                            >
                                                {status.connected
                                                    ? "en ligne · compte vérifié"
                                                    : "aperçu · compte non vérifié"}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            background: "#E5DDD5",
                                            padding: 14,
                                            minHeight: 260,
                                            color: "#111",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                alignSelf: "flex-start",
                                                maxWidth: "85%",
                                                background: "#fff",
                                                padding: "8px 12px",
                                                borderRadius: 12,
                                                borderTopLeftRadius: 2,
                                                fontSize: 12,
                                                lineHeight: 1.55,
                                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--brand-700)",
                                                    fontWeight: 700,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                📚 EduPilot School
                                            </div>
                                            Bonjour Patrick, le paiement de scolarité d'
                                            <strong>Aïcha</strong> (3ᵉ A) arrive à échéance le{" "}
                                            <strong>11 mai</strong>.
                                            <br />
                                            <br />
                                            Montant : <strong>125 000 FCFA</strong>
                                            <br />
                                            Mode : MTN · Moov · carte
                                            <br />
                                            <br />
                                            👉 Payez en 30 sec :<br />
                                            <span style={{ color: "#007AFF" }}>
                                                edupilot.bj/p/A0142
                                            </span>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "#888",
                                                    textAlign: "right",
                                                    marginTop: 6,
                                                }}
                                            >
                                                14:32 ✓✓
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                alignSelf: "flex-end",
                                                maxWidth: "70%",
                                                background: "#DCF8C6",
                                                padding: "8px 12px",
                                                borderRadius: 12,
                                                borderTopRightRadius: 2,
                                                fontSize: 12,
                                                lineHeight: 1.55,
                                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                            }}
                                        >
                                            Payé ! Merci 🙏
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "#888",
                                                    textAlign: "right",
                                                    marginTop: 4,
                                                }}
                                            >
                                                14:34 ✓✓
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                alignSelf: "flex-start",
                                                maxWidth: "85%",
                                                background: "#fff",
                                                padding: "8px 12px",
                                                borderRadius: 12,
                                                borderTopLeftRadius: 2,
                                                fontSize: 12,
                                                lineHeight: 1.55,
                                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--brand-700)",
                                                    fontWeight: 700,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                📚 EduPilot School
                                            </div>
                                            ✅ Paiement reçu — reçu Flutterwave #FLW-882104. Merci !
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "#888",
                                                    textAlign: "right",
                                                    marginTop: 4,
                                                }}
                                            >
                                                14:34 ✓✓
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card>
                                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--eduflow-text-tertiary)" }}>Comparaison canaux · indicatif</p>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10,
                                            marginTop: 8,
                                        }}
                                    >
                                        {CHANNEL_COMPARISON.map((c) => (
                                            <div
                                                key={c.label}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 10,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 64,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {c.label}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            height: 6,
                                                            background:
                                                                "var(--eduflow-neutral-200)",
                                                            borderRadius: 3,
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                height: "100%",
                                                                width: `${c.rate}%`,
                                                                background: `var(--eduflow-${c.color}-600)`,
                                                            }}
                                                        />
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {c.sub}
                                                    </div>
                                                </div>
                                                <span
                                                    className="tabular"
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        color: `var(--eduflow-${c.color}-700)`,
                                                        width: 40,
                                                        textAlign: "right",
                                                        fontVariantNumeric: "tabular-nums",
                                                    }}
                                                >
                                                    {c.rate}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 10,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 12,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        Indicatif marché Bénin · les valeurs réelles seront calculées une fois ton compte WhatsApp Business connecté et l'historique d'envois disponible.
                                    </p>
                                </Card>
                            </div>
                        </div>
                    </>
                ) : null}
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .wa-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
