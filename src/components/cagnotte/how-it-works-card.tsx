"use client";

import * as React from "react";
import { Button, Card, Icon } from "@/components/edu";

const STEPS: { title: string; detail: string }[] = [
    {
        title: "1 · Création",
        detail: "La direction ou un enseignant ouvre une cagnotte avec un objectif (FCFA) et une date limite.",
    },
    {
        title: "2 · Contribution",
        detail: "Chaque parent verse sa participation. Le montant et l'horodatage sont enregistrés au journal.",
    },
    {
        title: "3 · Transparence",
        detail: "Le journal public affiche chaque versement. EduPilot ne prélève aucune commission.",
    },
    {
        title: "4 · Clôture",
        detail: "À l'échéance, le solde est viré au compte de l'école avec un reçu détaillé.",
    },
];

/**
 * Bandeau de transparence des cagnottes + explication dépliable « Comment ça
 * marche » (contenu réel inline, pas de page externe).
 */
export function HowItWorksCard() {
    const [open, setOpen] = React.useState(false);

    return (
        <Card
            padding={18}
            style={{
                background: "var(--brand-50)",
                border: "1px solid var(--brand-200)",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr auto",
                    gap: 14,
                    alignItems: "center",
                }}
                className="cag-banner"
            >
                <div
                    aria-hidden
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 14,
                        background: "var(--brand-600)",
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    <Icon name="sparkle" size={24} color="#fff" />
                </div>
                <div>
                    <h3
                        className="eduflow-display"
                        style={{ fontSize: 16, fontWeight: 700, color: "var(--brand-900)", margin: 0 }}
                    >
                        100% transparent · 100% reversé
                    </h3>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--brand-800)",
                            margin: "4px 0 0",
                            lineHeight: 1.55,
                        }}
                    >
                        Chaque centime payé apparaît dans le journal public de la cagnotte.
                        EduPilot ne prélève rien sur les cagnottes. À la clôture, le solde
                        est viré au compte de l&apos;école avec reçu détaillé.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    iconRight={open ? "arrowUp" : "arrowDown"}
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                >
                    Comment ça marche
                </Button>
            </div>

            {open ? (
                <div
                    className="animate-in fade-in"
                    style={{
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: "1px solid var(--brand-200)",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                    }}
                >
                    {STEPS.map((step) => (
                        <div key={step.title}>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "var(--brand-900)",
                                }}
                            >
                                {step.title}
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--brand-800)",
                                    marginTop: 2,
                                    lineHeight: 1.5,
                                }}
                            >
                                {step.detail}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </Card>
    );
}
