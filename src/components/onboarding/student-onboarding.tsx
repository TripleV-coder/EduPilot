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
import { RoleOnboardShell, StatTile, ShortcutCard, LabelledInput, type Color } from "./shell";

// Extrait de dashboard/onboarding/page.tsx (1441 lignes) lors de la
// découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

export function StudentOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(2);
    const [selected, setSelected] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const steps = [
        "Personnaliser mon profil",
        "Choisir mon premier objectif",
        "Découvrir mes cours",
        "Activer les rappels devoirs",
        "Premier badge surprise",
    ];

    const objectives: {
        id: string;
        icon: IconName;
        label: string;
        sub: string;
        color: Color;
        badge: string;
    }[] = [
        {
            id: "top3",
            icon: "trophy",
            label: "Top 3 de la classe",
            sub: "Vise les trois premières moyennes du trimestre.",
            color: "warning",
            badge: "Or",
        },
        {
            id: "streak30",
            icon: "flame",
            label: "30 jours sans absence",
            sub: "Construis une vraie régularité.",
            color: "danger",
            badge: "Argent",
        },
        {
            id: "books5",
            icon: "book",
            label: "Lire 5 livres",
            sub: "Travail de fond lecture & expression.",
            color: "info",
            badge: "Argent",
        },
        {
            id: "homework100",
            icon: "check",
            label: "100% devoirs rendus",
            sub: "Plus rien ne se perd · zéro oubli.",
            color: "success",
            badge: "Or",
        },
        {
            id: "help3",
            icon: "users",
            label: "Aider 3 camarades",
            sub: "Tutorat math / français hebdomadaire.",
            color: "brand",
            badge: "Bronze",
        },
        {
            id: "frenchPlus1",
            icon: "sparkle",
            label: "+1 point en français",
            sub: "Concentre l'effort sur une matière.",
            color: "brand",
            badge: "Argent",
        },
    ];

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preferences: { objective: selected, objectiveSetAt: new Date().toISOString() },
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Erreur");
            }
            setSaved(true);
            setStep(3);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSaving(false);
        }
    };

    return (
        <RoleOnboardShell
            role="ÉLÈVE"
            color="warning"
            user={user}
            heroTitle={`Salut ${user.split(" ")[0]} 👋 prépare-toi à exploser tes scores.`}
            heroSub="Une appli rien que pour toi : tes notes, tes devoirs, tes badges, ton classement. Choisis un objectif pour le trimestre."
            steps={steps}
            currentStep={step}
            onPrev={() => setStep((s) => Math.max(1, s - 1))}
            onNext={selected ? handleSave : () => setStep((s) => Math.min(steps.length, s + 1))}
            nextLabel={selected ? (saving ? "Enregistrement…" : "Valider mon objectif") : "Étape suivante"}
        >
            <h2
                className="eduflow-display"
                style={{
                    fontSize: 24,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                }}
            >
                Choisis ton premier objectif du trimestre
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Un seul à la fois — on suit ta progression et on te débloque un badge
                quand tu l'atteins.
            </p>

            {error ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: 12,
                        background: "var(--eduflow-danger-50)",
                        border: "1px solid var(--eduflow-danger-200)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "var(--eduflow-danger-800)",
                    }}
                >
                    {error}
                </div>
            ) : null}

            {saved ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: 12,
                        background: "var(--eduflow-success-50)",
                        border: "1px solid var(--eduflow-success-200)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "var(--eduflow-success-800)",
                    }}
                >
                    Objectif enregistré · on suit ta progression sur le tableau de bord.
                </div>
            ) : null}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 14,
                }}
                className="ob-grid-3"
            >
                {objectives.map((o) => {
                    const active = selected === o.id;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => setSelected(o.id)}
                            style={{
                                padding: 20,
                                borderRadius: 14,
                                textAlign: "left",
                                border: active
                                    ? `2px solid var(--eduflow-${o.color}-600)`
                                    : "1px solid var(--eduflow-border-default)",
                                background: active
                                    ? `var(--eduflow-${o.color}-50)`
                                    : "var(--eduflow-surface-card)",
                                position: "relative",
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                            aria-pressed={active}
                        >
                            {active ? (
                                <div style={{ position: "absolute", top: 10, right: 10 }}>
                                    <Badge variant={o.color} size="sm" icon="check">
                                        Choisi
                                    </Badge>
                                </div>
                            ) : null}
                            <div
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 14,
                                    background: `var(--eduflow-${o.color}-100, var(--brand-100))`,
                                    display: "grid",
                                    placeItems: "center",
                                    marginBottom: 14,
                                }}
                            >
                                <Icon
                                    name={o.icon}
                                    size={24}
                                    color={`var(--eduflow-${o.color}-700)`}
                                />
                            </div>
                            <div
                                className="eduflow-display"
                                style={{ fontSize: 16, fontWeight: 700 }}
                            >
                                {o.label}
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    marginTop: 4,
                                    lineHeight: 1.5,
                                }}
                            >
                                {o.sub}
                            </div>
                            <div
                                style={{
                                    marginTop: 14,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Icon
                                    name="trophy"
                                    size={11}
                                    color={`var(--eduflow-${o.color}-700)`}
                                />
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: `var(--eduflow-${o.color}-800)`,
                                    }}
                                >
                                    Badge {o.badge}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </RoleOnboardShell>
    );
}

// ─── 4 · SUPER ADMIN ────────────────────────────────────────
