"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
        subtitle: "Auto · le jour même",
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

const CHANNEL_GUIDANCE: {
    label: string;
    sub: string;
}[] = [
    {
        label: "WhatsApp",
        sub: "Canal principal parents · coût et taux de lecture mesurés après connexion Business",
    },
    {
        label: "SMS",
        sub: "Secours hors data · tarification opérateur locale",
    },
    {
        label: "Email",
        sub: "Gratuit · utile pour pièces jointes (bulletins, reçus)",
    },
    {
        label: "App push",
        sub: "Gratuit · nécessite l'application installée",
    },
];

export default function WhatsAppPage() {
    // Garde avant chargement (TD-024) : aucune requête tant que le rôle n'est pas admis.
    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]} >
            <WhatsAppPageContent />
        </PageGuard>
    );
}

function WhatsAppPageContent() {
    const [status, setStatus] = useState<ChannelStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [broadcastOpen, setBroadcastOpen] = useState(false);

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
        <>
            <PageShell>
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
                            <Button icon="sparkle" disabled={!status?.connected} onClick={() => setBroadcastOpen(true)}>
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
                                                fontSize: 16,
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
                                            L&apos;envoi passe par l&apos;API Meta Cloud (WhatsApp Business). L&apos;équipe technique d&apos;EduPilot doit renseigner le numéro WhatsApp Business, son jeton d&apos;accès et un modèle de message approuvé par Meta ; le bouton « Diffuser un message » s&apos;active ensuite. Les numéros des familles sont transmis à Meta pour l&apos;envoi.
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                marginTop: 14,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <a
                                                href="https://developers.facebook.com/docs/whatsapp/cloud-api"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-semibold"
                                                style={{ color: "var(--brand-700)" }}
                                            >
                                                Documentation Meta (WhatsApp Cloud API) ↗
                                            </a>
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
                                    <h2
                                        className="eduflow-display"
                                        style={{ fontSize: 16, margin: 0 }}
                                    >
                                        Modèles WhatsApp · {TEMPLATES.length} pré-écrits
                                    </h2>
                                    <p
                                        style={{
                                            fontSize: 12,
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
                                                    fontSize: 12,
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
                                                    fontSize: 12,
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
                                                    fontSize: 12,
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
                                            <span style={{ color: "#0062CC" }}>
                                                edupilot.bj/p/A0142
                                            </span>
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "#666",
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
                                                    fontSize: 12,
                                                    color: "#666",
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
                                                    fontSize: 12,
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
                                                    fontSize: 12,
                                                    color: "#666",
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
                                    <p className="mb-2.5 text-xs font-semibold" style={{ color: "var(--eduflow-text-tertiary)" }}>Canaux disponibles</p>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 10,
                                            marginTop: 8,
                                        }}
                                    >
                                        {CHANNEL_GUIDANCE.map((c) => (
                                            <div
                                                key={c.label}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "flex-start",
                                                    gap: 10,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 72,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        paddingTop: 1,
                                                    }}
                                                >
                                                    {c.label}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: "var(--eduflow-text-secondary)",
                                                            lineHeight: 1.45,
                                                        }}
                                                    >
                                                        {c.sub}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: "var(--eduflow-text-tertiary)",
                                            marginTop: 12,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        Les taux de lecture et coûts réels s&apos;afficheront ici dès que le compte WhatsApp Business est connecté et que l&apos;historique d&apos;envois est disponible.
                                    </p>
                                </Card>
                            </div>
                        </div>
                    </>
                ) : null}
                <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .wa-grid {
                        grid-template-columns: minmax(0, 1fr) !important;
                    }
                }
            `}</style>
        </>
    );
}

type ClassOption = { id: string; name: string };

/** Message aux familles (POST /api/whatsapp/broadcast). */
function BroadcastDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const { data: classesData } = useSWR<{ data?: ClassOption[] } | ClassOption[]>(open ? "/api/classes?limit=200" : null, fetcher);
    const classes = Array.isArray(classesData) ? classesData : classesData?.data ?? [];
    const [message, setMessage] = useState("");
    const [classId, setClassId] = useState("");
    const [busy, setBusy] = useState(false);
    const invalid = message.trim().length < 5 || message.length > 900;

    const send = async (event: React.FormEvent) => {
        event.preventDefault();
        if (invalid) return;
        setBusy(true);
        try {
            const res = await fetch("/api/whatsapp/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: message.trim(), classId: classId || null }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string; queued?: number; withoutPhone?: number };
            if (!res.ok) {
                toast.error(body.error || "Le message n'a pas été envoyé.");
                return;
            }
            toast.success(
                `${body.queued ?? 0} famille(s) recevront le message${body.withoutPhone ? ` · ${body.withoutPhone} sans numéro valide` : ""}.`,
            );
            setMessage("");
            onOpenChange(false);
        } catch {
            toast.error("Connexion impossible : le message n'a pas été envoyé.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={send} className="space-y-3">
                    <DialogHeader>
                        <DialogTitle>Diffuser un message WhatsApp</DialogTitle>
                        <DialogDescription>Envoyé à chaque parent ayant un numéro valide, une fois par numéro.</DialogDescription>
                    </DialogHeader>
                    <label className="block text-sm">
                        Destinataires
                        <select value={classId} onChange={(e) => setClassId(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">Toutes les familles de l&apos;école</option>
                            {classes.map((c) => <option key={c.id} value={c.id}>Familles de la classe {c.name}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">
                        Message ({message.length}/900)
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={900}
                            className="mt-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Ex. Réunion des parents samedi 14 à 9 h dans la cour de l'école."
                        />
                    </label>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Annuler</Button>
                        <Button type="submit" disabled={invalid} loading={busy}>Envoyer</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
