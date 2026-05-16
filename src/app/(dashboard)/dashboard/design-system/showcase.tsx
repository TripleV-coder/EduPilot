"use client";

import * as React from "react";
import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Input,
    Logo,
    MetricCard,
    NotifItem,
    Progress,
    RingProgress,
    Toast,
} from "@/components/edu";

type PaletteId = "deepblue" | "emerald" | "terracotta" | "indigo";
type DensityId = "comfortable" | "compact";

const PALETTES: { id: PaletteId; label: string; sample: string }[] = [
    { id: "deepblue", label: "Sky → Indigo", sample: "#2563EB" },
    { id: "emerald", label: "Emerald", sample: "#059669" },
    { id: "terracotta", label: "Terracotta", sample: "#B94A23" },
    { id: "indigo", label: "Indigo", sample: "#7C3AED" },
];

// ─── Building blocks ────────────────────────────────────────────────────────

function Section({
    title,
    eyebrow,
    children,
    gap = 20,
}: {
    title: React.ReactNode;
    eyebrow: React.ReactNode;
    children: React.ReactNode;
    gap?: number;
}) {
    return (
        <div style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 18 }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--brand-700)",
                        marginBottom: 6,
                    }}
                >
                    {eyebrow}
                </div>
                <h2
                    className="eduflow-display"
                    style={{
                        fontSize: 28,
                        margin: 0,
                        color: "var(--eduflow-text-primary)",
                        letterSpacing: "-0.025em",
                    }}
                >
                    {title}
                </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap }}>{children}</div>
        </div>
    );
}

function SubLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--eduflow-text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
            }}
        >
            {children}
        </div>
    );
}

function ColorRamp({
    varName,
    label,
}: {
    varName: string;
    label: React.ReactNode;
}) {
    const tints = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const isBrandRamp = varName === "brand";
    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: 8,
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--eduflow-text-primary)" }}>
                    {label}
                </span>
                <span
                    className="eduflow-mono"
                    style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                >
                    --{isBrandRamp ? "brand" : `eduflow-${varName}`}-*
                </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
                {tints.map((t) => (
                    <div
                        key={t}
                        style={{
                            aspectRatio: "1",
                            borderRadius: 8,
                            background: `var(--${isBrandRamp ? "brand" : `eduflow-${varName}`}-${t})`,
                            border: "1px solid var(--eduflow-border-subtle)",
                            display: "flex",
                            alignItems: "flex-end",
                            padding: 6,
                            fontSize: 9,
                            fontWeight: 600,
                            color: t >= 500 ? "rgba(255,255,255,0.9)" : "var(--eduflow-neutral-700)",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {t}
                    </div>
                ))}
            </div>
        </div>
    );
}

function TypeRow({
    size,
    label,
    sample,
    family,
    weight = 600,
}: {
    size: string;
    label: string;
    sample: string;
    family: string;
    weight?: number;
}) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "90px 80px 1fr",
                gap: 16,
                alignItems: "baseline",
                padding: "12px 0",
                borderBottom: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            <span
                className="eduflow-mono"
                style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
            >
                {label}
            </span>
            <span
                className="eduflow-mono"
                style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
            >
                {size}
            </span>
            <span
                style={{
                    fontFamily: family,
                    fontSize: parseInt(size, 10),
                    fontWeight: weight,
                    color: "var(--eduflow-text-primary)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                }}
            >
                {sample}
            </span>
        </div>
    );
}

function SpaceTile({ value, name }: { value: number; name: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div
                style={{
                    width: 64,
                    height: 64,
                    background: "var(--eduflow-surface-sunken)",
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                }}
            >
                <div
                    style={{
                        width: value,
                        height: value,
                        background: "var(--brand-700)",
                        borderRadius: 2,
                    }}
                />
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--eduflow-text-primary)" }}>
                {name}
            </div>
            <div
                className="eduflow-mono"
                style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
            >
                {value}px
            </div>
        </div>
    );
}

function RadiusTile({ name, value }: { name: string; value: number }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div
                style={{
                    width: 60,
                    height: 60,
                    background: "var(--brand-700)",
                    borderRadius: value,
                }}
            />
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--eduflow-text-primary)" }}>
                {name}
            </div>
            <div
                className="eduflow-mono"
                style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
            >
                {value}px
            </div>
        </div>
    );
}

function ShadowTile({ name, value }: { name: string; value: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
                style={{
                    width: 90,
                    height: 60,
                    background: "var(--eduflow-surface-card)",
                    borderRadius: 12,
                    boxShadow: value,
                }}
            />
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--eduflow-text-primary)" }}>
                {name}
            </div>
        </div>
    );
}

// ─── Tweak panel ────────────────────────────────────────────────────────────

function TweaksPanel({
    palette,
    setPalette,
    theme,
    setTheme,
    density,
    setDensity,
}: {
    palette: PaletteId;
    setPalette: (p: PaletteId) => void;
    theme: "light" | "dark";
    setTheme: (t: "light" | "dark") => void;
    density: DensityId;
    setDensity: (d: DensityId) => void;
}) {
    return (
        <Card
            padding={16}
            style={{
                position: "sticky",
                top: 16,
                zIndex: 10,
                marginBottom: 32,
                boxShadow: "var(--eduflow-shadow-card-brand)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Logo size={28} />
                    <div>
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--eduflow-text-primary)",
                            }}
                        >
                            Tweaks live
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                            }}
                        >
                            Palette · Thème · Densité
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {PALETTES.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setPalette(p.id)}
                            aria-pressed={palette === p.id}
                            title={p.label}
                            style={{
                                width: 30,
                                height: 30,
                                borderRadius: 9,
                                border:
                                    palette === p.id
                                        ? "2px solid var(--eduflow-text-primary)"
                                        : "1px solid var(--eduflow-border-default)",
                                background: p.sample,
                                cursor: "pointer",
                                padding: 0,
                                transition:
                                    "transform var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                transform: palette === p.id ? "scale(1.05)" : "scale(1)",
                            }}
                        />
                    ))}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                    <Button
                        variant={theme === "light" ? "primary" : "secondary"}
                        size="sm"
                        icon="sun"
                        onClick={() => setTheme("light")}
                    >
                        Light
                    </Button>
                    <Button
                        variant={theme === "dark" ? "primary" : "secondary"}
                        size="sm"
                        icon="moon"
                        onClick={() => setTheme("dark")}
                    >
                        Dark
                    </Button>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                    <Button
                        variant={density === "comfortable" ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => setDensity("comfortable")}
                    >
                        Confortable
                    </Button>
                    <Button
                        variant={density === "compact" ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => setDensity("compact")}
                    >
                        Compact
                    </Button>
                </div>
            </div>
        </Card>
    );
}

// ─── Showcase ────────────────────────────────────────────────────────────────

export function DesignSystemShowcase() {
    const [palette, setPalette] = React.useState<PaletteId>("deepblue");
    const [theme, setTheme] = React.useState<"light" | "dark">("light");
    const [density, setDensity] = React.useState<DensityId>("comfortable");

    const containerProps = {
        "data-eduflow-palette": palette,
        "data-eduflow-theme": theme,
        "data-eduflow-density": density === "compact" ? "compact" : undefined,
    } as Record<string, string | undefined>;

    return (
        <div
            className="eduflow-scope"
            {...containerProps}
            style={{
                background: "var(--eduflow-surface-page)",
                color: "var(--eduflow-text-primary)",
                minHeight: "100%",
                padding: "32px clamp(16px, 4vw, 44px) 64px",
                borderRadius: "var(--eduflow-radius-lg)",
            }}
        >
            <div style={{ maxWidth: 1140, margin: "0 auto" }}>
                <TweaksPanel
                    palette={palette}
                    setPalette={setPalette}
                    theme={theme}
                    setTheme={setTheme}
                    density={density}
                    setDensity={setDensity}
                />

                {/* Hero header */}
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 24,
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        marginBottom: 36,
                        paddingBottom: 24,
                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                    }}
                >
                    <div style={{ flex: "1 1 480px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <Logo size={36} />
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    color: "var(--brand-700)",
                                }}
                            >
                                Design System v2 · 2026
                            </div>
                        </div>
                        <h1
                            className="eduflow-display"
                            style={{
                                fontSize: "clamp(36px, 5vw, 56px)",
                                margin: 0,
                                lineHeight: 0.95,
                                letterSpacing: "-0.04em",
                            }}
                        >
                            EduPilot <span style={{ color: "var(--brand-700)" }}>—</span> chaud, précis, intelligent.
                        </h1>
                        <p
                            style={{
                                fontSize: 16,
                                color: "var(--eduflow-text-secondary)",
                                maxWidth: 720,
                                marginTop: 16,
                                lineHeight: 1.55,
                            }}
                        >
                            Un système conçu pour l&apos;éducation africaine.{" "}
                            <span style={{ color: "var(--eduflow-text-primary)", fontWeight: 600 }}>
                                Je connais ton rôle, je sais ce qui compte aujourd&apos;hui, je t&apos;aide à agir vite.
                            </span>{" "}
                            EN/FR · WCAG AA · Dark mode · Mobile-first.
                        </p>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            textAlign: "right",
                        }}
                    >
                        <span>Tokens · Foundation · Edu</span>
                        <span className="eduflow-mono">v2.0.0-alpha</span>
                    </div>
                </div>

                {/* Colors */}
                <Section eyebrow="Étape 1 / Tokens" title="Couleurs sémantiques">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 28 }}>
                        <ColorRamp varName="brand" label="Brand · marque institutionnelle" />
                        <ColorRamp varName="success" label="Success · réussite, paiement" />
                        <ColorRamp varName="info" label="Info · cours, neutre" />
                        <ColorRamp varName="warning" label="Warning · vigilance, retard" />
                        <ColorRamp varName="danger" label="Danger · incident, urgent" />
                        <ColorRamp varName="neutral" label="Neutral · structure, secondaire" />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            gap: 12,
                            marginTop: 8,
                            padding: 16,
                            background: "var(--eduflow-surface-sunken)",
                            borderRadius: "var(--eduflow-radius-lg)",
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                            lineHeight: 1.55,
                        }}
                    >
                        <Icon name="info" size={16} color="var(--brand-700)" style={{ marginTop: 2 }} />
                        <div>
                            <strong style={{ color: "var(--eduflow-text-primary)" }}>
                                Sémantique non-négociable.
                            </strong>{" "}
                            Vert = progrès / paiement OK. Bleu = info / cours. Ambre = vigilance. Rouge = critique. Une couleur ne décore jamais — elle informe.
                        </div>
                    </div>
                </Section>

                {/* Typography */}
                <Section eyebrow="Étape 1 / Tokens" title="Typographie">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 32 }}>
                        <div>
                            <SubLabel>Display · Inter (semibold/bold)</SubLabel>
                            <TypeRow label="4xl" size="48px" family="var(--eduflow-font-display)" weight={700} sample="L'année avance bien." />
                            <TypeRow label="3xl" size="36px" family="var(--eduflow-font-display)" weight={700} sample="Bonjour Mme Sossou." />
                            <TypeRow label="2xl" size="28px" family="var(--eduflow-font-display)" weight={600} sample="Carnet de notes — 4ᵉ B" />
                            <TypeRow label="xl" size="22px" family="var(--eduflow-font-display)" weight={600} sample="Bulletin trimestriel" />
                        </div>
                        <div>
                            <SubLabel>Body · Inter (regular/medium)</SubLabel>
                            <TypeRow label="lg" size="18px" family="var(--eduflow-font-body)" weight={500} sample="Paiement de scolarité confirmé." />
                            <TypeRow label="md" size="16px" family="var(--eduflow-font-body)" weight={500} sample="3 absences cette semaine" />
                            <TypeRow label="base" size="14px" family="var(--eduflow-font-body)" weight={400} sample="Mathématiques · 14h00 · Salle 207" />
                            <TypeRow label="sm" size="13px" family="var(--eduflow-font-body)" weight={400} sample="Modifié il y a 4 minutes par M. Adjavon" />
                        </div>
                    </div>
                    <Card>
                        <SubLabel>Tabular numerals (chiffres alignés)</SubLabel>
                        <div style={{ display: "flex", gap: 32, alignItems: "baseline", flexWrap: "wrap" }}>
                            <div>
                                <div
                                    className="eduflow-display eduflow-tabular"
                                    style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}
                                >
                                    14,75
                                </div>
                                <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 4 }}>
                                    Moyenne classe
                                </div>
                            </div>
                            <div>
                                <div
                                    className="eduflow-display eduflow-tabular"
                                    style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}
                                >
                                    248 500
                                </div>
                                <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 4 }}>
                                    FCFA encaissés
                                </div>
                            </div>
                            <div>
                                <div
                                    className="eduflow-display eduflow-tabular"
                                    style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}
                                >
                                    92,4
                                    <span style={{ fontSize: "0.55em", color: "var(--eduflow-text-tertiary)" }}>%</span>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 4 }}>
                                    Présence semaine
                                </div>
                            </div>
                        </div>
                    </Card>
                </Section>

                {/* Spacing + Radius + Shadows */}
                <Section eyebrow="Étape 1 / Tokens" title="Espacement, rayons, ombres">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 24,
                        }}
                    >
                        <Card>
                            <SubLabel>Spacing · 4px base</SubLabel>
                            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                                <SpaceTile name="space-2" value={8} />
                                <SpaceTile name="space-3" value={12} />
                                <SpaceTile name="space-4" value={16} />
                                <SpaceTile name="space-6" value={24} />
                                <SpaceTile name="space-8" value={32} />
                                <SpaceTile name="space-12" value={48} />
                            </div>
                        </Card>
                        <Card>
                            <SubLabel>Radius · card 22px</SubLabel>
                            <div style={{ display: "flex", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
                                <RadiusTile name="chip" value={8} />
                                <RadiusTile name="input" value={12} />
                                <RadiusTile name="soft" value={16} />
                                <RadiusTile name="card" value={22} />
                                <RadiusTile name="2xl" value={28} />
                            </div>
                        </Card>
                        <Card>
                            <SubLabel>Shadows</SubLabel>
                            <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
                                <ShadowTile name="sm" value="var(--eduflow-shadow-sm)" />
                                <ShadowTile name="card" value="var(--eduflow-shadow-card)" />
                                <ShadowTile name="card-brand" value="var(--eduflow-shadow-card-brand)" />
                                <ShadowTile name="cta" value="var(--eduflow-shadow-cta)" />
                                <ShadowTile name="pop" value="var(--eduflow-shadow-pop)" />
                            </div>
                        </Card>
                    </div>
                </Section>

                {/* Buttons */}
                <Section eyebrow="Étape 2 / Foundation" title="Boutons">
                    <Card>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "120px 1fr",
                                gap: 18,
                                alignItems: "center",
                            }}
                        >
                            <SubLabel>Primary</SubLabel>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Button size="sm">Enregistrer</Button>
                                <Button size="md" icon="check">Valider l&apos;appel</Button>
                                <Button size="lg" icon="plus">Ajouter une note</Button>
                                <Button loading>Loading…</Button>
                            </div>

                            <SubLabel>Secondary</SubLabel>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Button variant="secondary" size="sm">Annuler</Button>
                                <Button variant="secondary" size="md" icon="download">Exporter CSV</Button>
                                <Button variant="secondary" size="lg" iconRight="arrowRight">Voir bulletin</Button>
                                <Button variant="secondary" disabled>Bloqué</Button>
                            </div>

                            <SubLabel>Soft / Ghost</SubLabel>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Button variant="soft" size="sm" icon="sparkle">IA</Button>
                                <Button variant="ghost" size="md" icon="filter">Filtrer</Button>
                                <Button variant="ghost" size="md" icon="settings">Paramètres</Button>
                                <Button variant="danger" size="md" icon="x">Supprimer</Button>
                            </div>
                        </div>
                    </Card>
                </Section>

                {/* Badges */}
                <Section eyebrow="Étape 2 / Foundation" title="Badges & statuts">
                    <Card>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <Badge variant="success" icon="check">Payé</Badge>
                            <Badge variant="success" dot>En ligne</Badge>
                            <Badge variant="warning" icon="clock">3 jours restants</Badge>
                            <Badge variant="warning">Retard</Badge>
                            <Badge variant="danger" icon="warning">Absent</Badge>
                            <Badge variant="danger" dot>Action requise</Badge>
                            <Badge variant="info" icon="book">Cours en direct</Badge>
                            <Badge variant="brand">Bourse</Badge>
                            <Badge variant="neutral">Brouillon</Badge>
                            <Badge variant="success" size="sm">+0,8 pts</Badge>
                            <Badge variant="danger" size="sm">−2,1 pts</Badge>
                        </div>
                    </Card>
                </Section>

                {/* Inputs */}
                <Section eyebrow="Étape 2 / Foundation" title="Champs de saisie">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 16,
                        }}
                    >
                        <Input label="Nom de l'élève" icon="users" value="Aïcha Hounsou" />
                        <Input
                            label="Téléphone parent"
                            icon="sms"
                            value="+229 95 12 34 56"
                            helper="SMS automatique activé"
                        />
                        <Input label="Note /20" icon="pencil" error="Note obligatoire" />
                        <Input label="Recherche" icon="search" placeholder="Élève, classe, matière…" />
                        <Input label="Date de naissance" icon="calendar" value="14 / 03 / 2012" />
                        <Input label="Frais scolarité" icon="money" value="125 000 FCFA" />
                    </div>
                </Section>

                {/* Avatars + Progress */}
                <Section eyebrow="Étape 2 / Foundation" title="Avatars · Progress">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: 24,
                        }}
                    >
                        <Card>
                            <SubLabel>Avatars · 5 tailles · états</SubLabel>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 16,
                                    alignItems: "center",
                                    marginBottom: 18,
                                    flexWrap: "wrap",
                                }}
                            >
                                <Avatar name="Aïcha Hounsou" size="xs" />
                                <Avatar name="Mathieu Sossou" size="sm" status="online" />
                                <Avatar name="Fatou Adjavon" size="md" status="away" />
                                <Avatar name="Koffi Dossou" size="lg" status="busy" />
                                <Avatar name="Bénin Excellence" size="xl" />
                            </div>
                            <SubLabel>Stack · classe</SubLabel>
                            <div style={{ display: "flex" }}>
                                {["Aïcha H", "Mathieu S", "Fatou A", "Koffi D", "Marie B"].map((n, i) => (
                                    <div
                                        key={n}
                                        style={{
                                            marginLeft: i ? -10 : 0,
                                            boxShadow: "0 0 0 2px var(--eduflow-surface-card)",
                                            borderRadius: "50%",
                                        }}
                                    >
                                        <Avatar name={n} size="md" />
                                    </div>
                                ))}
                                <div
                                    style={{
                                        marginLeft: -10,
                                        width: 40,
                                        height: 40,
                                        borderRadius: "50%",
                                        background: "var(--eduflow-surface-card)",
                                        boxShadow:
                                            "0 0 0 2px var(--eduflow-surface-card), inset 0 0 0 1px var(--eduflow-border-default)",
                                        display: "grid",
                                        placeItems: "center",
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: "var(--eduflow-text-secondary)",
                                    }}
                                >
                                    +27
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <SubLabel>Progress</SubLabel>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <Progress label="Trimestre 2" sublabel="68%" value={68} variant="brand" />
                                <Progress label="Paiements collectés" sublabel="92%" value={92} variant="success" />
                                <Progress label="Élèves à risque" sublabel="14%" value={14} variant="warning" />
                                <Progress label="Incidents non traités" sublabel="3%" value={3} variant="danger" />
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 18,
                                    marginTop: 18,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <RingProgress value={68} size={62} variant="brand">
                                    <span
                                        className="eduflow-display eduflow-tabular"
                                        style={{ fontSize: 14, fontWeight: 700 }}
                                    >
                                        68%
                                    </span>
                                </RingProgress>
                                <RingProgress value={92} size={62} variant="success">
                                    <span
                                        className="eduflow-display eduflow-tabular"
                                        style={{ fontSize: 14, fontWeight: 700 }}
                                    >
                                        92%
                                    </span>
                                </RingProgress>
                                <RingProgress value={14} size={62} variant="warning">
                                    <span
                                        className="eduflow-display eduflow-tabular"
                                        style={{ fontSize: 14, fontWeight: 700 }}
                                    >
                                        14%
                                    </span>
                                </RingProgress>
                                <RingProgress value={3} size={62} variant="danger">
                                    <span
                                        className="eduflow-display eduflow-tabular"
                                        style={{ fontSize: 14, fontWeight: 700 }}
                                    >
                                        3%
                                    </span>
                                </RingProgress>
                            </div>
                        </Card>
                    </div>
                </Section>

                {/* Toasts */}
                <Section eyebrow="Étape 2 / Foundation" title="Toasts & notifications">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: 14,
                        }}
                    >
                        <Toast
                            variant="success"
                            title="Paiement Flutterwave reçu"
                            body="Aïcha Hounsou — 125 000 FCFA · Trimestre 2."
                            action="Voir reçu"
                        />
                        <Toast
                            variant="warning"
                            title="3 absences cette semaine"
                            body="Koffi Dossou (4ᵉ B). SMS parent envoyé."
                            action="Contacter parent"
                        />
                        <Toast
                            variant="danger"
                            title="Incident infirmerie"
                            body="Marie B. — chute, suivi médical en cours."
                        />
                        <Toast
                            variant="info"
                            title="Insight IA"
                            body="Les notes en math chutent depuis 2 semaines en CM2-A."
                        />
                    </div>
                </Section>

                {/* Edu metric cards */}
                <Section eyebrow="Étape 3 / Edu Components" title="MetricCard · KPIs sémantiques">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: 14,
                        }}
                    >
                        <MetricCard
                            label="Élèves actifs"
                            value="1 248"
                            trend={4.2}
                            trendLabel="vs trim. 1"
                            icon="users"
                            variant="brand"
                        />
                        <MetricCard
                            label="Recouvrement"
                            value="82"
                            unit="%"
                            trend={6.1}
                            trendLabel="vs trim. 1"
                            icon="money"
                            variant="success"
                        />
                        <MetricCard
                            label="Présence"
                            value="92,4"
                            unit="%"
                            trend={-1.3}
                            trendLabel="vs sem. dern."
                            icon="check"
                            variant="info"
                        />
                        <MetricCard
                            label="Élèves à risque"
                            value="38"
                            trend={12}
                            trendLabel="cette semaine"
                            icon="warning"
                            variant="warning"
                        />
                        <MetricCard
                            label="Incidents"
                            value="2"
                            trend={-50}
                            trendLabel="vs sem. dern."
                            icon="danger"
                            variant="danger"
                        />
                    </div>
                </Section>

                {/* Notification items */}
                <Section eyebrow="Étape 3 / Edu Components" title="NotificationItem · 6 variants">
                    <Card padding={8}>
                        <NotifItem
                            type="urgent"
                            priority="P0"
                            title="Incident infirmerie — Marie Bossou (CE2-A)"
                            body="Chute dans la cour à 10h45. Infirmière sur place. Parent notifié par SMS."
                            time="il y a 4 min"
                            sender="Mme Akpovi"
                            actions={["Voir dossier", "Contacter parent"]}
                        />
                        <NotifItem
                            type="warning"
                            title="3 absences cette semaine — Koffi Dossou (4ᵉ B)"
                            body="Regroupement automatique de 3 alertes individuelles."
                            time="il y a 1 h"
                            actions={["Voir détail"]}
                        />
                        <NotifItem
                            type="success"
                            title="Paiement reçu via Paystack"
                            body="Aïcha Hounsou — 125 000 FCFA · Trimestre 2 confirmé."
                            time="il y a 2 h"
                        />
                        <NotifItem
                            type="info"
                            title="Conseil de classe demain à 16h00"
                            body="6ᵉ A — bulletins à valider avant 14h."
                            time="hier, 18:30"
                        />
                        <NotifItem
                            type="reminder"
                            title="Saisie des notes : DST math"
                            body="62 / 84 notes saisies. Échéance vendredi 17h."
                            time="hier"
                        />
                        <NotifItem
                            type="sms"
                            title="SMS envoyé à 24 parents"
                            body="Rappel paiement échéance 1ʳᵉ tranche. 18 lus, 6 en attente."
                            time="14h12"
                            sender="Système"
                        />
                    </Card>
                </Section>

                {/* Footer */}
                <div
                    style={{
                        marginTop: 24,
                        paddingTop: 24,
                        borderTop: "1px solid var(--eduflow-border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        fontSize: 11,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    <span>EduPilot Design System — pilotée par les rôles, alignée sur le terrain béninois.</span>
                    <span className="eduflow-mono">edupilot-tokens.css · src/components/edu/*</span>
                </div>
            </div>
        </div>
    );
}
