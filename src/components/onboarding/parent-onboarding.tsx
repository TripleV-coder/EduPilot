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

export function ParentOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(1);
    const steps = [
        "Lier mon premier enfant",
        "Activer les SMS de secours",
        "Configurer le paiement Mobile Money",
        "Choisir mes préférences alertes",
        "Inviter le co-parent",
    ];
    const [matricule, setMatricule] = useState("");
    const [code, setCode] = useState("");
    const [linking, setLinking] = useState(false);
    const [linked, setLinked] = useState<{
        firstName: string;
        lastName: string;
        className: string | null;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLink = async () => {
        if (!matricule.trim()) {
            setError("Saisis le matricule de ton enfant.");
            return;
        }
        if (!code.trim()) {
            setError("Saisis le code de liaison remis par l'école.");
            return;
        }
        setLinking(true);
        setError(null);
        try {
            const res = await fetch("/api/parents/link-child", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    matricule: matricule.trim(),
                    verificationCode: code.trim(),
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Erreur");
            setLinked(body.student);
            setStep(2);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLinking(false);
        }
    };

    return (
        <RoleOnboardShell
            role="PARENT"
            color="success"
            user={user}
            heroTitle="Suis ton enfant sans rien manquer."
            heroSub="Lie son compte avec le matricule fourni par l'école. Reçois notes, absences, paiements en temps réel — par SMS aussi si pas de wifi."
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
                Lie ton premier enfant
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                L'école t'a remis un matricule + un code de vérification (carnet de liaison
                ou SMS de bienvenue).
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 18,
                }}
                className="ob-grid"
            >
                <Card>
                    <SubLabel>Informations de liaison</SubLabel>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            marginTop: 10,
                        }}
                    >
                        <LabelledInput
                            label="Matricule élève"
                            icon="users"
                            value={matricule}
                            onChange={setMatricule}
                            placeholder="BJ-2026-A0142"
                        />
                        <LabelledInput
                            label="Code de liaison (8 caractères)"
                            icon="settings"
                            value={code}
                            onChange={setCode}
                            placeholder="K7M2QPRX"
                        />
                    </div>
                    {error ? (
                        <div
                            style={{
                                marginTop: 12,
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
                    {linked ? (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 12,
                                background: "var(--eduflow-success-50)",
                                border: "1px solid var(--eduflow-success-200)",
                                borderRadius: 10,
                                display: "flex",
                                gap: 10,
                                alignItems: "flex-start",
                            }}
                        >
                            <Icon
                                name="check"
                                size={16}
                                color="var(--eduflow-success-700)"
                                style={{ marginTop: 2 }}
                            />
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-success-800)",
                                    lineHeight: 1.55,
                                }}
                            >
                                <strong>Lien confirmé</strong> · tu es bien le parent de{" "}
                                <strong>
                                    {linked.firstName} {linked.lastName}
                                </strong>
                                {linked.className ? ` (${linked.className})` : ""}.
                            </div>
                        </div>
                    ) : (
                        <Button
                            icon={linking ? undefined : "check"}
                            loading={linking}
                            onClick={handleLink}
                            disabled={!matricule.trim() || !code.trim() || linking}
                            style={{ marginTop: 14 }}
                        >
                            Lier cet enfant
                        </Button>
                    )}
                </Card>

                <Card
                    style={{
                        background:
                            "linear-gradient(135deg, var(--eduflow-success-50), var(--brand-50))",
                        border: "1px solid var(--eduflow-success-200)",
                    }}
                >
                    {linked ? (
                        <>
                            <div style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        display: "inline-block",
                                        margin: "0 auto 14px",
                                    }}
                                >
                                    <Avatar
                                        name={`${linked.firstName} ${linked.lastName}`}
                                        size="xl"
                                    />
                                </div>
                            </div>
                            <div
                                className="eduflow-display"
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    textAlign: "center",
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {linked.firstName} {linked.lastName}
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    textAlign: "center",
                                    marginTop: 2,
                                }}
                            >
                                {linked.className ?? "Classe à confirmer"}
                            </div>
                        </>
                    ) : (
                        <div
                            style={{
                                fontSize: 13,
                                color: "var(--eduflow-text-secondary)",
                                textAlign: "center",
                                padding: "32px 8px",
                                lineHeight: 1.6,
                            }}
                        >
                            Une fois le matricule validé, le profil de ton enfant
                            apparaîtra ici avec ses moyennes et sa présence.
                        </div>
                    )}
                </Card>
            </div>

            <Card style={{ marginTop: 18 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                    }}
                >
                    <Icon name="sms" size={20} color="var(--eduflow-success-700)" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                            Activer les SMS de secours
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                            }}
                        >
                            Reçois les alertes même hors connexion · 94% de lecture en
                            moins de 5 min
                        </div>
                    </div>
                    <Link
                        href="/dashboard/settings/notifications"
                        style={{ textDecoration: "none" }}
                    >
                        <Button variant="secondary" size="sm">
                            Configurer
                        </Button>
                    </Link>
                </div>
            </Card>
        </RoleOnboardShell>
    );
}

// ─── 3 · STUDENT ─────────────────────────────────────────────
