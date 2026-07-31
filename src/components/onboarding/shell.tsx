"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Logo,
    Spinner,
    type IconName,
} from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";

// Extrait de dashboard/onboarding/page.tsx (1441 lignes) lors de la
// découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

export type Color = "brand" | "success" | "warning" | "danger" | "info";

type Step = { label: string };

type ShellProps = {
    role: string;
    color: Color;
    user: string;
    heroTitle: string;
    heroSub: string;
    steps: string[];
    currentStep: number;
    onSkip?: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    nextLabel?: string;
    children: React.ReactNode;
};

export function RoleOnboardShell({
    role,
    color,
    user,
    heroTitle,
    heroSub,
    steps,
    currentStep,
    onSkip,
    onPrev,
    onNext,
    nextLabel = "Étape suivante",
    children,
}: ShellProps) {
    const firstName = user.split(" ")[0] || user;
    return (
        <div
            className="eduflow-scope"
            style={{
                display: "grid",
                gridTemplateColumns: "380px 1fr",
                background: "var(--eduflow-surface-page, #f6f7fb)",
                minHeight: "calc(100vh - 32px)",
                borderRadius: "var(--eduflow-radius-card)",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
            }}
        >
            <aside
                style={{
                    padding: "40px 32px",
                    background: `linear-gradient(170deg, var(--eduflow-${color}-700), var(--eduflow-${color}-900, var(--eduflow-${color}-800)))`,
                    color: "#fff",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 36,
                    }}
                >
                    <Logo size={28} />
                    <span
                        className="eduflow-display"
                        style={{ fontSize: 16, fontWeight: 700 }}
                    >
                        EduPilot
                    </span>
                    <span
                        style={{
                            marginLeft: "auto",
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.18)",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                        }}
                    >
                        {role}
                    </span>
                </div>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        opacity: 0.75,
                        marginBottom: 14,
                    }}
                >
                    Bienvenue
                </div>
                <h1
                    className="eduflow-display"
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        letterSpacing: "-0.025em",
                        margin: "0 0 16px",
                    }}
                >
                    {heroTitle}
                </h1>
                <p
                    style={{
                        fontSize: 14,
                        opacity: 0.88,
                        lineHeight: 1.6,
                        margin: "0 0 30px",
                    }}
                >
                    {heroSub}
                </p>

                <div style={{ marginTop: "auto" }}>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            opacity: 0.7,
                            marginBottom: 12,
                        }}
                    >
                        Ta checklist · {currentStep}/{steps.length}
                    </div>
                    {steps.map((label, i) => {
                        const done = i < currentStep - 1;
                        const current = i === currentStep - 1;
                        return (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    padding: "8px 0",
                                    alignItems: "center",
                                    opacity: done ? 0.55 : 1,
                                }}
                            >
                                <div
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 11,
                                        background: done
                                            ? "rgba(255,255,255,0.85)"
                                            : current
                                            ? "#fff"
                                            : "rgba(255,255,255,0.18)",
                                        color:
                                            done || current
                                                ? `var(--eduflow-${color}-700)`
                                                : "#fff",
                                        display: "grid",
                                        placeItems: "center",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                >
                                    {done ? (
                                        <Icon name="check" size={12} strokeWidth={3} />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontWeight: current ? 700 : 500,
                                        textDecoration: done ? "line-through" : "none",
                                    }}
                                >
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </aside>

            <main style={{ display: "flex", flexDirection: "column", background: "var(--eduflow-surface-card)" }}>
                <header
                    style={{
                        padding: "20px 36px",
                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <Avatar name={user} size="sm" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                            Bonjour {firstName} 👋
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onSkip}>
                        Passer la visite
                    </Button>
                </header>
                <div
                    style={{
                        flex: 1,
                        padding: "32px 40px",
                        overflowY: "auto",
                    }}
                >
                    {children}
                </div>
                <footer
                    style={{
                        padding: "16px 36px",
                        borderTop: "1px solid var(--eduflow-border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--eduflow-surface-card)",
                    }}
                >
                    <Button
                        variant="ghost"
                        onClick={onPrev}
                        disabled={currentStep <= 1}
                    >
                        ← Revenir
                    </Button>
                    <Button
                        iconRight="chevron"
                        onClick={onNext}
                        style={{
                            background: "var(--gradient-cta, var(--brand-700))",
                        }}
                    >
                        {nextLabel}
                    </Button>
                </footer>
            </main>
        </div>
    );
}

// ─── Top-level page ──────────────────────────────────────────

export function StatTile({
    label,
    value,
    sub,
}: {
    label: string;
    value: string;
    sub: string;
}) {
    return (
        <Card padding={14}>
            <div
                style={{
                    fontSize: 10,
                    color: "var(--eduflow-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
            <div
                style={{
                    fontSize: 10,
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                {sub}
            </div>
        </Card>
    );
}

// ─── Fallback (Director / Accountant / Staff) ────────────────

export function ShortcutCard({
    href,
    icon,
    title,
    body,
}: {
    href: string;
    icon: IconName;
    title: string;
    body: string;
}) {
    return (
        <Link href={href} style={{ textDecoration: "none" }}>
            <Card style={{ cursor: "pointer" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                    }}
                >
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "var(--brand-50)",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Icon name={icon} size={20} color="var(--brand-700)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 2,
                            }}
                        >
                            {body}
                        </div>
                    </div>
                    <Icon
                        name="chevron"
                        size={16}
                        color="var(--eduflow-text-tertiary)"
                    />
                </div>
            </Card>
        </Link>
    );
}

export function LabelledInput({
    label,
    icon,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    icon?: IconName;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <div style={{ position: "relative" }}>
                {icon ? (
                    <span
                        style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            display: "inline-flex",
                            pointerEvents: "none",
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        <Icon name={icon} size={14} />
                    </span>
                ) : null}
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    style={{
                        width: "100%",
                        height: 38,
                        padding: icon ? "0 12px 0 34px" : "0 12px",
                        borderRadius: "var(--eduflow-radius-input)",
                        border: "1px solid var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-card)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--eduflow-text-primary)",
                        outline: "none",
                    }}
                />
            </div>
        </label>
    );
}
