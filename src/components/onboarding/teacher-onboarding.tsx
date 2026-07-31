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
import { RoleOnboardShell, StatTile, ShortcutCard, LabelledInput } from "./shell";

// Extrait de dashboard/onboarding/page.tsx (1441 lignes) lors de la
// découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

export function TeacherOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(2);
    const steps = [
        "Compléter ton profil",
        "Saisir ta première note",
        "Faire un appel test",
        "Configurer tes alertes",
        "Découvrir l'IA pédagogique",
    ];
    return (
        <RoleOnboardShell
            role="ENSEIGNANT"
            color="brand"
            user={user}
            heroTitle="Pour ta première saisie, commence simple."
            heroSub="On t'a affecté à tes classes. Saisis ta première note en 30 secondes — promis."
            steps={steps}
            currentStep={step}
            onPrev={() => setStep((s) => Math.max(1, s - 1))}
            onNext={() => setStep((s) => Math.min(steps.length, s + 1))}
        >
            <h2
                className="eduflow-display"
                style={{
                    fontSize: 24,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                }}
            >
                Saisis ta première note
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Choisis une classe et un devoir test — on s'occupe du reste.
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 18,
                }}
                className="ob-grid"
            >
                <Card
                    style={{
                        border: "2px solid var(--brand-600)",
                        background: "var(--brand-50)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 10,
                        }}
                    >
                        <SubLabel>Sélection</SubLabel>
                        <Badge variant="brand" size="sm" icon="check">
                            Choisi
                        </Badge>
                    </div>
                    <div
                        className="eduflow-display"
                        style={{ fontSize: 22, fontWeight: 700 }}
                    >
                        Première saisie test
                    </div>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--brand-800)",
                            margin: "4px 0 0",
                        }}
                    >
                        On t'ouvre la grille de saisie de ta classe principale.
                    </p>
                </Card>
                <Card
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                    }}
                >
                    <SubLabel>Astuces gain de temps</SubLabel>
                    <div
                        style={{
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            marginTop: 6,
                            lineHeight: 1.5,
                        }}
                    >
                        <div>
                            ⇥ <strong>Tab</strong> passe à l'élève suivant
                        </div>
                        <div>
                            🎙 <strong>Vocal</strong> dicte la note (icône micro)
                        </div>
                        <div>
                            🤖 <strong>IA</strong> suggère une note d'après l'historique
                        </div>
                    </div>
                </Card>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 10,
                    padding: 14,
                    background: "var(--brand-50)",
                    borderRadius: "var(--eduflow-radius-input)",
                    marginBottom: 22,
                }}
            >
                <Icon
                    name="sparkle"
                    size={16}
                    color="var(--brand-700)"
                    style={{ marginTop: 2 }}
                />
                <div
                    style={{
                        fontSize: 12,
                        color: "var(--brand-900, var(--brand-800))",
                        lineHeight: 1.55,
                    }}
                >
                    <strong>Bonus :</strong> dès que tu valides, EduPilot calcule
                    automatiquement la moyenne classe, génère des alertes pour les élèves
                    &lt; 10 et propose un soutien IA si besoin.
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/dashboard/grades/entry" style={{ textDecoration: "none" }}>
                    <Button icon="pencil">Ouvrir la grille de saisie</Button>
                </Link>
                <Link href="/dashboard/attendance" style={{ textDecoration: "none" }}>
                    <Button variant="secondary" icon="check">
                        Faire un appel test
                    </Button>
                </Link>
            </div>
        </RoleOnboardShell>
    );
}

// ─── 2 · PARENT ──────────────────────────────────────────────
