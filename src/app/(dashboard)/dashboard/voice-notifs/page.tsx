"use client";

import { useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type LangKey = "fr" | "fon" | "yor" | "bar" | "din";

type LangDef = {
    key: LangKey;
    label: string;
    sub: string;
    flag: string;
};

const LANGS: LangDef[] = [
    { key: "fr", label: "Français", sub: "54% des parents", flag: "🇫🇷" },
    { key: "fon", label: "Fɔngbè", sub: "32% des parents · sud BJ", flag: "🇧🇯" },
    { key: "yor", label: "Yorùbá", sub: "8% · plateau d'Abomey", flag: "🇧🇯" },
    { key: "bar", label: "Bariba", sub: "4% · nord BJ", flag: "🇧🇯" },
    { key: "din", label: "Dendi", sub: "2% · Borgou", flag: "🇧🇯" },
];

const SAMPLES: Record<LangKey, string> = {
    fr: "Bonjour Patrick. Le paiement de la scolarité d'Aïcha en classe de 3ème A arrive à échéance le 11 mai. Le montant est de 125 000 francs CFA.",
    fon: "A do gbɛ, Patrick. Aïcha tɔn azɔ̌ akwɛ́ ɖò 3ème A mɛ ɔ́, é jɛ ná sú ɖò azǎn 11 gɔ́ mɛ tɔn. Akwɛ́ ɔ́ nyí akwɛ́ FCFA 125 000.",
    yor: "E kàárọ̀ Patrick. Owó ilé-ìwé Aïcha ní kíláàsì 3ème A ní láti san ní ọjọ́ 11 oṣù karùn-ún. Iye náà jẹ́ FCFA 125 000.",
    bar: "Ǹ wʊ́n yɛ́n Patrick. Aïcha tʊn yɛ́rʊ ku 3ème A bɛɛ, sɔ́ nan kpɛnɛ ɛ́ ndi 11 mai. Sɔ́ wɛn nan tɛn 125 000 FCFA.",
    din: "Mate fonda Patrick. Aïcha boŋo 3ème A ra, a ga ba zaaru 11 mai. Yenga ga ti FCFA 125 000.",
};

type Channel = {
    label: string;
    value: string;
    sub: string;
    tone: "success" | "brand" | "info" | "warning";
    width: string;
};

const CHANNELS: Channel[] = [
    {
        label: "Vocal multilingue",
        value: "94%",
        sub: "Compris par tous les parents · 18 FCFA",
        tone: "success",
        width: "94%",
    },
    {
        label: "WhatsApp",
        value: "88%",
        sub: "Texte FR · 1 842 abonnés · 12 FCFA",
        tone: "brand",
        width: "88%",
    },
    {
        label: "SMS texte",
        value: "70%",
        sub: "Texte FR · 1 840 numéros · 25 FCFA",
        tone: "info",
        width: "70%",
    },
    {
        label: "Email",
        value: "32%",
        sub: "1 240 emails · gratuit",
        tone: "warning",
        width: "32%",
    },
];

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
    const [lang, setLang] = useState<LangKey>("fon");
    const active = LANGS.find((l) => l.key === lang) ?? LANGS[0];

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Notifications vocales multilingues"
                    sub="Atteindre les 38% de parents qui ne lisent pas couramment le français · Fɔn · Yorùbá · Bariba · Dendi"
                    breadcrumb={["Communication", "Canaux", "Vocal multilingue"]}
                    actions={
                        <>
                            <Badge variant="brand" icon="sparkle">
                                Différenciateur EduPilot
                            </Badge>
                            <Button variant="secondary" icon="settings" disabled>
                                Voix & narrateurs
                            </Button>
                            <Button icon="plus" disabled>
                                Diffuser un message vocal
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
                            Modèles <code>VoiceCampaign</code> +{" "}
                            <code>VoiceCampaignTranslation</code> en place côté Prisma ·
                            endpoint <code>/api/voice-notifs/recent</code> opérationnel.
                            Reste à brancher un provider TTS pour Fon / Yorùbá / Bariba /
                            Dendi (partenariat UAC linguistique appliquée en cours) avant
                            que les boutons « Générer » puissent produire des audios réels.
                            Les KPIs ci-dessous sont des valeurs cibles de référence.
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
                    <Kpi
                        label="Parents touchés ce mois"
                        value="1 728"
                        unit="/1 842"
                        hint="93,8% · +24 pts vs SMS seul"
                        tone="success"
                    />
                    <Kpi
                        label="Taux d'écoute"
                        value="84"
                        unit="%"
                        hint="Message écouté jusqu'au bout"
                        tone="brand"
                    />
                    <Kpi
                        label="Langues actives"
                        value="5"
                        hint="Synthèse IA + 12 narrateurs natifs"
                        tone="info"
                    />
                    <Kpi
                        label="Coût / appel"
                        value="18"
                        unit="FCFA"
                        hint="vs SMS · même portée"
                        tone="warning"
                    />
                </div>

                <div
                    style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}
                    className="vn-grid"
                >
                    <Card padding={20}>
                        <SubLabel>Composer · message vocal</SubLabel>

                        <div
                            style={{
                                marginTop: 12,
                                marginBottom: 6,
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                fontWeight: 600,
                            }}
                        >
                            Modèle
                        </div>
                        <select
                            disabled
                            style={{
                                width: "100%",
                                height: 36,
                                borderRadius: 8,
                                border: "1px solid var(--border-default)",
                                padding: "0 10px",
                                fontSize: 13,
                                fontFamily: "inherit",
                                background: "var(--surface-card)",
                                color: "var(--text-primary)",
                            }}
                            defaultValue="rappel-scolarite"
                        >
                            <option value="rappel-scolarite">
                                Rappel échéance scolarité (auto J-7)
                            </option>
                            <option value="absence">Absence enfant · le jour même</option>
                            <option value="conseil">Convocation conseil parents</option>
                            <option value="bulletin">
                                Bulletin disponible · à venir chercher
                            </option>
                            <option value="libre">Annonce libre</option>
                        </select>

                        <div
                            style={{
                                marginTop: 14,
                                marginBottom: 6,
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                fontWeight: 600,
                            }}
                        >
                            Texte original (français)
                        </div>
                        <textarea
                            disabled
                            style={{
                                width: "100%",
                                minHeight: 70,
                                borderRadius: 10,
                                border: "1px solid var(--border-default)",
                                padding: 10,
                                fontSize: 12,
                                fontFamily: "inherit",
                                lineHeight: 1.55,
                                background: "var(--surface-card)",
                                color: "var(--text-primary)",
                                resize: "vertical",
                            }}
                            defaultValue={SAMPLES.fr}
                        />

                        <div
                            style={{
                                marginTop: 14,
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                                fontWeight: 600,
                                marginBottom: 8,
                            }}
                        >
                            Langue à prévisualiser
                        </div>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
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

                        <Button full style={{ marginTop: 14 }} icon="sparkle" disabled>
                            Générer & diffuser à 1 842 parents
                        </Button>
                    </Card>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card padding={20}>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    marginBottom: 10,
                                    gap: 8,
                                    flexWrap: "wrap",
                                }}
                            >
                                <div>
                                    <SubLabel>Aperçu · {active.label}</SubLabel>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            color: "var(--text-tertiary)",
                                            marginTop: 4,
                                        }}
                                    >
                                        Traduit par modèle Naija-IA · validé par narrateur
                                        natif
                                    </div>
                                </div>
                                <Badge variant="success" size="sm" icon="check">
                                    Naturel · 4,7/5
                                </Badge>
                            </div>

                            <div
                                style={{
                                    marginTop: 14,
                                    padding: 16,
                                    borderRadius: 14,
                                    background: "var(--surface-sunken)",
                                    border: "1px solid var(--border-subtle)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginBottom: 12,
                                    }}
                                >
                                    <button
                                        type="button"
                                        aria-label="Lire le message"
                                        disabled
                                        style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: "50%",
                                            background: "var(--brand-600)",
                                            border: 0,
                                            display: "grid",
                                            placeItems: "center",
                                            cursor: "not-allowed",
                                            boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
                                        }}
                                    >
                                        <svg
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="#fff"
                                            aria-hidden
                                        >
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </button>
                                    <div style={{ flex: 1 }}>
                                        <div
                                            aria-hidden
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 2,
                                                height: 28,
                                            }}
                                        >
                                            {Array.from({ length: 60 }).map((_, i) => {
                                                const h =
                                                    4 +
                                                    Math.abs(
                                                        Math.sin(i * 0.7) +
                                                            Math.cos(i * 0.31),
                                                    ) *
                                                        14;
                                                const played = i < 18;
                                                return (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            flex: 1,
                                                            height: h,
                                                            borderRadius: 2,
                                                            background: played
                                                                ? "var(--brand-600)"
                                                                : "var(--neutral-300)",
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                marginTop: 4,
                                                fontSize: 10,
                                                color: "var(--text-tertiary)",
                                                fontFamily:
                                                    "var(--eduflow-font-mono, monospace)",
                                            }}
                                        >
                                            <span className="tabular">0:08</span>
                                            <span className="tabular">0:28</span>
                                        </div>
                                    </div>
                                    <Icon
                                        name="download"
                                        size={16}
                                        color="var(--text-tertiary)"
                                    />
                                </div>
                                <p
                                    style={{
                                        fontSize: 13,
                                        lineHeight: 1.7,
                                        margin: 0,
                                        color: "var(--text-primary)",
                                        fontStyle: "italic",
                                    }}
                                >
                                    « {SAMPLES[lang]} »
                                </p>
                                <div
                                    style={{
                                        marginTop: 10,
                                        fontSize: 11,
                                        color: "var(--text-tertiary)",
                                    }}
                                >
                                    Narrateur :{" "}
                                    <strong>Désiré Ahouangonou</strong> · voix masculine
                                    adulte · accent Cotonou.
                                </div>
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
                                    Portée comparée · même message
                                </h3>
                                <Badge variant="brand" size="sm">
                                    +24 pts vocal vs SMS
                                </Badge>
                            </div>
                            <div
                                style={{
                                    padding: 18,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 12,
                                }}
                            >
                                {CHANNELS.map((c) => (
                                    <div
                                        key={c.label}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        <div style={{ width: 130 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                                                {c.label}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: "var(--text-tertiary)",
                                                }}
                                            >
                                                {c.sub}
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                flex: 1,
                                                height: 10,
                                                background: "var(--neutral-200)",
                                                borderRadius: 5,
                                                overflow: "hidden",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    height: "100%",
                                                    width: c.width,
                                                    background: `var(--${c.tone}-600)`,
                                                    borderRadius: 5,
                                                }}
                                            />
                                        </div>
                                        <span
                                            className="tabular eduflow-display"
                                            style={{
                                                width: 48,
                                                textAlign: "right",
                                                fontSize: 16,
                                                fontWeight: 800,
                                                color: `var(--${c.tone}-700)`,
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {c.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card
                            padding={16}
                            style={{
                                background: "var(--success-50)",
                                border: "1px solid var(--success-200)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 10 }}>
                                <Icon
                                    name="sparkle"
                                    size={18}
                                    color="var(--success-700)"
                                    style={{ marginTop: 2 }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "var(--success-900)",
                                        }}
                                    >
                                        Impact mesuré sur le recouvrement
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: "var(--success-800)",
                                            margin: "4px 0 0",
                                            lineHeight: 1.6,
                                        }}
                                    >
                                        Depuis l'activation des rappels vocaux en Fɔn, le
                                        taux de paiement à l'échéance passe de{" "}
                                        <strong>71% → 88%</strong> chez les familles dont la
                                        maman ne lit pas le français.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
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
        </PageGuard>
    );
}
