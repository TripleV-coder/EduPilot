"use client";

import { useState } from "react";
import useSWR from "swr";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";

import { Badge, Card, Icon } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type LangKey = "fr" | "fon" | "yor" | "bar" | "din";

type LangDef = {
    key: LangKey;
    label: string;
    sub: string;
    flag: string;
};

const LANGS: LangDef[] = [
    { key: "fr", label: "Français", sub: "Langue officielle", flag: "🇫🇷" },
    { key: "fon", label: "Fɔngbè", sub: "Sud Bénin", flag: "🇧🇯" },
    { key: "yor", label: "Yorùbá", sub: "Plateau d'Abomey", flag: "🇧🇯" },
    { key: "bar", label: "Bariba", sub: "Nord Bénin", flag: "🇧🇯" },
    { key: "din", label: "Dendi", sub: "Borgou", flag: "🇧🇯" },
];

// Textes du modèle « rappel échéance scolarité » tels que stockés dans les
// templates de VoiceCampaignTranslation (validés par narrateurs natifs).
const SAMPLES: Record<LangKey, string> = {
    fr: "Bonjour. Le paiement de la scolarité de votre enfant arrive à échéance. Merci de régulariser auprès de l'établissement.",
    fon: "A do gbɛ. Vǐ towe tɔn azɔ̌ akwɛ́ ɔ́ jɛ ná sú. Mǐ ɖò kúkú ná we ɖɔ a ní wá sú akwɛ́ ɔ́ ɖò wěxɔ ɔ́ mɛ.",
    yor: "E kàárọ̀. Owó ilé-ìwé ọmọ yín ní láti san. Ẹ jọ̀wọ́ ẹ wá san ní ilé-ìwé.",
    bar: "Ǹ wʊ́n yɛ́n. Bii wʊnɛn yɛ́rʊ sɔ́ nan kpɛnɛ. Ka na sɔ́ wɛn sú yɛ́rʊ dirɔ mɛ.",
    din: "Mate fonda. Ni izey boŋo nooru ga ba. Wa kaa ka bana lokkol do.",
};

const STATUS_LABELS: Record<string, { label: string; variant: "success" | "brand" | "info" | "warning" | "danger" }> = {
    DRAFT: { label: "Brouillon", variant: "info" },
    SYNTHESIZED: { label: "Synthétisée", variant: "brand" },
    DISPATCHED: { label: "Diffusée", variant: "success" },
    COMPLETED: { label: "Terminée", variant: "success" },
    CANCELLED: { label: "Annulée", variant: "danger" },
};

const TEMPLATE_LABELS: Record<string, string> = {
    RAPPEL_SCOLARITE: "Rappel scolarité",
    ABSENCE: "Absence enfant",
    CONVOCATION: "Convocation",
    BULLETIN: "Bulletin disponible",
    LIBRE: "Annonce libre",
};

const LANG_LABELS: Record<string, string> = {
    fr: "FR",
    fon: "Fɔn",
    yor: "Yorùbá",
    bar: "Bariba",
    din: "Dendi",
};

type VoiceCampaignItem = {
    id: string;
    templateKind: string;
    textFr: string;
    status: string;
    audienceSize: number;
    reachedCount: number;
    listenedCount: number;
    dispatchedAt: string | null;
    createdAt: string;
    languages: string[];
};

type VoiceNotifsResponse = {
    schoolId: string;
    kpis: {
        campaignsThisMonth: number;
        audienceTotal: number;
        reachRate: number | null;
        listenRate: number | null;
        avgCostFcfa: number | null;
    };
    campaigns: VoiceCampaignItem[];
};

const numberFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function formatRate(value: number | null): string {
    return value === null ? "—" : numberFr.format(value);
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

export default function VoiceNotifsPage() {
    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <VoiceNotifsContent />
        </PageGuard>
    );
}

function VoiceNotifsContent() {
    const [lang, setLang] = useState<LangKey>("fon");
    const active = LANGS.find((l) => l.key === lang) ?? LANGS[0];

    const { data, error, isLoading } = useSWR<VoiceNotifsResponse>(
        "/api/voice-notifs/recent",
        fetcher,
        { revalidateOnFocus: false, refreshInterval: 60_000 },
    );

    if (isLoading) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Notifications vocales multilingues"
                    sub="Chargement des campagnes…"
                    breadcrumb={["Communication", "Canaux", "Vocal multilingue"]}
                />
                <div
                    style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
                    className="kpi-grid"
                >
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="animate-pulse"
                            style={{
                                height: 96,
                                borderRadius: 14,
                                background: "var(--surface-sunken)",
                            }}
                        />
                    ))}
                </div>
                <Card padding={24}>
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="animate-pulse"
                            style={{
                                height: 48,
                                borderRadius: 8,
                                background: "var(--surface-sunken)",
                                marginTop: i === 0 ? 0 : 12,
                            }}
                        />
                    ))}
                </Card>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Notifications vocales multilingues"
                    sub="Impossible de charger les campagnes"
                    breadcrumb={["Communication", "Canaux", "Vocal multilingue"]}
                />
                <Card
                    padding={32}
                    style={{
                        background: "var(--danger-50)",
                        border: "1px solid var(--danger-200)",
                        textAlign: "center",
                    }}
                >
                    <Icon name="warning" size={28} color="var(--danger-700)" />
                    <p style={{ fontSize: 13, color: "var(--danger-800)", marginTop: 12 }}>
                        Le service de notifications vocales est momentanément indisponible.
                        Réessayez dans quelques instants ou contactez l&apos;administrateur.
                    </p>
                </Card>
            </div>
        );
    }

    const { kpis, campaigns } = data;

    return (
        <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
            <PageHeader
                greeting="Notifications vocales multilingues"
                sub="Atteindre les parents qui ne lisent pas couramment le français · Fɔn · Yorùbá · Bariba · Dendi"
                breadcrumb={["Communication", "Canaux", "Vocal multilingue"]}
                actions={
                    <Badge variant="brand" icon="sparkle">
                        Différenciateur EduPilot
                    </Badge>
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
                <Kpi
                    label="Campagnes ce mois"
                    value={numberFr.format(kpis.campaignsThisMonth)}
                    hint="30 derniers jours"
                    tone="brand"
                />
                <Kpi
                    label="Audience totale"
                    value={numberFr.format(kpis.audienceTotal)}
                    unit="parents"
                    hint={
                        kpis.reachRate !== null
                            ? `${formatRate(kpis.reachRate)}% effectivement joints`
                            : "Aucune diffusion pour l'instant"
                    }
                    tone="success"
                />
                <Kpi
                    label="Taux d'écoute"
                    value={formatRate(kpis.listenRate)}
                    unit={kpis.listenRate !== null ? "%" : undefined}
                    hint="Message écouté jusqu'au bout"
                    tone="info"
                />
                <Kpi
                    label="Coût moyen / appel"
                    value={
                        kpis.avgCostFcfa !== null ? numberFr.format(kpis.avgCostFcfa) : "—"
                    }
                    unit={kpis.avgCostFcfa !== null ? "FCFA" : undefined}
                    hint="Campagnes diffusées et terminées"
                    tone="warning"
                />
            </div>

            <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}
                className="vn-grid"
            >
                <Card padding={20}>
                    <SubLabel>Langues & modèle de message</SubLabel>
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "var(--text-tertiary)",
                            lineHeight: 1.5,
                        }}
                    >
                        Aperçu du modèle « rappel échéance scolarité » dans chaque langue
                        prise en charge.
                    </div>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            marginTop: 12,
                        }}
                    >
                        {LANGS.map((l) => {
                            const isActive = lang === l.key;
                            return (
                                <button
                                    key={l.key}
                                    type="button"
                                    onClick={() => setLang(l.key)}
                                    aria-pressed={isActive}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: isActive
                                            ? "2px solid var(--brand-600)"
                                            : "1px solid var(--border-default)",
                                        background: isActive
                                            ? "var(--brand-50)"
                                            : "var(--surface-card)",
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        textAlign: "left",
                                    }}
                                >
                                    <span style={{ fontSize: 20 }} aria-hidden>
                                        {l.flag}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: isActive
                                                    ? "var(--brand-900)"
                                                    : "var(--text-primary)",
                                            }}
                                        >
                                            {l.label}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                color: "var(--text-tertiary)",
                                            }}
                                        >
                                            {l.sub}
                                        </div>
                                    </div>
                                    {isActive ? (
                                        <Icon
                                            name="check"
                                            size={14}
                                            color="var(--brand-700)"
                                        />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        style={{
                            marginTop: 14,
                            padding: 14,
                            borderRadius: 12,
                            background: "var(--surface-sunken)",
                            border: "1px solid var(--border-subtle)",
                        }}
                    >
                        <SubLabel>Aperçu · {active.label}</SubLabel>
                        <p
                            style={{
                                fontSize: 13,
                                lineHeight: 1.7,
                                margin: "8px 0 0",
                                color: "var(--text-primary)",
                                fontStyle: "italic",
                            }}
                        >
                            « {SAMPLES[lang]} »
                        </p>
                    </div>
                </Card>

                <Card padding={0}>
                    <div
                        style={{
                            padding: "14px 18px",
                            borderBottom: "1px solid var(--border-subtle)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                        }}
                    >
                        <h3
                            className="eduflow-display"
                            style={{ fontSize: 15, margin: 0 }}
                        >
                            Campagnes récentes
                        </h3>
                        <Badge variant="brand" size="sm">
                            {numberFr.format(campaigns.length)} affichée
                            {campaigns.length > 1 ? "s" : ""}
                        </Badge>
                    </div>

                    {campaigns.length === 0 ? (
                        <div style={{ padding: 36, textAlign: "center" }}>
                            <Icon name="sparkle" size={28} color="var(--brand-600)" />
                            <h4
                                className="eduflow-display"
                                style={{ fontSize: 15, margin: "12px 0 0" }}
                            >
                                Aucune campagne vocale pour l&apos;instant
                            </h4>
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--text-secondary)",
                                    margin: "6px auto 0",
                                    maxWidth: 380,
                                    lineHeight: 1.6,
                                }}
                            >
                                Les modèles multilingues sont prêts. Votre première
                                diffusion (rappel de scolarité, absence, convocation…)
                                apparaîtra ici avec sa portée et son taux d&apos;écoute.
                            </p>
                        </div>
                    ) : (
                        <div
                            style={{
                                padding: 18,
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                            }}
                        >
                            {campaigns.map((c) => {
                                const status =
                                    STATUS_LABELS[c.status] ?? {
                                        label: c.status,
                                        variant: "info" as const,
                                    };
                                const date = new Date(
                                    c.dispatchedAt ?? c.createdAt,
                                ).toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                });
                                return (
                                    <div
                                        key={c.id}
                                        style={{
                                            padding: 14,
                                            borderRadius: 12,
                                            border: "1px solid var(--border-subtle)",
                                            background: "var(--surface-card)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "flex-start",
                                                gap: 8,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {TEMPLATE_LABELS[c.templateKind] ??
                                                        c.templateKind}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--text-tertiary)",
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {date}
                                                    {c.languages.length > 0
                                                        ? ` · ${c.languages
                                                              .map(
                                                                  (l) =>
                                                                      LANG_LABELS[l] ?? l,
                                                              )
                                                              .join(" · ")}`
                                                        : ""}
                                                </div>
                                            </div>
                                            <Badge variant={status.variant} size="sm">
                                                {status.label}
                                            </Badge>
                                        </div>
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: "var(--text-secondary)",
                                                margin: "8px 0 0",
                                                lineHeight: 1.55,
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {c.textFr}
                                        </p>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 16,
                                                marginTop: 10,
                                                fontSize: 11,
                                                color: "var(--text-tertiary)",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <span className="tabular">
                                                Audience :{" "}
                                                <strong>
                                                    {numberFr.format(c.audienceSize)}
                                                </strong>
                                            </span>
                                            <span className="tabular">
                                                Joints :{" "}
                                                <strong>
                                                    {numberFr.format(c.reachedCount)}
                                                </strong>
                                            </span>
                                            <span className="tabular">
                                                Écoutés :{" "}
                                                <strong>
                                                    {numberFr.format(c.listenedCount)}
                                                </strong>
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .vn-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
