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
                    <div key={t}>
                        {/* Étiquette sous le swatch : un texte posé sur les
                            teintes intermédiaires (400-600) ne peut pas tenir
                            le ratio WCAG AA, quel que soit sa couleur. */}
                        <div
                            aria-hidden="true"
                            style={{
                                aspectRatio: "1",
                                borderRadius: 8,
                                background: `var(--${isBrandRamp ? "brand" : `eduflow-${varName}`}-${t})`,
                                border: "1px solid var(--eduflow-border-subtle)",
                            }}
                        />
                        <div
                            style={{
                                marginTop: 3,
                                textAlign: "center",
                                fontSize: 9,
                                fontWeight: 600,
                                color: "var(--eduflow-text-secondary)",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {t}
                        </div>
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

// ─── State previews ─────────────────────────────────────────────────────────

function EmptyStateCard() {
    return (
        <Card
            padding={40}
            style={{
                textAlign: "center",
                minHeight: 380,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
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
                    marginBottom: 20,
                }}
            >
                <Icon name="users" size={36} color="var(--brand-700)" />
            </div>
            <h3
                className="eduflow-display"
                style={{ fontSize: 18, margin: "0 0 8px", color: "var(--eduflow-text-primary)" }}
            >
                Aucun élève pour le moment
            </h3>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    maxWidth: 280,
                    margin: "0 0 20px",
                    lineHeight: 1.55,
                }}
            >
                L&apos;année scolaire n&apos;a pas démarré. Importez votre liste pour préparer la rentrée.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <Button icon="plus">Importer Excel</Button>
                <Button variant="secondary">Voir modèle</Button>
            </div>
        </Card>
    );
}

function LoadingStateCard() {
    return (
        <Card padding={20} style={{ minHeight: 380 }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 18,
                }}
            >
                <span
                    aria-hidden
                    className="animate-spin"
                    style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid var(--eduflow-neutral-200)",
                        borderTopColor: "var(--brand-600)",
                        display: "inline-block",
                    }}
                />
                <span style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                    Chargement des données…
                </span>
            </div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                    key={i}
                    style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 0",
                    }}
                >
                    <div
                        className="animate-pulse"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            background: "var(--eduflow-neutral-200)",
                            flexShrink: 0,
                        }}
                    />
                    <div style={{ flex: 1 }}>
                        <div
                            className="animate-pulse"
                            style={{
                                height: 10,
                                width: "60%",
                                background: "var(--eduflow-neutral-200)",
                                borderRadius: 5,
                            }}
                        />
                        <div
                            className="animate-pulse"
                            style={{
                                height: 8,
                                width: "40%",
                                background: "var(--eduflow-neutral-200)",
                                borderRadius: 4,
                                marginTop: 6,
                            }}
                        />
                    </div>
                    <div
                        className="animate-pulse"
                        style={{
                            width: 40,
                            height: 18,
                            background: "var(--eduflow-neutral-200)",
                            borderRadius: 9,
                            flexShrink: 0,
                        }}
                    />
                </div>
            ))}
        </Card>
    );
}

function ErrorStateCard() {
    return (
        <Card
            padding={40}
            style={{
                textAlign: "center",
                minHeight: 380,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--eduflow-danger-50)",
                border: "1px solid var(--eduflow-danger-200)",
            }}
        >
            <div
                style={{
                    width: 80,
                    height: 80,
                    borderRadius: 24,
                    background: "var(--eduflow-danger-100)",
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 20,
                }}
            >
                <Icon name="warning" size={36} color="var(--eduflow-danger-700)" />
            </div>
            <h3
                className="eduflow-display"
                style={{
                    fontSize: 18,
                    margin: "0 0 8px",
                    color: "var(--eduflow-danger-900, var(--eduflow-danger-800))",
                }}
            >
                Connexion perdue
            </h3>
            <p
                style={{
                    fontSize: 13,
                    color: "var(--eduflow-danger-800)",
                    maxWidth: 280,
                    margin: "0 0 18px",
                    lineHeight: 1.55,
                }}
            >
                Vos modifications sont sauvegardées localement. Synchronisation dès que le réseau revient.
            </p>
            <Badge variant="warning" size="sm" icon="clock">
                Réessai dans 8 s
            </Badge>
            <div
                className="eduflow-mono"
                style={{
                    marginTop: 16,
                    fontSize: 11,
                    color: "var(--eduflow-danger-800)",
                    letterSpacing: "0.04em",
                }}
            >
                err.network · 0x504
            </div>
        </Card>
    );
}

function ConfirmModalPreview() {
    return (
        <div
            style={{
                position: "relative",
                minHeight: 380,
                borderRadius: "var(--eduflow-radius-card, 16px)",
                overflow: "hidden",
                background: "var(--eduflow-neutral-300, #cbd5e1)",
                display: "grid",
                placeItems: "center",
                padding: 24,
            }}
        >
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(15,23,42,0.5)",
                    backdropFilter: "blur(2px)",
                }}
            />
            <div
                style={{
                    position: "relative",
                    background: "var(--eduflow-surface-card)",
                    borderRadius: "var(--eduflow-radius-card, 16px)",
                    padding: 28,
                    width: "min(380px, 100%)",
                    boxShadow: "0 24px 64px rgba(15,23,42,0.32)",
                }}
            >
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: "var(--eduflow-danger-50)",
                        display: "grid",
                        placeItems: "center",
                        marginBottom: 14,
                    }}
                >
                    <Icon name="warning" size={22} color="var(--eduflow-danger-700)" />
                </div>
                <h3
                    className="eduflow-display"
                    style={{ fontSize: 18, margin: "0 0 6px", color: "var(--eduflow-text-primary)" }}
                >
                    Supprimer l&apos;élève ?
                </h3>
                <p
                    style={{
                        fontSize: 13,
                        color: "var(--eduflow-text-secondary)",
                        margin: "0 0 20px",
                        lineHeight: 1.55,
                    }}
                >
                    Aïcha Hounsou sera retirée définitivement. Notes, présences et finance restent archivés 10 ans (MEMP).
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <Button variant="secondary" size="sm">Annuler</Button>
                    <Button variant="danger" size="sm" icon="x">Supprimer</Button>
                </div>
            </div>
        </div>
    );
}

function CommandPalettePreview() {
    const results = [
        { label: "Aïcha Hounsou · 3ᵉ A · matricule A0142", active: true },
        { label: "Aïssa Coffi · 5ᵉ B · matricule C0871", active: false },
    ];
    const quickActions: { icon: IconNameLike; label: string }[] = [
        { icon: "pencil", label: "Saisir une note pour Aïcha" },
        { icon: "sms", label: "Envoyer un SMS aux parents Hounsou" },
        { icon: "download", label: "Télécharger bulletin T2 d'Aïcha" },
    ];

    return (
        <div
            style={{
                position: "relative",
                minHeight: 380,
                borderRadius: "var(--eduflow-radius-card, 16px)",
                overflow: "hidden",
                background: "var(--eduflow-neutral-300, #cbd5e1)",
                display: "grid",
                placeItems: "start center",
                paddingTop: 50,
                paddingLeft: 16,
                paddingRight: 16,
                paddingBottom: 16,
            }}
        >
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(15,23,42,0.45)",
                    backdropFilter: "blur(3px)",
                }}
            />
            <div
                style={{
                    position: "relative",
                    background: "var(--eduflow-surface-card)",
                    borderRadius: "var(--eduflow-radius-card, 16px)",
                    width: "min(460px, 100%)",
                    boxShadow: "0 24px 64px rgba(15,23,42,0.32)",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        padding: "14px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                    }}
                >
                    <Icon name="search" size={16} color="var(--eduflow-text-tertiary)" />
                    <input
                        readOnly
                        aria-label="Aperçu de la palette ⌘K"
                        defaultValue="aïcha"
                        style={{
                            flex: 1,
                            border: 0,
                            outline: 0,
                            background: "transparent",
                            fontSize: 14,
                            fontFamily: "inherit",
                            color: "var(--eduflow-text-primary)",
                        }}
                    />
                    <span
                        className="eduflow-mono"
                        style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--eduflow-surface-sunken)",
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        ESC
                    </span>
                </div>
                <PaletteGroup label="Élèves">
                    {results.map((r, i) => (
                        <PaletteRow
                            key={i}
                            icon="users"
                            label={r.label}
                            kbd={r.active ? "↵" : undefined}
                            active={r.active}
                        />
                    ))}
                </PaletteGroup>
                <PaletteGroup label="Actions rapides">
                    {quickActions.map((a, i) => (
                        <PaletteRow key={i} icon={a.icon} label={a.label} />
                    ))}
                </PaletteGroup>
                <div
                    className="eduflow-mono"
                    style={{
                        padding: "10px 18px",
                        borderTop: "1px solid var(--eduflow-border-subtle)",
                        display: "flex",
                        gap: 14,
                        fontSize: 10,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    <span>↑↓ naviguer</span>
                    <span>⏎ ouvrir</span>
                    <span>⌘K basculer</span>
                </div>
            </div>
        </div>
    );
}

// Local alias keeps the showcase decoupled from the icon module's exported union type.
type IconNameLike = React.ComponentProps<typeof Icon>["name"];

function PaletteGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div
                style={{
                    padding: "10px 18px 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                {label}
            </div>
            {children}
        </div>
    );
}

function PaletteRow({
    icon,
    label,
    kbd,
    active,
}: {
    icon: IconNameLike;
    label: string;
    kbd?: string;
    active?: boolean;
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                background: active ? "var(--brand-50)" : "transparent",
                borderLeft: active ? "3px solid var(--brand-600)" : "3px solid transparent",
            }}
        >
            <Icon
                name={icon}
                size={14}
                color={active ? "var(--brand-700)" : "var(--eduflow-text-tertiary)"}
            />
            <span
                style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--brand-900, var(--brand-800))" : "var(--eduflow-text-primary)",
                }}
            >
                {label}
            </span>
            {kbd ? (
                <span
                    className="eduflow-mono"
                    style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                >
                    {kbd}
                </span>
            ) : null}
        </div>
    );
}

// ─── Mobile previews ────────────────────────────────────────────────────────

type PhoneNavItem = {
    icon: IconNameLike;
    label: string;
    active?: boolean;
    count?: number;
};

function Phone({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                width: 375,
                height: 760,
                background: "var(--eduflow-surface-page, #fff)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 32,
                boxShadow:
                    "0 0 0 9px var(--eduflow-neutral-900, #0F172A), 0 0 0 10px var(--eduflow-neutral-800, #1F2937), 0 22px 60px rgba(15,23,42,0.25)",
                flexShrink: 0,
            }}
        >
            {/* iOS-style status bar */}
            <div
                style={{
                    height: 38,
                    padding: "12px 24px 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--eduflow-text-primary)",
                    flexShrink: 0,
                }}
            >
                <span className="eduflow-mono">9:41</span>
                <span
                    aria-hidden
                    style={{
                        width: 80,
                        height: 22,
                        background: "var(--eduflow-neutral-900, #0F172A)",
                        borderRadius: 12,
                    }}
                />
                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 11 }}>5G</span>
                    <span
                        aria-hidden
                        style={{
                            width: 24,
                            height: 11,
                            border: "1.2px solid currentColor",
                            borderRadius: 3,
                            padding: 1,
                            display: "inline-block",
                        }}
                    >
                        <span
                            style={{
                                display: "block",
                                height: "100%",
                                width: "85%",
                                background: "currentColor",
                                borderRadius: 1,
                            }}
                        />
                    </span>
                </span>
            </div>
            {children}
        </div>
    );
}

function PhoneBottomNav({ items, label = "Navigation onglets mobile" }: { items: PhoneNavItem[]; label?: string }) {
    return (
        <nav
            aria-label={label}
            style={{
                height: 72,
                padding: "8px 12px 16px",
                background: "var(--eduflow-surface-card)",
                borderTop: "1px solid var(--eduflow-border-subtle)",
                display: "grid",
                gridTemplateColumns: `repeat(${items.length}, 1fr)`,
                flexShrink: 0,
            }}
        >
            {items.map((it, i) => {
                const color = it.active ? "var(--brand-700)" : "var(--eduflow-text-tertiary)";
                return (
                    <button
                        key={i}
                        type="button"
                        style={{
                            background: "transparent",
                            border: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                            position: "relative",
                            color,
                            fontFamily: "inherit",
                        }}
                    >
                        <div style={{ position: "relative" }}>
                            <Icon name={it.icon} size={22} color={color} />
                            {it.count != null ? (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: -4,
                                        right: -8,
                                        minWidth: 16,
                                        height: 16,
                                        padding: "0 4px",
                                        borderRadius: 8,
                                        background: "var(--eduflow-danger-500)",
                                        color: "#fff",
                                        fontSize: 9,
                                        fontWeight: 700,
                                        display: "grid",
                                        placeItems: "center",
                                    }}
                                >
                                    {it.count}
                                </span>
                            ) : null}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: it.active ? 700 : 600 }}>
                            {it.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}

function MobileEyebrow({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                marginBottom: 8,
            }}
        >
            {children}
        </div>
    );
}

function ParentMobilePreview() {
    return (
        <Phone>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 0" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0 16px",
                    }}
                >
                    <Avatar name="M. Hounsou" size="md" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            Bonjour
                        </div>
                        <div
                            className="eduflow-display"
                            style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}
                        >
                            M. Hounsou
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Notifications"
                        style={{
                            width: 38,
                            height: 38,
                            border: 0,
                            borderRadius: 12,
                            background: "var(--eduflow-surface-card)",
                            boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
                            display: "grid",
                            placeItems: "center",
                            position: "relative",
                            cursor: "pointer",
                        }}
                    >
                        <Icon name="bell" size={18} />
                        <span
                            aria-hidden
                            style={{
                                position: "absolute",
                                top: 8,
                                right: 9,
                                width: 7,
                                height: 7,
                                borderRadius: 4,
                                background: "var(--eduflow-danger-500)",
                            }}
                        />
                    </button>
                </div>

                <Card
                    padding={14}
                    style={{
                        background: "var(--eduflow-warning-50)",
                        border: "1px solid var(--eduflow-warning-200)",
                        marginBottom: 14,
                        display: "flex",
                        gap: 12,
                    }}
                >
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            background: "var(--eduflow-warning-600)",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Icon name="warning" size={18} color="#fff" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--eduflow-warning-900, var(--eduflow-warning-800))",
                            }}
                        >
                            Paiement T2 dans 6 jours
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-warning-800)",
                                marginTop: 2,
                            }}
                        >
                            220 000 FCFA · Aïcha + Mathieu
                        </div>
                    </div>
                </Card>

                <MobileEyebrow>Mes enfants</MobileEyebrow>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        marginBottom: 14,
                    }}
                >
                    {[
                        { n: "Aïcha", c: "3ᵉ A", avg: "14,8", t: 0.6, color: "success" as const },
                        { n: "Mathieu", c: "CM1", avg: "12,2", t: -0.8, color: "warning" as const },
                    ].map((k) => (
                        <Card
                            key={k.n}
                            padding={12}
                            style={{ display: "flex", alignItems: "center", gap: 12 }}
                        >
                            <Avatar name={`${k.n} Hounsou`} size="md" />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{k.n}</div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {k.c} · moyenne {k.avg}
                                </div>
                            </div>
                            <Badge variant={k.color} size="sm">
                                {k.t > 0 ? "+" : ""}
                                {k.t.toFixed(1).replace(".", ",")} pts
                            </Badge>
                            <Icon
                                name="chevron"
                                size={16}
                                color="var(--eduflow-text-tertiary)"
                            />
                        </Card>
                    ))}
                </div>

                <MobileEyebrow>Récent</MobileEyebrow>
                <Card padding={4} style={{ marginBottom: 8 }}>
                    <NotifItem
                        type="success"
                        title="DST Math 16,5/20"
                        body="Aïcha · meilleure note de la classe"
                        time="2 h"
                    />
                    <NotifItem
                        type="warning"
                        title="Mathieu absent — mardi"
                        body="Aucun justificatif"
                        time="ce matin"
                        actions={["Justifier"]}
                    />
                    <NotifItem type="sms" title="SMS · Rappel paiement" time="lundi" />
                </Card>
            </div>
            <PhoneBottomNav
                label="Navigation mobile parent"
                items={[
                    { icon: "home", label: "Accueil", active: true },
                    { icon: "users", label: "Enfants" },
                    { icon: "money", label: "Payer", count: 1 },
                    { icon: "sms", label: "École" },
                    { icon: "settings", label: "Profil" },
                ]}
            />
        </Phone>
    );
}

function StudentMobilePreview() {
    return (
        <Phone>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 0" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0 16px",
                    }}
                >
                    <Avatar name="Aïcha Hounsou" size="md" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            Salut
                        </div>
                        <div
                            className="eduflow-display"
                            style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}
                        >
                            Aïcha
                        </div>
                    </div>
                    <Badge variant="warning" icon="flame">
                        14 j
                    </Badge>
                </div>

                <Card
                    padding={20}
                    style={{
                        background:
                            "linear-gradient(135deg, var(--brand-800), var(--brand-600))",
                        color: "#fff",
                        border: 0,
                        marginBottom: 12,
                    }}
                >
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            opacity: 0.85,
                        }}
                    >
                        Ma moyenne T2
                    </div>
                    <div
                        className="eduflow-mono"
                        style={{
                            fontSize: 64,
                            fontWeight: 700,
                            lineHeight: 0.95,
                            letterSpacing: "-0.04em",
                            marginTop: 4,
                        }}
                    >
                        14,8
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: 6,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12,
                            }}
                        >
                            <Icon name="arrowUp" size={12} color="#fff" />
                            +0,6 pts · 4ᵉ / 26
                        </div>
                        <Icon name="trophy" size={20} color="#fff" />
                    </div>
                </Card>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 10,
                        marginBottom: 14,
                    }}
                >
                    <Card
                        padding={14}
                        style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                        <div
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                background: "var(--eduflow-warning-50)",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Icon name="book" size={18} color="var(--eduflow-warning-700)" />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>4 devoirs</div>
                            <div
                                style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                            >
                                2 cette semaine
                            </div>
                        </div>
                    </Card>
                    <Card
                        padding={14}
                        style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                        <div
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                background: "var(--eduflow-info-50)",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Icon name="calendar" size={18} color="var(--eduflow-info-700)" />
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Math 14h</div>
                            <div
                                style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}
                            >
                                Salle 207
                            </div>
                        </div>
                    </Card>
                </div>

                <MobileEyebrow>Dernières notes</MobileEyebrow>
                <Card padding={0}>
                    {[
                        { sub: "Maths", e: "DST Thalès", n: "16,5", c: "success" },
                        { sub: "Français", e: "Camara Laye", n: "13,0", c: "warning" },
                        { sub: "SVT", e: "Génétique", n: "17,0", c: "success" },
                    ].map((g, i) => (
                        <div
                            key={g.sub}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                gap: 12,
                                alignItems: "center",
                                padding: "12px 16px",
                                borderTop: i ? "1px solid var(--eduflow-border-subtle)" : 0,
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{g.sub}</div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {g.e}
                                </div>
                            </div>
                            <span
                                className="eduflow-mono"
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: `var(--eduflow-${g.c}-700)`,
                                }}
                            >
                                {g.n}
                            </span>
                        </div>
                    ))}
                </Card>
            </div>
            <PhoneBottomNav
                label="Navigation mobile enseignant"
                items={[
                    { icon: "home", label: "Accueil", active: true },
                    { icon: "pencil", label: "Notes" },
                    { icon: "book", label: "Devoirs", count: 4 },
                    { icon: "calendar", label: "EDT" },
                    { icon: "trophy", label: "Badges" },
                ]}
            />
        </Phone>
    );
}

function TeacherMobilePreview() {
    type RollState = "present" | "late" | "absent";
    const initialRoll: { name: string; state: RollState }[] = [
        { name: "Aïcha Hounsou", state: "present" },
        { name: "Mathieu Sossou", state: "present" },
        { name: "Fatou Adjavon", state: "late" },
        { name: "Koffi Dossou", state: "absent" },
        { name: "Marie Bossou", state: "present" },
        { name: "Jean-Paul Bio", state: "present" },
    ];
    const [roll, setRoll] = React.useState(initialRoll);

    const counts = React.useMemo(() => {
        const c = { present: 0, late: 0, absent: 0 };
        for (const r of roll) c[r.state]++;
        return c;
    }, [roll]);

    return (
        <Phone>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 0" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0 14px",
                    }}
                >
                    <button
                        type="button"
                        aria-label="Retour"
                        style={{
                            width: 36,
                            height: 36,
                            border: 0,
                            background: "transparent",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                        }}
                    >
                        <Icon
                            name="chevronDown"
                            size={18}
                            style={{ transform: "rotate(90deg)" }}
                        />
                    </button>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}>
                            Appel · 10h15
                        </div>
                        <div
                            className="eduflow-display"
                            style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}
                        >
                            3ᵉ A — DST Maths
                        </div>
                    </div>
                    <Badge variant="brand">
                        {counts.present + counts.late}/{roll.length}
                    </Badge>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 6,
                        marginBottom: 12,
                    }}
                >
                    {([
                        { v: counts.present, l: "Présents", c: "success" },
                        { v: counts.late, l: "Retards", c: "warning" },
                        { v: counts.absent, l: "Absents", c: "danger" },
                    ] as const).map((s) => (
                        <Card
                            key={s.l}
                            padding={10}
                            style={{
                                background: `var(--eduflow-${s.c}-50)`,
                                border: 0,
                                textAlign: "center",
                            }}
                        >
                            <div
                                className="eduflow-mono"
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: `var(--eduflow-${s.c}-800)`,
                                }}
                            >
                                {s.v}
                            </div>
                            <div
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: `var(--eduflow-${s.c}-800)`,
                                }}
                            >
                                {s.l}
                            </div>
                        </Card>
                    ))}
                </div>

                <Card padding={0} style={{ overflow: "hidden" }}>
                    {roll.map((r, i) => (
                        <div
                            key={r.name}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 14px",
                                borderTop: i ? "1px solid var(--eduflow-border-subtle)" : 0,
                            }}
                        >
                            <Avatar name={r.name} size="sm" />
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                                {r.name}
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                                {([
                                    { k: "present" as RollState, l: "P", c: "success" },
                                    { k: "late" as RollState, l: "R", c: "warning" },
                                    { k: "absent" as RollState, l: "A", c: "danger" },
                                ]).map((b) => {
                                    const active = r.state === b.k;
                                    return (
                                        <button
                                            key={b.k}
                                            type="button"
                                            aria-pressed={active}
                                            aria-label={`${b.l === "P" ? "Présent" : b.l === "R" ? "Retard" : "Absent"} pour ${r.name}`}
                                            onClick={() => {
                                                setRoll((prev) =>
                                                    prev.map((entry) =>
                                                        entry.name === r.name
                                                            ? { ...entry, state: b.k }
                                                            : entry,
                                                    ),
                                                );
                                            }}
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 10,
                                                border: active
                                                    ? 0
                                                    : "1.5px solid var(--eduflow-border-default)",
                                                background: active
                                                    ? `var(--eduflow-${b.c}-600)`
                                                    : "transparent",
                                                color: active
                                                    ? "#fff"
                                                    : "var(--eduflow-text-tertiary)",
                                                fontWeight: 700,
                                                fontSize: 13,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            {b.l}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
            <div
                style={{
                    padding: 16,
                    borderTop: "1px solid var(--eduflow-border-subtle)",
                    background: "var(--eduflow-surface-card)",
                    flexShrink: 0,
                }}
            >
                <Button full size="lg" icon="check">
                    Valider l&apos;appel · {roll.length} élèves
                </Button>
            </div>
        </Phone>
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

                {/* States */}
                <Section eyebrow="Étape 4 / Patterns" title="États · empty / loading / error">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                            gap: 16,
                        }}
                    >
                        <EmptyStateCard />
                        <LoadingStateCard />
                        <ErrorStateCard />
                    </div>
                </Section>

                <Section eyebrow="Étape 4 / Patterns" title="Overlays & micro-interactions">
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: 16,
                        }}
                    >
                        <ConfirmModalPreview />
                        <CommandPalettePreview />
                    </div>
                </Section>

                <Section eyebrow="Étape 5 / Mobile" title="Compagnons mobiles · 375 × 760">
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 24,
                            justifyContent: "center",
                            padding: "12px 0",
                        }}
                    >
                        <ParentMobilePreview />
                        <StudentMobilePreview />
                        <TeacherMobilePreview />
                    </div>
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
